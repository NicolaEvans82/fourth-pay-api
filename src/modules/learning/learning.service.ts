import { Injectable, NotFoundException } from '@nestjs/common';

export type LearningCategory =
  | 'budgeting'
  | 'saving'
  | 'debt'
  | 'pensions'
  | 'benefits';

export interface Article {
  id: string;
  title: string;
  summary: string;
  readTimeMinutes: number;
  category: LearningCategory;
  content: string[];
}

export interface CategoryGroup {
  category: LearningCategory;
  label: string;
  emoji: string;
  articles: Article[];
}

export interface LearningResponse {
  categories: CategoryGroup[];
}

// Categories are surfaced in this order — broadly the order most
// hospitality workers benefit from learning in.
const CATEGORY_META: Record<
  LearningCategory,
  { label: string; emoji: string }
> = {
  budgeting: { label: 'Budgeting', emoji: '💰' },
  saving: { label: 'Saving', emoji: '🐷' },
  debt: { label: 'Debt', emoji: '⚖️' },
  pensions: { label: 'Pensions', emoji: '🏦' },
  benefits: { label: 'Benefits', emoji: '📋' },
};

// Articles are written specifically for UK hospitality workers. Every
// figure must be verified against the date in the article (NMW, SSP,
// auto-enrolment thresholds, etc.). When updating rates each April,
// search this file for £ amounts and check them against the new
// gov.uk values.
const ARTICLES: Article[] = [
  // ────────────────────── BUDGETING ──────────────────────
  {
    id: 'making-your-pay-go-further',
    title: 'Making your pay go further',
    summary:
      'Hospitality wages stretch further when you treat essentials, transport and food as one bucket — not three. Three tactics that pay back the same week you try them.',
    readTimeMinutes: 3,
    category: 'budgeting',
    content: [
      'Hospitality pay is harder to manage than office pay because the inputs move every week — shift counts vary, tips swing, and payslips sometimes land late. The fix is structure, not willpower: decide where each pound goes the day it arrives, not the day you need it.',
      "The 'essentials first' approach is simple — on payday, immediately move rent, bills, transport and food money out of your current account into a separate pot. What's left is yours to spend. That stops fixed costs being eaten by the first Friday after payday.",
      'Three tactics specific to shift work that pay back fast: meal-plan around your shifts (a £4 microwave meal at work beats a £12 Deliveroo on the way home), buy off-peak rail or bus tickets the moment your rota is published, and never miss your free staff meal — most contracts entitle you to one and many people forget to claim it.',
      "One quick win: on the next payday, open your bank app and review every direct debit. Cancel anything you haven't actively used in 30 days. The average person finds £15–£25/month of subscriptions they'd forgotten about.",
    ],
  },
  {
    id: 'the-50-30-20-rule-explained',
    title: 'The 50/30/20 rule explained',
    summary:
      "It splits every pay packet into 50% needs, 30% wants, 20% savings or debt. Works on variable income too — you just apply it to your average month, not each week's pay.",
    readTimeMinutes: 4,
    category: 'budgeting',
    content: [
      "The 50/30/20 rule is the simplest workable budget that exists. Half your take-home pay covers 'needs' (rent, bills, transport, basic food), 30% covers 'wants' (eating out, clothes, streaming, nights out), and 20% goes to savings or paying down debt.",
      "Shift workers worry it doesn't apply to them because pay varies. It does — just apply it to your three-month average take-home rather than each week's pay packet. Lean weeks dip into the savings buffer; busy weeks rebuild it.",
      "Adjust it to your situation. In high-rent cities you might run 60/20/20 because rent alone eats more than half. If you're paying off bad debt, flip it to 50/20/30 with the extra 10% going to whichever debt has the highest APR. The split is a starting point, not a law.",
      "Quick start in Fourth Pay: open three savings pots — 'Bills', 'Spending', and 'Save & repay'. On payday, move 50%, 30% and 20% into them respectively. You're done in under a minute and the rest of the month takes care of itself.",
    ],
  },
  {
    id: 'how-to-stop-running-out-of-money-before-payday',
    title: 'How to stop running out of money before payday',
    summary:
      "Running out before payday usually isn't an income problem — it's a timing problem. Three changes that smooth out the cycle without earning a penny more.",
    readTimeMinutes: 4,
    category: 'budgeting',
    content: [
      "Most people who run out before payday don't have a spending problem — they have a timing problem. Direct debits cluster around the same date, social spending front-loads the first week, and by week three the buffer is gone.",
      "Move your direct debits. Call each provider — water, council tax, gas, electricity, mobile, broadband — and ask to switch the payment date to mid-month, or to split into smaller weekly amounts. Most will say yes; they prefer reliable smaller payments to bounced ones.",
      "Try the 'weekly allowance' trick: on payday, withdraw one week's spending money in cash and lock your card away. When the cash runs out, you stop. It sounds old-fashioned but it works because cash is psychologically painful to spend in a way that contactless isn't.",
      "When does Fourth Pay's earned wage access help, and when doesn't it? It's useful for a genuine one-off (a boiler breaking, a child's birthday). It's a warning sign if you're using it every pay period — that means your essentials don't fit into your normal pay, and the answer is restructuring bills, not advancing wages.",
    ],
  },

  // ────────────────────── SAVING ──────────────────────
  {
    id: 'why-even-ten-pounds-a-month-matters',
    title: 'Why even £10 a month matters',
    summary:
      "£10/month at 4.5% AER becomes £673 in five years. The point isn't the amount — it's the habit. Start tiny and let compounding do the work.",
    readTimeMinutes: 3,
    category: 'saving',
    content: [
      "£10 a month feels too small to bother with. Run the numbers: at 4.5% AER, £10/month becomes £673 after five years and £1,510 after ten. The habit matters more than the amount — once it's automatic, scaling it up is easy.",
      "The first £10 is the hardest because it requires deciding to do it. Every month after that is automatic. People who save £10 consistently almost always end up saving £50 within a year — because the friction of starting is what stops most savers, not the cost.",
      "Where to start: a round-up rule moves money you wouldn't notice anyway. Spend £3.20 on coffee, 80p goes to savings. Spend £6.50 on lunch, 50p goes to savings. You'll typically save £15–£25 a month without changing anything you do.",
      "One trick that works: on each payday, save the pence after the decimal point. £1,247.83 lands? Move £0.83 into savings. The amounts feel like nothing but you've now saved something every single payday, which is the habit that compounds.",
    ],
  },
  {
    id: 'building-an-emergency-fund-on-a-low-income',
    title: 'Building an emergency fund on a low income',
    summary:
      "Don't aim for '3–6 months of expenses' — that goal kills motivation. Aim for one month's rent and bills first. Practical steps for going from £0 to £500.",
    readTimeMinutes: 4,
    category: 'saving',
    content: [
      "Most personal finance advice tells you to save 3–6 months of expenses. On hospitality pay that's a number so big it kills motivation before you start. A better first target is one month's rent plus essential bills — for most people, £400 to £800.",
      "How to start with £0 in the account: sell unused stuff via Vinted, eBay or Facebook Marketplace (most people have £100–£300 of clothes, tech and books gathering dust). If you get any tax rebate, holiday pay-out, or one-off bonus, route it directly to savings before it touches your spending account.",
      "Where to keep it matters. Put it in a separate pot you can reach same-day (a Fourth Pay savings pot, an instant-access savings account) but don't see when you open your usual banking app. Out of sight, out of mind — that's the point.",
      "The rule for spending it: only genuine emergencies — boiler, car repair, unpaid sick leave, an unexpected bill that would otherwise go on a credit card. Anything else is a 'wants' purchase, even if it feels urgent in the moment. After every withdrawal, the next priority is rebuilding the pot before anything else.",
    ],
  },
  {
    id: 'round-up-saving-how-small-amounts-add-up',
    title: 'Round-up saving — how small amounts add up',
    summary:
      'Every card spend rounds up to the nearest £1 and the difference saves automatically. Most users save £15–£25 a month without any change to their lifestyle.',
    readTimeMinutes: 3,
    category: 'saving',
    content: [
      "Round-up saving works by adding a small amount to every card transaction and putting the difference into savings. Spend £3.20, save 80p. Spend £6.50, save 50p. It runs in the background — you don't decide to save, it just happens.",
      "The numbers add up faster than you'd expect. Average users save £15–£25 a month, which is £180–£300 a year. That's not enough to retire on, but it's a holiday, or the start of an emergency fund, or a Christmas you didn't have to put on a credit card.",
      "Why it beats willpower: every decision you don't have to make is a decision that can't go wrong. Most savings goals fail not because the amount is too high, but because the saver decides each month whether to keep going. Round-up removes that decision.",
      "One thing to watch — make sure the round-up pot is genuinely separate from your spending pot. If it lives next to your main balance, you'll dip into it on a tight Tuesday. The Fourth Pay round-up rule routes it to a named savings pot for exactly this reason.",
    ],
  },

  // ────────────────────── DEBT ──────────────────────
  {
    id: 'understanding-good-debt-vs-bad-debt',
    title: 'Understanding good debt vs bad debt',
    summary:
      'Good debt buys something that grows in value or earnings. Bad debt funds spending you could have skipped. APR over 25% is almost always bad.',
    readTimeMinutes: 4,
    category: 'debt',
    content: [
      "Not all debt is bad — but most of it is. Good debt buys something that grows in value or earnings: a mortgage, a student loan, a course that gets you a better-paid job. Over time, the asset you bought is worth more than the interest you paid.",
      "Bad debt funds spending. Credit card debt on takeaways, BNPL on clothes, payday loans on petrol — none of these build anything. You pay the price plus the interest plus the stress, and at the end you have nothing to show for it.",
      "APR (Annual Percentage Rate) is the clearest signal. Mortgages run 4–6%. Student loans are capped at RPI. Credit cards average 24–29%. Overdrafts are typically 35–40%. Payday loans run from 300% to over 1,000%. As a rough rule, anything over 25% APR should be treated as a red flag.",
      "If you have bad debt, attack the highest-APR debt first while paying minimums on everything else. This is the 'avalanche method' and it's mathematically the fastest way out. If you'd rather feel quick wins to stay motivated, pay off the smallest balance first instead ('snowball method') — slower in maths terms but it works for some people.",
    ],
  },
  {
    id: 'how-to-deal-with-an-unexpected-bill',
    title: 'How to deal with an unexpected bill',
    summary:
      "Don't reach for the credit card. There's almost always a hardship route — utility payment plans, council hardship funds, free debt advice — but you have to ask.",
    readTimeMinutes: 4,
    category: 'debt',
    content: [
      "When an unexpected bill lands, the first instinct is to put it on a credit card or take out a short-term loan. Both make the bill 30–60% more expensive over the next year. There's almost always a better route, but you have to ask for it.",
      "For utility bills, call the supplier and ask for a payment plan — Ofgem requires gas and electricity suppliers to offer one. For water, ask about WaterSure or your supplier's social tariff (Severn Trent, Thames Water and most others run one). These reduce bills by 30–50% if you're on a low income.",
      "For council tax, every council has a hardship fund — most people don't know it exists. Search '[your council name] council tax hardship fund' or 'discretionary housing payment'. You apply directly with the council; it's not a loan, it doesn't have to be paid back.",
      "For one-off costs like boiler repairs or car breakdowns, Citizens Advice (free, 0800 144 8848) and StepChange (free, 0800 138 1111) give debt advice and signpost to grant schemes you'd never find on your own. Avoid payday lenders even when they look respectable — the APRs are eye-watering and the rollover fees are designed to trap.",
    ],
  },
  {
    id: 'why-buy-now-pay-later-can-be-dangerous',
    title: 'Why buy-now-pay-later can be dangerous',
    summary:
      "BNPL feels like 0% finance, but the FCA classes it as credit. Three Klarna accounts at once mean you're paying next month's wages this month without realising.",
    readTimeMinutes: 4,
    category: 'debt',
    content: [
      "Buy-now-pay-later (Klarna, Clearpay, Laybuy) feels different from credit because it's marketed as splitting a payment, not borrowing. Legally, it's credit — the FCA brought it under regulation in 2025, and missed payments now hit your credit report the same way a credit card default would.",
      "The psychological trap: splitting a £200 purchase into 4 × £50 makes it feel affordable. But if you have three BNPL accounts running at the same time (clothes, electronics, furniture), you're now paying £150 every month against last month's spending — which has to come out of this month's wages.",
      "Most people don't track total BNPL debt across providers because each retailer only shows you what you owe them. Open every BNPL app and tally up the totals. Many users discover they owe £400–£600 they hadn't budgeted for.",
      "One safer rule: if you can't afford to pay in full today, you can't afford it on BNPL either. The 'later' is a debt you haven't planned for. If something genuinely is essential and you can't pay today, save up for it instead — even three months of saving is cheaper than getting trapped in a BNPL cycle.",
    ],
  },

  // ────────────────────── PENSIONS ──────────────────────
  {
    id: 'why-your-pension-matters-even-in-your-20s',
    title: 'Why your pension matters even in your 20s',
    summary:
      "£100/month from age 25 = roughly £180,000 at retirement. The same £100/month from age 35 = roughly £100,000. Starting 10 years earlier is worth £80,000.",
    readTimeMinutes: 5,
    category: 'pensions',
    content: [
      "Pensions feel like a problem for future-you, but the maths is brutal in favour of starting young. £100/month from age 25, with typical pension fund growth, reaches roughly £180,000 by age 67. The same £100/month started at age 35 reaches roughly £100,000. Those ten extra years are worth £80,000.",
      "Auto-enrolment makes this even better. When you put in £4, your employer is required to put in £3 and the government adds £1 in tax relief — so every £4 you save becomes £8 immediately, before any investment growth. There is no other investment in your life that gives you a 100% return on day one.",
      "Opting out of your workplace pension feels like a pay rise, but it isn't. You're refusing free money from your employer and HMRC every month. The 5% that doesn't appear in your take-home is replaced by 8% landing in your pension — that's a 60% boost on the amount you'd have saved alone.",
      "One easy compounding win: every time you get a pay rise, increase your pension contribution by 1%. You never feel it in your take-home because the rise covers it, but a few of these stacked across your career can add £60,000–£100,000 to your final pot.",
    ],
  },
  {
    id: 'what-is-auto-enrolment',
    title: 'What is auto-enrolment and what does it mean for you',
    summary:
      "If you're 22+ and earn £10,000+ from one job, your employer must enrol you. You pay 5% above £6,240, they add 3%, HMRC adds tax relief. Hospitality workers in two part-time jobs often miss out.",
    readTimeMinutes: 5,
    category: 'pensions',
    content: [
      "Auto-enrolment is the law that makes employers automatically put eligible workers into a pension. The rules: you must be 22 or over, earn at least £10,000 per year from one employer, and work in the UK. You contribute 5% of pay above £6,240; the employer adds 3% on the same band.",
      "Hospitality workers get caught out by this more than most. If you have two part-time jobs paying £8,000 each, you're not auto-enrolled in either — neither job hits the £10,000 threshold on its own. You can still opt *in* manually though, and your employer must still contribute 3%. Most people don't realise they can do this.",
      "If you've moved between jobs a lot (and most hospitality workers have), you may have several small pension pots scattered across previous employers. Each one keeps growing whether you remember it or not. The Pension Tracing Service (gov.uk/find-pension-contact-details, free) helps you find them.",
      "You can opt out of auto-enrolment any time — your employer must refund any contributions made in the first month if you opt out within that window. But employers are required by law to re-enrol everyone every three years. That isn't paperwork — it's because the government's evidence says most people who opt out come to regret it.",
    ],
  },
  {
    id: 'how-to-find-a-lost-pension',
    title: 'How to find a lost pension',
    summary:
      "Hospitality's high turnover means many workers have 4–6 small pension pots they've lost track of. The official Pension Tracing Service is free — don't pay anyone to do it for you.",
    readTimeMinutes: 4,
    category: 'pensions',
    content: [
      "Hospitality has some of the highest turnover of any UK industry. Many workers have had four to six jobs by age 30 and have no idea where their old workplace pensions are — but those pots are still there, still invested, and still growing.",
      "The free tool is the Pension Tracing Service at gov.uk/find-pension-contact-details. You'll need a list of your past employers and rough dates of employment. It searches a database of every UK workplace pension scheme and returns the contact details of whoever administers yours.",
      "Once you've found them, you have two choices. Leave them where they are (each pot grows independently but you'll be juggling multiple statements and fees), or consolidate them into one current pension for easier tracking. Consolidating is usually free but check for exit fees on older policies — anything before 2001 sometimes has them.",
      "Crucially: do not pay anyone to find your pensions for you. Several companies charge £200–£500 for 'pension tracing services' that just use the same free government tool. The HMRC and Pension Wise services are also free (Pension Wise offers free 1:1 advice if you're 50+). If you're being asked to pay upfront, walk away.",
    ],
  },

  // ────────────────────── BENEFITS ──────────────────────
  {
    id: 'benefits-you-might-not-know-youre-entitled-to',
    title: "Benefits you might not know you're entitled to",
    summary:
      "Universal Credit is available to many working people, not just the unemployed. Council Tax Reduction, free prescriptions and Help to Save are routinely missed by hospitality workers.",
    readTimeMinutes: 5,
    category: 'benefits',
    content: [
      "Universal Credit isn't just for people who aren't working — many low-paid hospitality workers qualify while working full-time and don't realise. As a rough guide, if you earn under around £1,000/month after tax and live alone, or under around £1,700 as a couple, it's worth a check. Use the calculator at entitledto.co.uk (free, anonymous).",
      "Council Tax Reduction (every council runs one, names vary) can cut your bill by 25–100% depending on income. If you live alone you get an automatic 25% Single Person Discount on top — many people forget to claim this when they move into a flat by themselves. Apply via gov.uk/apply-council-tax-reduction.",
      "NHS prescriptions, dental and eye care are free if you're on Universal Credit, Pension Credit, income-based JSA, or under 19. Standard prescriptions are £9.90 each — if you're regularly paying, check whether you qualify, or ask about a Prescription Prepayment Certificate (£32.05 for 3 months, £114.50 for a year — saves money if you have 3+ items a month).",
      "Help to Save is a government scheme that pays a 50% bonus on what you save — up to £1,200 free over 4 years. You qualify if you're on Universal Credit (with at least £1 earned income), or on Working Tax Credit. Open via gov.uk/get-help-savings-low-income.",
    ],
  },
  {
    id: 'how-to-check-if-youre-being-paid-correctly',
    title: "How to check if you're being paid correctly",
    summary:
      "Three things to verify on every payslip: hourly rate vs National Minimum Wage, holiday pay accrual, and that all your hours are listed. Underpayment is more common than you'd think.",
    readTimeMinutes: 5,
    category: 'benefits',
    content: [
      "Check your hourly rate against the National Living/Minimum Wage. From April 2026 it's £12.21 for ages 21+; £10.00 for 18–20; £7.55 for 16–17 and apprentices in their first year. If your hourly rate falls below this — including when 'service charge top-ups' or 'training rates' have brought it down — that's illegal and your employer owes back-pay going up to six years.",
      "Holiday pay: you accrue 5.6 weeks per year including bank holidays — that's 28 days for a 5-day week, pro-rated if you work fewer days. Check your payslip's 'Holiday accrued' line and compare to how many hours you've worked this year. Hospitality has the highest rate of holiday-pay underpayment of any sector — it's worth checking.",
      "Unpaid trial shifts are not legal in most circumstances. If you carried out productive work (as opposed to a brief 30-minute 'try-out'), you should be paid for the time — even on your first day, even if you didn't get the job. HMRC guidance is clear on this.",
      "If you spot an underpayment, raise it with payroll in writing first (keep a copy). If that doesn't resolve it, ACAS gives free legal advice (0300 123 1100) before you have to go anywhere near an employment tribunal. You can also report wage underpayment anonymously to HMRC at gov.uk/government/organisations/hm-revenue-customs/contact/national-minimum-wage-enquiries.",
    ],
  },
  {
    id: 'what-statutory-sick-pay-actually-covers',
    title: 'What statutory sick pay actually covers',
    summary:
      "SSP is £118.75/week (2026-27) for up to 28 weeks. The first 3 days are unpaid 'waiting days'. Universal Credit can top you up if SSP alone isn't enough to live on.",
    readTimeMinutes: 4,
    category: 'benefits',
    content: [
      "Statutory Sick Pay is £118.75 per week for the 2026–27 tax year, paid by your employer for up to 28 weeks. You qualify if you earn at least £125 per week on average and you've been off sick for at least 4 consecutive days (including non-working days).",
      "Catch: the first three days are 'waiting days' and are not paid unless your employer offers a more generous contractual sick pay scheme. Many hospitality contracts only pay SSP — check your contract or staff handbook so there are no surprises if you're off ill.",
      "You can self-certify for the first 7 days (a quick form your employer gives you, or written confirmation by email). After that you need a fit note from a GP, NHS 111 or pharmacist. The fit note isn't optional — without it your SSP can be stopped from day 8.",
      "If SSP alone won't cover your essentials (£118.75/week is below most rent + bills), Universal Credit can top you up while you're off sick — you can claim both at the same time. Apply at gov.uk/universal-credit; the first payment lands roughly 5 weeks after applying, so do it the day you go off sick rather than waiting.",
    ],
  },
];

@Injectable()
export class LearningService {
  list(): LearningResponse {
    // Group by category in the order defined by CATEGORY_META.
    const categories: CategoryGroup[] = (
      Object.keys(CATEGORY_META) as LearningCategory[]
    ).map((category) => ({
      category,
      label: CATEGORY_META[category].label,
      emoji: CATEGORY_META[category].emoji,
      articles: ARTICLES.filter((a) => a.category === category),
    }));
    return { categories };
  }

  get(id: string): Article {
    const article = ARTICLES.find((a) => a.id === id);
    if (!article) {
      throw new NotFoundException(`Article not found: ${id}`);
    }
    return article;
  }
}
