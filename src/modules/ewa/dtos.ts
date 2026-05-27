export interface TransferRequestBody {
  amount: number;
  transferSpeed: 'instant' | 'standard';
  bankAccountId?: string | null;
  fcaDisclosureAcknowledged: boolean;
}

export interface TransferResponse {
  transferId: string;
  status: string;
  feeAmount: number;
  netAmount: number;
  estimatedArrival: string;
  fcaReference: string;
}

export interface BalanceResponse {
  availableAmount: number;
  earnedAmount: number;
  accessedAmount: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  nextPayday: string;
  employerSubsidy: boolean;
  monthlyLimitRemaining: number | null;
}

export interface TransferListItem {
  id: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  transferSpeed: string;
  status: string;
  initiatedAt: string;
  completedAt: string | null;
}

export interface TransferListResponse {
  transfers: TransferListItem[];
  totalAccessedThisPeriod: number;
}
