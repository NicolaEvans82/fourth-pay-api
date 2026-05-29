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

// Static catalogue — 54 partners across 7 categories. Hand-picked for
// relevance to a UK hospitality workforce. Production should move this
// to a CMS or partner-management table; inline as a prototype fixture.
//
// Discount levels are realistic for UK employee-benefits programmes:
// restaurant chains 10–20%, supermarkets 4–6% (thin-margin), travel
// 5–15%, fitness fixed-£ off or first-months %, streaming free
// months, retail 5–15%, wellbeing 20–50% (especially apps).
const CATEGORIES: DiscountCategory[] = [
  {
    name: 'Food & drink',
    discounts: [
      { name: 'Greggs',         description: '10% off in-store food and drink', percentOff: 10, redemption: 'code',   code: 'FOURTH10',  accentBg: '#00539f', accentFg: 'white' },
      { name: 'Costa Coffee',   description: '20% off all hot drinks every day', percentOff: 20, redemption: 'in-app', accentBg: '#751c30', accentFg: 'white' },
      { name: "McDonald's",     description: "20% off when you order via the McDonald's app", percentOff: 20, redemption: 'code',   code: 'FOURTHMCD', accentBg: '#ffc72c', accentFg: '#1a1a1a' },
      { name: 'Subway',         description: '15% off any Sub or Salad', percentOff: 15, redemption: 'code',   code: 'FOURTHSUB',  accentBg: '#008c15', accentFg: 'white' },
      { name: "Nando's",        description: '10% off the bill, dine-in or takeaway', percentOff: 10, redemption: 'in-app', accentBg: '#dc241f', accentFg: 'white' },
      { name: 'Pizza Hut',      description: '25% off pizzas at any restaurant', percentOff: 25, redemption: 'code',   code: 'FOURTHPH',   accentBg: '#ed1c24', accentFg: 'white' },
      { name: 'KFC',            description: '£3 off any bucket order', percentOff: null, redemption: 'code',   code: 'FOURTHKFC',  accentBg: '#f40027', accentFg: 'white' },
      { name: "Domino's",       description: '30% off when you spend over £20 online', percentOff: 30, redemption: 'code',   code: 'FOURTH30',   accentBg: '#006491', accentFg: 'white' },
      { name: 'Wagamama',       description: '15% off the bill, any day', percentOff: 15, redemption: 'in-app', accentBg: '#ff0000', accentFg: 'white' },
      { name: 'Pret a Manger',  description: '10% off your daily lunch run', percentOff: 10, redemption: 'in-app', accentBg: '#862633', accentFg: 'white' },
      { name: 'Caffe Nero',     description: 'Free pastry with any drink Mon–Fri', percentOff: null, redemption: 'in-app', accentBg: '#1c2d2a', accentFg: 'white' },
      { name: 'Starbucks',      description: '15% off every drink in-store', percentOff: 15, redemption: 'in-app', accentBg: '#006241', accentFg: 'white' },
    ],
  },
  {
    name: 'Supermarkets',
    discounts: [
      { name: 'Tesco',          description: '5% off your weekly shop in-store and online', percentOff: 5, redemption: 'code', code: 'FOURTHTSC', accentBg: '#00539f', accentFg: 'white' },
      { name: "Sainsbury's",    description: '4% off groceries at any branch', percentOff: 4, redemption: 'code', code: 'FOURTHSAINS', accentBg: '#f06c00', accentFg: 'white' },
      { name: 'Lidl',           description: '£5 off a £40 shop', percentOff: null, redemption: 'code', code: 'FOURTH5LIDL', accentBg: '#0050aa', accentFg: '#ffe500' },
      { name: 'Aldi',           description: '£5 off a £40 shop', percentOff: null, redemption: 'code', code: 'FOURTH5ALDI', accentBg: '#1f3266', accentFg: 'white' },
      { name: 'Morrisons',      description: '4% off groceries with My Morrisons', percentOff: 4, redemption: 'in-app', accentBg: '#00733e', accentFg: '#ffe500' },
      { name: 'Co-op',          description: '5% off own-brand groceries', percentOff: 5, redemption: 'in-app', accentBg: '#00b1e7', accentFg: 'white' },
      { name: 'Iceland',        description: '£3 off a £30 frozen shop', percentOff: null, redemption: 'code', code: 'FOURTHICE', accentBg: '#cc092f', accentFg: 'white' },
    ],
  },
  {
    name: 'Travel',
    discounts: [
      { name: 'National Express', description: '15% off coach travel UK-wide', percentOff: 15, redemption: 'code', code: 'FOURTH15', accentBg: '#01357b', accentFg: 'white' },
      { name: 'Trainline',        description: 'Save up to 12% on rail tickets', percentOff: 12, redemption: 'link', accentBg: '#00a991', accentFg: 'white' },
      { name: 'Uber',             description: '20% off your next 5 rides', percentOff: 20, redemption: 'code', code: 'FOURTHUBER', accentBg: '#000000', accentFg: 'white' },
      { name: 'Zipcar',           description: '£25 driving credit on your first month', percentOff: null, redemption: 'link', accentBg: '#008a5e', accentFg: 'white' },
      { name: 'Europcar',         description: '10% off any UK car hire', percentOff: 10, redemption: 'code', code: 'FOURTH10EUR', accentBg: '#009530', accentFg: 'white' },
      { name: 'Booking.com',      description: '10% Genius rate on selected stays', percentOff: 10, redemption: 'link', accentBg: '#003580', accentFg: 'white' },
      { name: 'Premier Inn',      description: '£8 off any midweek stay', percentOff: null, redemption: 'code', code: 'FOURTHPI8', accentBg: '#4b306a', accentFg: 'white' },
      { name: 'Travelodge',       description: '15% off rooms booked 7+ days ahead', percentOff: 15, redemption: 'code', code: 'FOURTHTRV', accentBg: '#e6007e', accentFg: 'white' },
    ],
  },
  {
    name: 'Fitness',
    discounts: [
      { name: 'PureGym',         description: '£5/month off any membership tier', percentOff: null, redemption: 'code', code: 'FOURTHPG', accentBg: '#ffd000', accentFg: '#1a1a1a' },
      { name: 'The Gym Group',   description: '20% off your first 3 months', percentOff: 20, redemption: 'code', code: 'FOURTHGYM', accentBg: '#e60026', accentFg: 'white' },
      { name: 'Hussle',          description: '£10 off the monthly multi-gym pass', percentOff: null, redemption: 'code', code: 'FOURTHHUSL', accentBg: '#ff3300', accentFg: 'white' },
      { name: 'Anytime Fitness', description: 'No joining fee — saves you £49', percentOff: null, redemption: 'link', accentBg: '#6e2c91', accentFg: 'white' },
      { name: 'Nuffield Health', description: '15% off corporate gym + pool membership', percentOff: 15, redemption: 'link', accentBg: '#003087', accentFg: 'white' },
    ],
  },
  {
    name: 'Entertainment',
    discounts: [
      { name: 'Cineworld',     description: '£3 off tickets, all venues', percentOff: null, redemption: 'in-app', accentBg: '#003c71', accentFg: 'white' },
      { name: 'Vue Cinemas',   description: '£4 standard tickets every Tuesday', percentOff: null, redemption: 'in-app', accentBg: '#1e1e1e', accentFg: 'white' },
      { name: 'Odeon',         description: '25% off all bookings via Limitless', percentOff: 25, redemption: 'code', code: 'FOURTHODN', accentBg: '#b40a0e', accentFg: 'white' },
      { name: 'Spotify',       description: '3 months free on Premium Individual', percentOff: 100, redemption: 'link', accentBg: '#1db954', accentFg: 'white' },
      { name: 'Amazon Prime',  description: '6-month free trial on Prime', percentOff: 100, redemption: 'link', accentBg: '#00a8e1', accentFg: 'white' },
      { name: 'Disney+',       description: '£2/month off Standard for 12 months', percentOff: null, redemption: 'code', code: 'FOURTHDIS', accentBg: '#113ccf', accentFg: 'white' },
      { name: 'NOW TV',        description: '25% off the Entertainment Membership', percentOff: 25, redemption: 'link', accentBg: '#00a6d6', accentFg: 'white' },
      { name: 'Sky Sports',    description: '£10/month off Sky Sports Mobile', percentOff: null, redemption: 'code', code: 'FOURTHSKY', accentBg: '#f2545b', accentFg: 'white' },
    ],
  },
  {
    name: 'Retail',
    discounts: [
      { name: 'Boots',     description: '10% off health & beauty essentials', percentOff: 10, redemption: 'code', code: 'FOURTHBOOTS', accentBg: '#005eb8', accentFg: 'white' },
      { name: 'Argos',     description: '£5 off a £50 spend', percentOff: null, redemption: 'code', code: 'FOURTH5OFF', accentBg: '#ed1c24', accentFg: 'white' },
      { name: 'ASOS',      description: '15% off your next order over £50', percentOff: 15, redemption: 'code', code: 'FOURTHASOS', accentBg: '#000000', accentFg: 'white' },
      { name: 'Next',      description: '£10 off when you spend £75 or more', percentOff: null, redemption: 'code', code: 'FOURTHNEXT', accentBg: '#000000', accentFg: 'white' },
      { name: 'Currys',    description: '10% off tech accessories in-store', percentOff: 10, redemption: 'code', code: 'FOURTHCUR', accentBg: '#4a88c7', accentFg: 'white' },
      { name: 'Amazon',    description: '£15 off a £75 shop, selected categories', percentOff: null, redemption: 'code', code: 'FOURTHAMZ', accentBg: '#ff9900', accentFg: '#232f3e' },
      { name: 'H&M',       description: '15% off everything in-store and online', percentOff: 15, redemption: 'code', code: 'FOURTHHM', accentBg: '#e50010', accentFg: 'white' },
      { name: 'New Look',  description: '20% off full-price clothing', percentOff: 20, redemption: 'code', code: 'FOURTHNL', accentBg: '#ff1493', accentFg: 'white' },
      { name: 'TK Maxx',   description: '£5 off when you spend over £40', percentOff: null, redemption: 'code', code: 'FOURTHTKX', accentBg: '#bb1b30', accentFg: 'white' },
    ],
  },
  {
    name: 'Wellbeing',
    discounts: [
      { name: 'Headspace',         description: '30% off Headspace Plus annual', percentOff: 30, redemption: 'link', accentBg: '#f47d31', accentFg: 'white' },
      { name: 'Calm',              description: '40% off Calm Premium first year', percentOff: 40, redemption: 'link', accentBg: '#2e5bff', accentFg: 'white' },
      { name: 'Holland & Barrett', description: '15% off vitamins and supplements', percentOff: 15, redemption: 'code', code: 'FOURTHHB', accentBg: '#00563f', accentFg: 'white' },
      { name: 'Specsavers',        description: '25% off a complete pair of glasses', percentOff: 25, redemption: 'code', code: 'FOURTHSPEC', accentBg: '#008b5c', accentFg: 'white' },
      { name: 'Vision Express',    description: '20% off prescription eyewear', percentOff: 20, redemption: 'code', code: 'FOURTHVE', accentBg: '#003366', accentFg: 'white' },
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
