import { Inject, Injectable } from '@nestjs/common';
import {
  HR_ADAPTER,
  type EmployerPerk,
  type HrAdapter,
} from '../../integrations/hr/hr.adapter';

export interface Discount {
  name: string;
  description: string;
  percentOff: number | null;
  // Where the user redeems. 'in-app' = handled by Fourth Pay; 'code'
  // = display a static code; 'link' = external partner site.
  redemption: 'in-app' | 'code' | 'link';
  code?: string;
  // Visual colour for the category chip in the UI. Keeps the
  // back-end opinionated about brand recognition without the
  // frontend needing a lookup table.
  accentBg?: string;
  accentFg?: string;
}

export interface DiscountCategory {
  name: string;
  discounts: Discount[];
}

export interface DiscountsResponse {
  categories: DiscountCategory[];
  employerPerks: EmployerPerk[];
}

// Static catalogue — 10 partners across 5 categories. Hand-picked
// for relevance to a UK hospitality workforce. Production should
// move this to a CMS or partner-management table, but as a
// fixture for the prototype it's fine inline.
const CATEGORIES: DiscountCategory[] = [
  {
    name: 'Food & drink',
    discounts: [
      {
        name: 'Greggs',
        description: '10% off in-store food and drink',
        percentOff: 10,
        redemption: 'code',
        code: 'FOURTH10',
        accentBg: '#00539f',
        accentFg: 'white',
      },
      {
        name: 'Costa Coffee',
        description: '20% off all hot drinks every day',
        percentOff: 20,
        redemption: 'in-app',
        accentBg: '#751c30',
        accentFg: 'white',
      },
    ],
  },
  {
    name: 'Travel',
    discounts: [
      {
        name: 'National Express',
        description: '15% off coach travel UK-wide',
        percentOff: 15,
        redemption: 'code',
        code: 'FOURTH15',
        accentBg: '#01357b',
        accentFg: 'white',
      },
      {
        name: 'Trainline',
        description: 'Save up to 12% on rail tickets',
        percentOff: 12,
        redemption: 'link',
        accentBg: '#00a991',
        accentFg: 'white',
      },
    ],
  },
  {
    name: 'Fitness',
    discounts: [
      {
        name: 'PureGym',
        description: '£5/month off any membership tier',
        percentOff: null,
        redemption: 'code',
        code: 'FOURTHPG',
        accentBg: '#ffd000',
        accentFg: '#1a1a1a',
      },
      {
        name: 'The Gym Group',
        description: '20% off your first 3 months',
        percentOff: 20,
        redemption: 'code',
        code: 'FOURTHGYM',
        accentBg: '#e60026',
        accentFg: 'white',
      },
    ],
  },
  {
    name: 'Entertainment',
    discounts: [
      {
        name: 'Cineworld',
        description: '£3 off tickets, all venues',
        percentOff: null,
        redemption: 'in-app',
        accentBg: '#003c71',
        accentFg: 'white',
      },
      {
        name: 'Spotify',
        description: '3 months free on Premium Individual',
        percentOff: 100,
        redemption: 'link',
        accentBg: '#1db954',
        accentFg: 'white',
      },
    ],
  },
  {
    name: 'Retail',
    discounts: [
      {
        name: 'Boots',
        description: '10% off health & beauty essentials',
        percentOff: 10,
        redemption: 'code',
        code: 'FOURTHBOOTS',
        accentBg: '#005eb8',
        accentFg: 'white',
      },
      {
        name: 'Argos',
        description: '£5 off a £50 spend',
        percentOff: null,
        redemption: 'code',
        code: 'FOURTH5OFF',
        accentBg: '#ed1c24',
        accentFg: 'white',
      },
    ],
  },
];

@Injectable()
export class DiscountsService {
  constructor(@Inject(HR_ADAPTER) private readonly hr: HrAdapter) {}

  async getDiscounts(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<DiscountsResponse> {
    // Fetch via the existing eligibility call so we get the employer
    // config (which carries the perks slot). The eligibility check
    // is also where every other HR-derived screen pulls config from
    // — keeps the read path consistent.
    const eligibility = await this.hr.checkEligibility(input);
    return {
      categories: CATEGORIES,
      employerPerks: eligibility.employerConfig.perks ?? [],
    };
  }
}
