import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EWA_TRANSFER_READER,
  type EwaTransferReader,
} from '../../database/ewa-transfer.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  SELF_CONTROLS_READER,
  type SelfControlsReader,
  type SelfControlsRecord,
} from '../../database/readers/self-controls.reader';
import { HR_ADAPTER, type HrAdapter } from '../../integrations/hr/hr.adapter';
import {
  PAYROLL_ADAPTER,
  type PayrollAdapter,
} from '../../integrations/payroll/payroll.adapter';
import { WFM_ADAPTER, type WfmAdapter } from '../../integrations/wfm/wfm.adapter';

export interface EwaBalance {
  availableAmount: number;
  earnedAmount: number;
  accessedAmount: number;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  nextPayday: Date;
  employerSubsidy: boolean;
  monthlyLimitRemaining: number | null;
}

@Injectable()
export class BalanceService {
  constructor(
    @Inject(WFM_ADAPTER) private readonly wfm: WfmAdapter,
    @Inject(HR_ADAPTER) private readonly hr: HrAdapter,
    @Inject(PAYROLL_ADAPTER) private readonly payroll: PayrollAdapter,
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(EWA_TRANSFER_READER)
    private readonly transfers: EwaTransferReader,
    @Inject(SELF_CONTROLS_READER)
    private readonly selfControls: SelfControlsReader,
  ) {}

  // Formula: docs/01-product-context.md as corrected by docs/05-integration-contracts.md.
  // GROSS_EARNED uses SUM(approvedHour.value) directly — do not multiply Units × Rate.
  // Must not be modified — see CLAUDE.md rule 1.
  async getBalance(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<EwaBalance> {
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
      throw new ForbiddenException(
        eligibility.reason ?? 'Employee not eligible for EWA',
      );
    }

    const period = await this.payroll.getPayPeriodConfig({
      fourthEmployeeId: input.fourthEmployeeId,
      fourthEmployerId: input.fourthEmployerId,
    });

    const [shifts, previouslyAccessed, selfControls] = await Promise.all([
      this.wfm.getConfirmedShifts({
        fourthEmployeeId: input.fourthEmployeeId,
        from: period.periodStart,
        to: period.periodEnd,
      }),
      this.transfers.sumAdvancesInPeriod({
        employeeAccountId: employee.id,
        payPeriodStart: period.periodStart,
      }),
      this.selfControls.findByEmployeeAccountId(employee.id),
    ]);

    // GROSS_EARNED: SUM(Value) over approved-hours rows not yet submitted to payroll.
    const grossEarned = shifts
      .filter((s) => !s.submittedToPayroll)
      .reduce((sum, s) => sum + s.value, 0);

    // ESTIMATED_NET_EARNED — averageDeductionRate from last 3 payslips.
    const estimatedNetEarned = grossEarned * (1 - period.averageDeductionRate);

    // AVAILABLE_TO_ACCESS — employer-configurable cap, floored at 0.
    // accessCapPercent defaults to 50 (FCA EWA Code of Practice baseline);
    // employers operating under an FCA permission letter for higher
    // access can configure up to 70% via the dashboard. This is now
    // the single binding cap for the access calculation — the
    // formerly-separate maxAccessPercent term has been folded in
    // because the two fields were redundant in practice (both have
    // historically been set to the same value).
    const transferAmountMax = Math.max(
      0,
      estimatedNetEarned * (eligibility.employerConfig.accessCapPercent / 100) -
        previouslyAccessed,
    );

    return {
      availableAmount: round2(transferAmountMax),
      earnedAmount: round2(grossEarned),
      accessedAmount: round2(previouslyAccessed),
      payPeriodStart: period.periodStart,
      payPeriodEnd: period.periodEnd,
      nextPayday: period.nextPayday,
      employerSubsidy: eligibility.employerConfig.feeSubsidised,
      monthlyLimitRemaining: this.computeMonthlyLimitRemaining(
        selfControls,
        previouslyAccessed,
      ),
    };
  }

  private computeMonthlyLimitRemaining(
    selfControls: SelfControlsRecord | null,
    previouslyAccessed: number,
  ): number | null {
    if (
      !selfControls ||
      !selfControls.monthlyLimitEnabled ||
      selfControls.monthlyLimitAmount === null
    ) {
      return null;
    }
    return round2(
      Math.max(0, selfControls.monthlyLimitAmount - previouslyAccessed),
    );
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
