export type TransferSpeed = 'instant' | 'standard' | 'gift_card';

// Gift card partners surfaced in the Get Paid Now flow. Slugs match
// the discount-catalogue brand keys (lower-case, no spaces) so the
// UI can map back to the right brand colour and logo. Six partners
// today — Costa is in the food-and-drink catalogue, the rest are
// retail / supermarket. Extending the allow-list requires adding
// the brand to both this enum and the partner grid in
// GetPaidScreen.tsx.
export const GIFT_CARD_PARTNERS = [
  'tesco',
  'costa',
  'amazon',
  'boots',
  'argos',
  'asos',
] as const;
export type GiftCardPartner = (typeof GIFT_CARD_PARTNERS)[number];

export interface TransferRequestBody {
  amount: number;
  transferSpeed: TransferSpeed;
  bankAccountId?: string | null;
  // Required when transferSpeed === 'gift_card'. Defaults to 'tesco'
  // server-side if omitted, so the field can stay optional in the
  // wire shape.
  giftCardPartner?: GiftCardPartner;
  fcaDisclosureAcknowledged: boolean;
}

export interface TransferResponse {
  transferId: string;
  status: string;
  feeAmount: number;
  feeDescription: string;
  netAmount: number;
  estimatedArrival: string;
  fcaReference: string;
  // Echoed back only when the user selected a gift card; null
  // otherwise so the response shape stays predictable.
  giftCardPartner: GiftCardPartner | null;
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
