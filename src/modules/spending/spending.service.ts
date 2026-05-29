import { Inject, Injectable } from '@nestjs/common';
import {
  PAYROLL_ADAPTER,
  type PayrollAdapter,
} from '../../integrations/payroll/payroll.adapter';
import { BalanceService } from '../ewa/balance.service';
import { SavingsService } from '../savings/savings.service';

export interface SpendingCategory {
  name: string;
  amount: number;
  color: string; // CSS colour for the bar chart
}

export interface SpendingTransaction {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  daysAgo: number;
}

export interface SpendingResponse {
  total_income: number;
  total_spent: number;
  remaining: number;
  categories: SpendingCategory[];
  transactions: SpendingTransaction[];
  estimated_disclaimer: string;
}

// Estimated split of *net* pay across spending categories — typical
// pattern for a UK hospitality worker. These are descriptive; the
// real percentages can only be known via Open Banking. EWA and
// Savings are real figures (not estimated) — both come from
// services we own. "Other" balances the chart.
const CATEGORY_PERCENTS: Record<string, number> = {
  Housing: 0.35,
  'Food and drink': 0.15,
  Transport: 0.1,
  Entertainment: 0.08,
  Shopping: 0.07,
};

const CATEGORY_COLORS: Record<string, string> = {
  Housing: '#002747',
  'Food and drink': '#00B69F',
  Transport: '#8b5cf6',
  Entertainment: '#FAA51A',
  Shopping: '#e24b4a',
  'EWA accessed': '#34D9C0',
  Savings: '#9678B6',
  Other: '#647282',
};

const DISCLAIMER =
  'Spending estimates are based on typical patterns for your income. ' +
  'Connect your bank account for real spending data.';

// Per-persona seed transactions. Marcus's amounts are roughly 60% of
// Jordan's (he's part-time at £11.44/hr vs Jordan's £12.50/hr FT).
// Subscription prices (Netflix) stay at the real plan rate.
const TRANSACTIONS_JORDAN: SpendingTransaction[] = [
  { id: 'tx-j-1', merchant: 'Tesco',      amount: 34.5,  category: 'Food and drink', daysAgo: 3 },
  { id: 'tx-j-2', merchant: 'TfL',        amount: 12.8,  category: 'Transport',      daysAgo: 4 },
  { id: 'tx-j-3', merchant: 'Netflix',    amount: 10.99, category: 'Entertainment',  daysAgo: 5 },
  { id: 'tx-j-4', merchant: 'Rent',       amount: 650,   category: 'Housing',        daysAgo: 8 },
  { id: 'tx-j-5', merchant: 'Deliveroo',  amount: 18.4,  category: 'Food and drink', daysAgo: 9 },
  { id: 'tx-j-6', merchant: 'H&M',        amount: 45.0,  category: 'Shopping',       daysAgo: 12 },
  { id: 'tx-j-7', merchant: 'EDF Energy', amount: 89.0,  category: 'Housing',        daysAgo: 14 },
  { id: 'tx-j-8', merchant: 'Uber',       amount: 9.6,   category: 'Transport',      daysAgo: 15 },
];

const TRANSACTIONS_MARCUS: SpendingTransaction[] = [
  { id: 'tx-m-1', merchant: 'Lidl',         amount: 22.4,  category: 'Food and drink', daysAgo: 3 },
  { id: 'tx-m-2', merchant: 'TfL',          amount: 8.4,   category: 'Transport',      daysAgo: 4 },
  { id: 'tx-m-3', merchant: 'Netflix',      amount: 10.99, category: 'Entertainment',  daysAgo: 5 },
  { id: 'tx-m-4', merchant: 'Rent (room)',  amount: 425,   category: 'Housing',        daysAgo: 8 },
  { id: 'tx-m-5', merchant: 'Greggs',       amount: 6.2,   category: 'Food and drink', daysAgo: 9 },
  { id: 'tx-m-6', merchant: 'Primark',      amount: 18.0,  category: 'Shopping',       daysAgo: 12 },
  { id: 'tx-m-7', merchant: 'British Gas',  amount: 54.0,  category: 'Housing',        daysAgo: 14 },
  { id: 'tx-m-8', merchant: 'Bus pass',     amount: 5.6,   category: 'Transport',      daysAgo: 15 },
];

// FAIDs match the seed in MockEmployeeAccountReader. New personas
// fall through to Jordan's seed — these are demo fixtures.
const MARCUS_FAID = 'MARCUSTHOMPSON000001';

@Injectable()
export class SpendingService {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly savingsService: SavingsService,
    @Inject(PAYROLL_ADAPTER) private readonly payroll: PayrollAdapter,
  ) {}

  async getSpending(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<SpendingResponse> {
    const [balance, period, pots] = await Promise.all([
      this.balanceService.getBalance(input),
      this.payroll.getPayPeriodConfig(input),
      // Pot lookup is best-effort — if the employee has none, fall
      // back to an empty array rather than 404.
      this.savingsService.listPots(input.fourthEmployeeId).catch(
        () => [] as Awaited<ReturnType<SavingsService['listPots']>>,
      ),
    ]);

    const grossEarned = balance.earnedAmount;
    const netPay = round2(grossEarned * (1 - period.averageDeductionRate));

    // EWA + Savings come straight from real data. Pot balances stand
    // in for "savings contributions this period" — in production this
    // would be a per-period rollup, but the seed pots are scoped to
    // the demo's pay-period anyway.
    const ewaAccessed = round2(balance.accessedAmount);
    const savingsContrib = round2(pots.reduce((sum, p) => sum + p.balance, 0));

    const housing = round2(netPay * CATEGORY_PERCENTS.Housing);
    const food = round2(netPay * CATEGORY_PERCENTS['Food and drink']);
    const transport = round2(netPay * CATEGORY_PERCENTS.Transport);
    const entertainment = round2(netPay * CATEGORY_PERCENTS.Entertainment);
    const shopping = round2(netPay * CATEGORY_PERCENTS.Shopping);
    const namedTotal = housing + food + transport + entertainment + shopping + ewaAccessed + savingsContrib;

    // total_spent intended as 70% of net pay (typical UK hospitality
    // pattern). But the categorical breakdown alone is 75% of net pay
    // before EWA/Savings — so we floor total_spent at the sum of the
    // categories. Same for "Other": ≥0. This keeps the bar chart in
    // sync with the headline figure.
    const targetSpend = round2(netPay * 0.7);
    const other = Math.max(0, round2(targetSpend - namedTotal));
    const totalSpent = round2(namedTotal + other);
    const remaining = round2(grossEarned - totalSpent);

    const categories: SpendingCategory[] = [
      { name: 'Housing',        amount: housing,        color: CATEGORY_COLORS.Housing },
      { name: 'Food and drink', amount: food,           color: CATEGORY_COLORS['Food and drink'] },
      { name: 'Transport',      amount: transport,      color: CATEGORY_COLORS.Transport },
      { name: 'Entertainment',  amount: entertainment,  color: CATEGORY_COLORS.Entertainment },
      { name: 'Shopping',       amount: shopping,       color: CATEGORY_COLORS.Shopping },
      { name: 'EWA accessed',   amount: ewaAccessed,    color: CATEGORY_COLORS['EWA accessed'] },
      { name: 'Savings',        amount: savingsContrib, color: CATEGORY_COLORS.Savings },
      { name: 'Other',          amount: other,          color: CATEGORY_COLORS.Other },
    ];

    const transactions =
      input.fourthEmployeeId === MARCUS_FAID ? TRANSACTIONS_MARCUS : TRANSACTIONS_JORDAN;

    return {
      total_income: round2(grossEarned),
      total_spent: totalSpent,
      remaining,
      categories,
      transactions,
      estimated_disclaimer: DISCLAIMER,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
