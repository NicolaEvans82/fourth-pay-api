import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  EWA_TRANSFER_READER,
  EWA_TRANSFER_WRITER,
  type EwaTransfer,
  type EwaTransferReader,
  type EwaTransferWriter,
} from '../../database/ewa-transfer.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  SELF_CONTROLS_READER,
  type SelfControlsReader,
} from '../../database/readers/self-controls.reader';
import {
  AUDIT_LOG_WRITER,
  type AuditLogWriter,
} from '../../database/writers/audit-log.writer';
import {
  EWA_DEDUCTION_QUEUE_WRITER,
  type EwaDeductionQueueWriter,
} from '../../database/writers/ewa-deduction-queue.writer';
import { HR_ADAPTER, type HrAdapter } from '../../integrations/hr/hr.adapter';
import {
  PAYROLL_ADAPTER,
  type PayrollAdapter,
} from '../../integrations/payroll/payroll.adapter';
import { WFM_ADAPTER, type WfmAdapter } from '../../integrations/wfm/wfm.adapter';
import {
  AUTO_SAVE_SINK,
  type AutoSaveSink,
} from '../savings/auto-save.sink';

const INSTANT_FEE = 1.95;
const MIN_TRANSFER_AMOUNT = 10.0;

@Injectable()
export class TransferService {
  constructor(
    @Inject(WFM_ADAPTER) private readonly wfm: WfmAdapter,
    @Inject(HR_ADAPTER) private readonly hr: HrAdapter,
    @Inject(PAYROLL_ADAPTER) private readonly payroll: PayrollAdapter,
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(SELF_CONTROLS_READER)
    private readonly selfControls: SelfControlsReader,
    @Inject(EWA_TRANSFER_READER)
    private readonly transfersReader: EwaTransferReader,
    @Inject(EWA_TRANSFER_WRITER)
    private readonly transfersWriter: EwaTransferWriter,
    @Inject(AUDIT_LOG_WRITER) private readonly audit: AuditLogWriter,
    @Inject(EWA_DEDUCTION_QUEUE_WRITER)
    private readonly deductionQueue: EwaDeductionQueueWriter,
    @Inject(AUTO_SAVE_SINK) private readonly autoSave: AutoSaveSink,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  async executeTransfer(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
    amount: number;
    transferSpeed: 'instant' | 'standard' | 'gift_card';
    bankAccountId?: string | null;
    giftCardPartner?: string | null;
    fcaDisclosureAcknowledged: boolean;
  }): Promise<EwaTransfer> {
    // iQ360: every attempt — including ones that will hard-fail at the
    // FCA gate — is an "initiated" event.
    this.iq360?.emit('ewa.transfer.initiated', {
      employee_id: input.fourthEmployeeId,
      employer_id: input.fourthEmployerId,
      properties: {
        amount: input.amount,
        transfer_speed: input.transferSpeed,
      },
    });
    try {
      const transfer = await this.executeTransferInner(input);
      this.iq360?.emit('ewa.transfer.completed', {
        employee_id: input.fourthEmployeeId,
        employer_id: input.fourthEmployerId,
        properties: {
          amount: transfer.requestedAmount,
          fee: transfer.feeAmount,
          transfer_speed: transfer.transferSpeed,
        },
      });
      return transfer;
    } catch (err) {
      this.iq360?.emit('ewa.transfer.failed', {
        employee_id: input.fourthEmployeeId,
        employer_id: input.fourthEmployerId,
        properties: {
          amount: input.amount,
          transfer_speed: input.transferSpeed,
          error_code: extractErrorCode(err),
        },
      });
      throw err;
    }
  }

  private async executeTransferInner(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
    amount: number;
    transferSpeed: 'instant' | 'standard' | 'gift_card';
    bankAccountId?: string | null;
    giftCardPartner?: string | null;
    fcaDisclosureAcknowledged: boolean;
  }): Promise<EwaTransfer> {
    // FCA gate: rule 3 in CLAUDE.md — no transfer can execute without
    // fca_disclosure_acknowledged === true. Hard fail before any side effects.
    if (input.fcaDisclosureAcknowledged !== true) {
      throw new BadRequestException({
        code: 'EWA_FCA_DISCLOSURE_REQUIRED',
        message: 'FCA disclosure must be acknowledged before transfer.',
      });
    }
    if (input.amount < MIN_TRANSFER_AMOUNT) {
      throw new BadRequestException({
        code: 'EWA_AMOUNT_BELOW_MINIMUM',
        message: `Minimum transfer is £${MIN_TRANSFER_AMOUNT.toFixed(2)}.`,
      });
    }

    const employee = await this.employees.findByFourthEmployeeId(
      input.fourthEmployeeId,
    );
    if (!employee) {
      throw new NotFoundException(
        'Employee account not enrolled in Fourth Pay',
      );
    }

    const eligibility = await this.hr.checkEligibility({
      fourthEmployeeId: input.fourthEmployeeId,
      fourthEmployerId: input.fourthEmployerId,
    });
    if (!eligibility.eligible) {
      throw new ForbiddenException({
        code: 'EWA_NOT_ELIGIBLE',
        message: eligibility.reason ?? 'Employee not eligible for EWA',
      });
    }

    const period = await this.payroll.getPayPeriodConfig({
      fourthEmployeeId: input.fourthEmployeeId,
      fourthEmployerId: input.fourthEmployerId,
    });

    const [shifts, previouslyAccessed, selfControls, latestCompleted] =
      await Promise.all([
        this.wfm.getConfirmedShifts({
          fourthEmployeeId: input.fourthEmployeeId,
          from: period.periodStart,
          to: period.periodEnd,
        }),
        this.transfersReader.sumAdvancesInPeriod({
          employeeAccountId: employee.id,
          payPeriodStart: period.periodStart,
        }),
        this.selfControls.findByEmployeeAccountId(employee.id),
        this.transfersReader.findLatestCompleted(employee.id),
      ]);

    if (selfControls?.pausedUntil && selfControls.pausedUntil > new Date()) {
      throw new ForbiddenException({
        code: 'EWA_ACCOUNT_PAUSED',
        message: 'Account access is paused.',
      });
    }

    if (
      selfControls?.coolingOffEnabled &&
      latestCompleted?.completedAt
    ) {
      const elapsedMs =
        Date.now() - latestCompleted.completedAt.getTime();
      const windowMs = selfControls.coolingOffHours * 60 * 60 * 1000;
      if (elapsedMs < windowMs) {
        throw new ForbiddenException({
          code: 'EWA_COOLING_OFF_ACTIVE',
          message: 'Cooling-off period active.',
        });
      }
    }

    if (
      selfControls?.perTransferLimitEnabled &&
      selfControls.perTransferLimitAmount !== null &&
      input.amount > selfControls.perTransferLimitAmount
    ) {
      throw new BadRequestException({
        code: 'EWA_PER_TRANSFER_LIMIT',
        message: 'Exceeds per-transfer limit.',
      });
    }

    if (
      selfControls?.monthlyLimitEnabled &&
      selfControls.monthlyLimitAmount !== null &&
      input.amount + previouslyAccessed > selfControls.monthlyLimitAmount
    ) {
      throw new BadRequestException({
        code: 'EWA_MONTHLY_LIMIT_EXCEEDED',
        message: 'Would exceed your monthly self-control limit.',
      });
    }

    // Balance — same formula as BalanceService (docs/01 + docs/05).
    const grossEarned = shifts
      .filter((s) => !s.submittedToPayroll)
      .reduce((sum, s) => sum + s.value, 0);
    const estimatedNetEarned = grossEarned * (1 - period.averageDeductionRate);
    // Same access cap as BalanceService — accessCapPercent (default 50,
    // up to 70 with an FCA permission letter).
    const availableAmount = Math.max(
      0,
      estimatedNetEarned *
        (eligibility.employerConfig.accessCapPercent / 100) -
        previouslyAccessed,
    );
    // ─────────── Fraud detection ───────────
    // 1) Velocity: max 3 attempts in a rolling 24h window.
    // 2) Amount anomaly: requested > 2× employee's historical average.
    // The velocity check is hard-blocking; the anomaly check is a
    // non-blocking flag — audit-logged, surfaced on the response, but
    // doesn't stop the transfer (the fraud-review team can act on
    // the audit-log entry asynchronously). Both apply BEFORE any
    // writer.insert so failed velocity checks leave no transfer row.
    const VELOCITY_LIMIT = 3;
    const VELOCITY_WINDOW_HOURS = 24;
    const ANOMALY_MULTIPLIER = 2;
    const velocitySince = new Date(
      Date.now() - VELOCITY_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const [recentAttempts, history] = await Promise.all([
      this.transfersReader.countAttemptsSince({
        employeeAccountId: employee.id,
        since: velocitySince,
      }),
      this.transfersReader.averageCompletedAmount(employee.id),
    ]);
    if (recentAttempts >= VELOCITY_LIMIT) {
      await this.audit.append({
        employeeAccountId: employee.id,
        eventType: 'velocity_blocked',
        eventData: {
          requestedAmount: input.amount,
          transferSpeed: input.transferSpeed,
          recentAttempts,
          windowHours: VELOCITY_WINDOW_HOURS,
          limit: VELOCITY_LIMIT,
        },
      });
      this.iq360?.emit('ewa.transfer.velocity_blocked', {
        employee_id: input.fourthEmployeeId,
        employer_id: input.fourthEmployerId,
        properties: {
          amount: input.amount,
          recent_attempts: recentAttempts,
          window_hours: VELOCITY_WINDOW_HOURS,
          limit: VELOCITY_LIMIT,
        },
      });
      throw new ForbiddenException({
        code: 'EWA_VELOCITY_LIMIT_EXCEEDED',
        message: `Velocity limit reached: max ${VELOCITY_LIMIT} transfers in ${VELOCITY_WINDOW_HOURS} hours.`,
      });
    }
    const isAnomaly =
      history.count > 0 && input.amount > ANOMALY_MULTIPLIER * history.average;
    if (isAnomaly) {
      await this.audit.append({
        employeeAccountId: employee.id,
        eventType: 'amount_anomaly',
        eventData: {
          requestedAmount: input.amount,
          historicalAverage: history.average,
          historyCount: history.count,
          multiplier: ANOMALY_MULTIPLIER,
        },
      });
      this.iq360?.emit('ewa.transfer.anomaly_flagged', {
        employee_id: input.fourthEmployeeId,
        employer_id: input.fourthEmployerId,
        properties: {
          amount: input.amount,
          historical_average: history.average,
          history_count: history.count,
          multiplier: ANOMALY_MULTIPLIER,
        },
      });
    }
    // ─────────── End fraud detection ───────────

    // Balance check now runs after fraud — security signals fire
    // before "you can't afford this" so the user gets the most
    // actionable error code (velocity > balance).
    if (input.amount > round2(availableAmount)) {
      throw new BadRequestException({
        code: 'EWA_INSUFFICIENT_BALANCE',
        message: 'Requested amount exceeds available balance.',
      });
    }

    // Fee tiers:
    //   instant   → £1.95 (unless employer subsidises)
    //   standard  → £0
    //   gift_card → £0 (the partner gives the gift card at face value;
    //               we don't charge the user a fee for that route)
    const feeSubsidised = eligibility.employerConfig.feeSubsidised;
    let feeAmount: number;
    if (input.transferSpeed === 'gift_card' || input.transferSpeed === 'standard') {
      feeAmount = 0;
    } else {
      feeAmount = feeSubsidised ? 0 : INSTANT_FEE;
    }
    const netAmount = round2(input.amount - feeAmount);

    // FCA audit: disclosure shown + acknowledged BEFORE state change.
    const fcaDisclosureAt = new Date();
    await Promise.all([
      this.audit.append({
        employeeAccountId: employee.id,
        eventType: 'fca_disclosure_shown',
        eventData: {
          feeAmount,
          netAmount,
          requestedAmount: input.amount,
          transferSpeed: input.transferSpeed,
        },
      }),
      this.audit.append({
        employeeAccountId: employee.id,
        eventType: 'fca_disclosure_acknowledged',
        eventData: { acknowledgedAt: fcaDisclosureAt.toISOString() },
      }),
    ]);

    const transfer = await this.transfersWriter.insert({
      employeeAccountId: employee.id,
      payPeriodStart: period.periodStart,
      payPeriodEnd: period.periodEnd,
      requestedAmount: input.amount,
      feeAmount,
      feeSubsidised,
      netAmount,
      transferSpeed: input.transferSpeed,
      // Only stored when the user picked gift_card; ignored otherwise.
      giftCardPartner:
        input.transferSpeed === 'gift_card' ? input.giftCardPartner ?? null : null,
      bankAccountId: input.bankAccountId ?? null,
      fcaDisclosureShown: true,
      fcaDisclosureAt,
    });

    await this.audit.append({
      employeeAccountId: employee.id,
      eventType: 'transfer_initiated',
      eventData: {
        transferId: transfer.id,
        amount: input.amount,
        transferSpeed: input.transferSpeed,
        feeAmount,
        feeSubsidised,
      },
    });

    // TODO: real bank transfer via a BankTransferGateway port (Faster Payments
    // / open banking). For dev we mark the transfer completed so the API call
    // exercises the full happy-path including audit + deduction queue.
    const completedAt = new Date();
    const completed = await this.transfersWriter.setStatus({
      id: transfer.id,
      status: 'completed',
      completedAt,
    });

    await this.deductionQueue.queue({
      ewaTransferId: completed.id,
      employeeAccountId: employee.id,
      fourthEmployeeId: input.fourthEmployeeId,
      payPeriodStart: period.periodStart,
      amount: input.amount,
    });

    await this.autoSave.onTransferCompleted({
      employeeAccountId: employee.id,
      transferId: completed.id,
      transferAmount: completed.requestedAmount,
    });

    await this.audit.append({
      employeeAccountId: employee.id,
      eventType: 'transfer_completed',
      eventData: {
        transferId: completed.id,
        amount: input.amount,
        completedAt: completedAt.toISOString(),
      },
    });

    // Anomaly is a runtime-only flag; the store layer ignores it, so
    // attach after the writer has returned the persisted row.
    if (isAnomaly) completed.anomaly = true;
    return completed;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Pulls a stable string for the iQ360 `error_code` property. Prefers the
// caller-supplied `code` on Nest HttpException responses (e.g.
// `EWA_FCA_DISCLOSURE_REQUIRED`), falls back to the exception class name.
function extractErrorCode(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'object' && body !== null) {
      const code = (body as { code?: unknown }).code;
      if (typeof code === 'string') return code;
    }
    return err.constructor.name;
  }
  if (err instanceof Error) return err.constructor.name;
  return 'unknown';
}
