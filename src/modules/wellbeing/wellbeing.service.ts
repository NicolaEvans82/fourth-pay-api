import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  EWA_TRANSFER_READER,
  type EwaTransferReader,
} from '../../database/ewa-transfer.store';
import {
  SAVINGS_POT_READER,
  type SavingsPotReader,
} from '../../database/savings-pot.store';
import { SelfControlsService } from '../self-controls/self-controls.service';
import { BalanceService } from '../ewa/balance.service';

export interface WellbeingComponent {
  weight: number; // 0–1
  score: number; // 0–100
  contribution: number; // score × weight, rounded
  detail: string;
}

export interface WellbeingResponse {
  score: number;
  band: 'building' | 'steady' | 'thriving';
  components: {
    savings: WellbeingComponent;
    monthlyLimit: WellbeingComponent;
    transferFrequency: WellbeingComponent;
    coolingOff: WellbeingComponent;
  };
}

// Weights — sum to 1. Surfaced in the response so the UI can render
// "30% — savings progress" labels next to each component without
// hardcoding them on the client.
const W_SAVINGS = 0.3;
const W_LIMIT = 0.25;
const W_TRANSFERS = 0.25;
const W_COOLING = 0.2;

@Injectable()
export class WellbeingService {
  constructor(
    private readonly balance: BalanceService,
    private readonly selfControlsService: SelfControlsService,
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(EWA_TRANSFER_READER)
    private readonly transfers: EwaTransferReader,
    @Inject(SAVINGS_POT_READER)
    private readonly pots: SavingsPotReader,
  ) {}

  async getScore(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<WellbeingResponse> {
    const employee = await this.employees.findByFourthEmployeeId(
      input.fourthEmployeeId,
    );
    if (!employee) {
      throw new NotFoundException(
        'Employee account not enrolled in Fourth Pay',
      );
    }
    const [balance, selfControls, employeePots, recentTransfers] =
      await Promise.all([
        this.balance.getBalance(input),
        this.selfControlsService.get({
          ...input,
          role: 'employee',
        }),
        this.pots.listByEmployee(employee.id),
        this.transfers.findRecentByEmployee({
          employeeAccountId: employee.id,
          limit: 50,
        }),
      ]);

    // SAVINGS — having any pot at all is the big step; reaching the
    // target adds the remaining 25 points. No pot = 0.
    const savingsComponent = scoreSavings(employeePots);

    // MONTHLY LIMIT — enabled is itself a positive signal (60), then
    // headroom under the cap fills the remaining 40. Not enabled = 30.
    const limitComponent = scoreMonthlyLimit(
      selfControls.monthlyLimitEnabled,
      selfControls.monthlyLimitAmount,
      balance.accessedAmount,
    );

    // TRANSFER FREQUENCY — drawing pay early occasionally is fine;
    // heavy use is the signal we're worried about.
    const periodTransfers = recentTransfers.filter(
      (t) =>
        sameDay(t.payPeriodStart, balance.payPeriodStart) &&
        t.status !== 'failed' &&
        t.status !== 'reversed',
    );
    const transfersComponent = scoreTransferFrequency(periodTransfers.length);

    // COOLING-OFF — binary self-protection signal.
    const coolingComponent = scoreCoolingOff(selfControls.coolingOffEnabled);

    const total = Math.round(
      savingsComponent.contribution +
        limitComponent.contribution +
        transfersComponent.contribution +
        coolingComponent.contribution,
    );

    return {
      score: total,
      band: bandFor(total),
      components: {
        savings: savingsComponent,
        monthlyLimit: limitComponent,
        transferFrequency: transfersComponent,
        coolingOff: coolingComponent,
      },
    };
  }
}

function scoreSavings(
  pots: { targetAmount: number | null; balance: number }[],
): WellbeingComponent {
  if (pots.length === 0) {
    return component(W_SAVINGS, 0, 'No savings pot set up yet');
  }
  const hasTarget = pots.find((p) => p.targetAmount && p.targetAmount > 0);
  const progress = hasTarget
    ? Math.min(1, hasTarget.balance / (hasTarget.targetAmount ?? 1))
    : 0;
  const score = 75 + 25 * progress;
  const detail = hasTarget
    ? `£${round2(hasTarget.balance)} of £${round2(hasTarget.targetAmount ?? 0)} target (${Math.round(progress * 100)}%)`
    : `${pots.length} pot${pots.length === 1 ? '' : 's'} active — no target set`;
  return component(W_SAVINGS, score, detail);
}

function scoreMonthlyLimit(
  enabled: boolean,
  cap: number | null,
  accessed: number,
): WellbeingComponent {
  if (!enabled || !cap || cap <= 0) {
    return component(
      W_LIMIT,
      30,
      'Monthly access limit not set — turning one on improves your score',
    );
  }
  const usage = Math.min(1, Math.max(0, accessed / cap));
  const headroom = 1 - usage;
  const score = 60 + 40 * headroom;
  return component(
    W_LIMIT,
    score,
    `£${round2(accessed)} of £${round2(cap)} limit used (${Math.round(usage * 100)}%)`,
  );
}

function scoreTransferFrequency(count: number): WellbeingComponent {
  if (count === 0) {
    return component(
      W_TRANSFERS,
      100,
      'No EWA transfers this period — well done',
    );
  }
  const score = Math.max(30, 95 - count * 8);
  return component(
    W_TRANSFERS,
    score,
    `${count} EWA transfer${count === 1 ? '' : 's'} this period`,
  );
}

function scoreCoolingOff(enabled: boolean): WellbeingComponent {
  if (enabled) {
    return component(W_COOLING, 100, 'Cooling-off period active');
  }
  return component(
    W_COOLING,
    50,
    'Cooling-off period off — turning it on improves your score',
  );
}

function component(
  weight: number,
  rawScore: number,
  detail: string,
): WellbeingComponent {
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  return {
    weight,
    score,
    contribution: Math.round(score * weight * 100) / 100,
    detail,
  };
}

function bandFor(score: number): 'building' | 'steady' | 'thriving' {
  if (score >= 80) return 'thriving';
  if (score >= 60) return 'steady';
  return 'building';
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
