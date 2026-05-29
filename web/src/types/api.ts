// TypeScript shape definitions for the Fourth Pay API responses.
// These mirror the JSON returned by the Nest backend; when the
// backend changes a field name, update this file too. The backend
// uses camelCase for response keys throughout.

export type PersonaKey = 'jordan' | 'marcus';

export interface Persona {
  faid: string;
  employerId: string;
  firstName: string;
  fullName: string;
  role: string;
  initials: string;
}

// EWA Balance — GET /api/v1/ewa/balance
export interface BalanceResponse {
  availableAmount: number;
  earnedAmount: number;
  accessedAmount: number;
  monthlyLimitAmount?: number;
  perTransferLimitAmount?: number;
}

// EWA Earnings — GET /api/v1/ewa/earnings
export interface EarningsShift {
  startDateTime: string;
  endDateTime: string;
  elementName: string;
  hours: number;
  value: number;
}
export interface EarningsResponse {
  payPeriodStart: string;
  payPeriodEnd: string;
  summary: { grossEarned: number; availableAmount: number; accessedAmount: number };
  shifts: EarningsShift[];
}

// EWA Transfers — GET /api/v1/ewa/transfers
export interface Transfer {
  id: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  status: 'pending' | 'completed' | 'failed';
  transferSpeed: 'instant' | 'standard';
  initiatedAt: string;
  fcaReference?: string;
  estimatedArrival?: string;
}
export interface TransfersResponse {
  transfers: Transfer[];
}

// EWA Transfer — POST /api/v1/ewa/transfer
export interface TransferRequest {
  amount: number;
  transferSpeed: 'instant' | 'standard';
  fcaDisclosureAcknowledged: boolean;
}
export interface TransferResult {
  id: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  fcaReference: string;
  status: string;
  estimatedArrival: string;
}

// Shifts — GET /api/v1/shifts
export interface UpcomingShift {
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  role?: string;
  site?: string;
}
export interface RecentShift {
  date: string;
  hours: number;
  earnings: number;
  elementType?: string;
  site?: string;
}
export interface ShiftsResponse {
  weeklySummary?: {
    weekStart: string;
    weekEnd: string;
    shiftCount: number;
    totalHours: number;
    totalEarnings: number;
  };
  upcoming: UpcomingShift[];
  recent: RecentShift[];
}

// Budget — GET /api/v1/budget
export interface BudgetEnvelope {
  allocated: number;
  used: number;
  remaining: number;
}
export interface BudgetResponse {
  payPeriodStart: string;
  monthlyEarnings: number;
  needs: BudgetEnvelope;
  wants: BudgetEnvelope;
  savings: BudgetEnvelope;
}

// Wellbeing — GET /api/v1/wellbeing/score
export interface WellbeingComponent {
  score: number;
  weight: number;
  detail: string;
}
export interface WellbeingResponse {
  score: number;
  band: 'thriving' | 'steady' | 'building';
  components: {
    savings?: WellbeingComponent;
    monthlyLimit?: WellbeingComponent;
    transferFrequency?: WellbeingComponent;
    coolingOff?: WellbeingComponent;
  };
}

// Benefits — GET /api/v1/benefits
export interface BenefitsResponse {
  holiday: { eligible: boolean; accruedDays: number; annualDays: number; detail: string };
  sickPay: { eligible: boolean; detail: string };
  pension: { autoEnrolEligible: boolean; detail: string };
  nmwCompliance: { compliant: boolean; yourRate: number; detail: string };
  maternityPaternity: { eligible: boolean; detail: string };
}

// Discounts — GET /api/v1/discounts
export interface Discount {
  name: string;
  description: string;
  percentOff: number | null;
  redemption: 'in-app' | 'code' | 'link';
  code?: string;
  accentBg?: string;
  accentFg?: string;
}
export interface DiscountsResponse {
  categories: { name: string; discounts: Discount[] }[];
  employerPerks: { name: string; description: string; value: string }[];
}

// Pension — GET /api/v1/pension
export interface PensionScenario {
  newEmployeePercent: number;
  extraMonthlyCost: number;
  projectedPot: number;
  potUplift: number;
}
export interface PensionResponse {
  autoEnrolmentStatus: 'enrolled' | 'eligible' | 'below_threshold' | 'opted_out';
  currentContributionPercent: number;
  employerContributionPercent: number;
  totalMonthlyContribution: number;
  projectedPot: number;
  governmentTracingUrl: string;
  lostPensionNudge: boolean;
  detail: {
    referenceGrossPay: number;
    yearsToRetirement: number;
  };
  increaseScenarios: PensionScenario[];
}

// Payslips — GET /api/v1/payslips
export interface Payslip {
  payPeriodStart: string;
  payPeriodEnd: string;
  paymentDate: string;
  grossPay: number;
  netPay: number;
  totalDeductions?: number;
}
export interface PayslipsResponse {
  payslips: Payslip[];
}

// Self-controls — GET / PUT /api/v1/self-controls
export interface SelfControls {
  monthlyLimitEnabled: boolean;
  monthlyLimitAmount: number | null;
  perTransferLimitEnabled: boolean;
  perTransferLimitAmount: number | null;
  coolingOffEnabled: boolean;
  coolingOffHours: number;
  autoSaveEnabled: boolean;
  autoSavePercent: number;
  wellbeingNudgesEnabled: boolean;
}

// Notifications — GET /api/v1/notifications
export type NotifCategory = 'pay' | 'savings' | 'payslip' | 'wellbeing' | 'pension' | 'bills' | 'system';
export type NotifUrgency = 'urgent' | 'warning' | 'info';
export interface Notification {
  id: string;
  category: NotifCategory;
  urgency: NotifUrgency;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
  ctaLabel?: string;
  ctaScreen?: string;
}
export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

// Coach — POST /api/v1/coach/message
export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface CoachRequest {
  message: string;
  conversationHistory: CoachMessage[];
}
export interface CoachResponse {
  reply: string;
}

// Learning — GET /api/v1/learning
export type LearningCategory = 'budgeting' | 'saving' | 'debt' | 'pensions' | 'benefits';
export interface LearningArticle {
  id: string;
  title: string;
  summary: string;
  readTimeMinutes: number;
  category: LearningCategory;
  content: string[];
}
export interface LearningCategoryGroup {
  category: LearningCategory;
  label: string;
  emoji: string;
  articles: LearningArticle[];
}
export interface LearningResponse {
  categories: LearningCategoryGroup[];
}

// Spending — GET /api/v1/spending
export interface SpendingCategory {
  name: string;
  amount: number;
  color: string;
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

// Employer stats — GET /api/v1/employer/stats
export interface EmployerStats {
  total_employees_enrolled: number;
  percent_of_workforce_active: number;
  total_transfers_this_month: number;
  total_amount_accessed_this_month: number;
  average_transfer_amount: number;
  fee_revenue_this_month: number;
  daily_access_amounts: { date: string; amount: number }[];
}
