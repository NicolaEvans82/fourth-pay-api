import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
const FCA_MAX_ACCESS_FRACTION = 0.5;
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
  ) {}

  async executeTransfer(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
    amount: number;
    transferSpeed: 'instant' | 'standard';
    bankAccountId?: string | null;
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
    const fcaCap = Math.max(
      0,
      estimatedNetEarned * FCA_MAX_ACCESS_FRACTION - previouslyAccessed,
    );
    const employerCap = Math.max(
      0,
      estimatedNetEarned *
        (eligibility.employerConfig.maxAccessPercent / 100) -
        previouslyAccessed,
    );
    const availableAmount = Math.min(fcaCap, employerCap);
    if (input.amount > round2(availableAmount)) {
      throw new BadRequestException({
        code: 'EWA_INSUFFICIENT_BALANCE',
        message: 'Requested amount exceeds available balance.',
      });
    }

    // Fee: instant = £1.95 unless employer subsidises; standard = £0.
    const feeSubsidised = eligibility.employerConfig.feeSubsidised;
    const feeAmount =
      input.transferSpeed === 'standard' || feeSubsidised ? 0 : INSTANT_FEE;
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

    return completed;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
