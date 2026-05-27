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

// FCA EWA Code of Practice — monthly access cap (docs/01-product-context.md).
const FCA_MAX_ACCESS_FRACTION = 0.5;

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

    // AVAILABLE_TO_ACCESS — FCA 50% cap, floored at 0.
    const availableToAccess = Math.max(
      0,
      estimatedNetEarned * FCA_MAX_ACCESS_FRACTION - previouslyAccessed,
    );

    // TRANSFER_AMOUNT_MAX — MIN with employer-configured cap (always ≤ FCA cap).
    const employerConfiguredMax = Math.max(
      0,
      estimatedNetEarned *
        (eligibility.employerConfig.maxAccessPercent / 100) -
        previouslyAccessed,
    );
    const transferAmountMax = Math.min(availableToAccess, employerConfiguredMax);

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
