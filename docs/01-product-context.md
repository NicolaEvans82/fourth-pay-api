# Fourth Pay — Product Brain
## Document 1: Product Context & Overview

**Version:** 1.0  
**Owner:** Nicola Evans, VP of Product  
**Last updated:** May 2026  
**Classification:** Internal — AI agent context document

---

## What this document is

This is the primary context document for the Fourth Pay Claude Project. It tells any AI agent working on this product:
- What Fourth Pay is and what it must do
- Who uses it and what they need
- What the regulatory constraints are
- What the Fourth platform integration looks like
- What the design system is
- What we have already built

Every agent instruction, feature spec, and code generation request should be read against this document.

---

## What Fourth Pay is

Fourth Pay is an Earned Wage Access (EWA) product built on top of Fourth's existing hospitality workforce management platform. It gives hospitality employees in the UK the ability to access wages they have already earned before their scheduled payday.

It is **not** a loan product. There is no interest. Employees access their own earned wages for a flat fee of £1.95 per instant transfer (or free via standard 1–3 day transfer).

It is **FCA-regulated** under the Consumer Credit Act and the FCA's EWA Code of Practice. Every feature that touches money movement, fee display, or employee financial wellbeing has a regulatory dimension.

---

## The employer relationship

Fourth Pay is a B2B2C product. The employer (e.g. The Crown Pub Group, a Fuller's site, an ASDA store) partners with Fourth to offer the product to their employees. The employer:

- Configures the product (max access %, fee subsidy, which employees are eligible)
- Does NOT see individual employee transfer data (privacy requirement)
- Receives anonymised usage data via an employer dashboard
- May choose to subsidise the £1.95 fee (this is a commercial configuration, not a product feature)

The employee interacts entirely through the mobile app. They never see the employer configuration.

---

## The user — who Jordan is

Our prototype user is Jordan Harris. Jordan is a Bar Supervisor at The Crown Pub Group, working shift-based variable hours. Jordan represents the typical Fourth Pay user:

- Paid monthly
- Hours vary week to week
- Needs access to earned wages for unexpected costs (car repair, vet bill, rent shortfall)
- Uses Monzo as their primary bank account
- Has limited financial resilience — no significant savings buffer
- Is motivated by control, not credit

Jordan is **not** financially irresponsible. Jordan is time-poor and cash-flow-irregular in a way that is structural to hospitality work, not behavioural.

---

## Regulatory context — what the FCA requires

### FCA Consumer Duty (in force August 2023)
Every Fourth Pay feature must deliver good outcomes for customers. Specifically:

1. **Products and services** — EWA must meet the needs of the target market (shift workers with variable income)
2. **Price and value** — £1.95 fee must be demonstrably fair; employer subsidy must be shown transparently
3. **Consumer understanding** — fee, available balance, and deduction at pay run must be shown clearly before any transfer completes
4. **Consumer support** — employees must be able to access help, set limits, and pause access without friction

### FCA EWA Code of Practice
- Employees must be shown what they will receive (net of fee) before confirming
- Monthly access must be capped at 50% of earned wages
- Self-controls (limits, cooling-off, pause) must be prominently available
- Audit trail required for all overrides of self-controls
- Employees must not be able to access wages for a period not yet worked

### GDPR
- Employee transfer data is sensitive financial data — minimise what the employer sees
- Audit logs must be retained for 7 years (financial regulation requirement)
- Data must not leave the UK/EEA without appropriate safeguards

### Key rules that affect implementation
```
MAX_ACCESS_PERCENT = 50  # of net earned wages for the current period
TRANSFER_FEE_INSTANT = 1.95  # GBP, flat fee
TRANSFER_FEE_STANDARD = 0.00  # free, 1-3 working days
FCA_DISCLOSURE_REQUIRED = true  # before every transfer confirmation
AUDIT_LOG_RETENTION_YEARS = 7
SELF_CONTROL_OVERRIDE_REQUIRES_REASON = true
EMPLOYER_CANNOT_SEE_INDIVIDUAL_TRANSFERS = true
```

---

## The Fourth platform integration

Fourth Pay sits on top of three Fourth platform services. Understanding these integrations is essential — bugs at these boundaries are payroll errors, not UX issues.

### 1. Fourth WFM (Workforce Management)
**What we get:** Confirmed shift hours, scheduled shifts, pay rate per shift  
**What we do NOT get:** Tips, tronc, variable bonuses (these are payroll-side)  
**Integration pattern:** Read-only. Fourth Pay never writes to WFM.  
**Update frequency:** Near real-time as shifts are confirmed by managers  
**Critical rule:** Confirmed hours ≠ payable hours in all cases. Bank holiday pay, absence deductions, and variable rates all affect the gross calculation. The earnings calculation must be validated against payroll, not just WFM.

### 2. Fourth Payroll
**What we get:** Expected net pay for the current period (calculated by payroll engine), payroll lockdown window dates  
**What we write:** EWA advance records (deducted at pay run)  
**Integration pattern:** Read for balance calculation, write for advance recording  
**CRITICAL — Payroll lockdown window:** Fourth Payroll locks for pay run preparation. During the lockdown window (typically days 27–31 of a pay period, but employer-configurable), EWA transfers are still permitted but the deduction recording must queue until lockdown lifts. This is NOT the same as blocking transfers — employees can still access pay, but the deduction record is queued.  
**CRITICAL — Deduction reconciliation:** At pay run, all queued EWA advances are deducted from net pay. If the deduction exceeds the net pay (e.g. employee had absences that reduced gross), the system must flag this for payroll operations. This boundary has a permanent human gate.

### 3. Fourth HR
**What we get:** Employee eligibility status, employment type, employer configuration, payroll calendar  
**What we do NOT get:** Salary information (comes from payroll), disciplinary records, personal HR notes  
**Integration pattern:** Read-only for employee data  
**Used for:** Eligibility checking before every transfer, employer subsidy configuration lookup

---

## Earned wage calculation — the formula

This is the most critical piece of business logic in the product. It must not be inferred by AI — it is defined here and implemented exactly.

```
GROSS_EARNED = SUM(confirmed_shift_hours * hourly_rate) for current_pay_period
              + holiday_pay_accrual (if applicable)
              + bank_holiday_supplement (if applicable)
              - known_deductions (pension, student loan — from payroll)

ESTIMATED_NET_EARNED = GROSS_EARNED * (1 - average_deduction_rate)
# average_deduction_rate is calculated from the previous 3 pay periods
# This is an estimate — actual net is calculated by payroll at pay run

PREVIOUSLY_ACCESSED = SUM(all EWA advances in current_pay_period)

AVAILABLE_TO_ACCESS = (ESTIMATED_NET_EARNED * 0.50) - PREVIOUSLY_ACCESSED
# Capped at 50% of estimated net earned
# Cannot be negative

TRANSFER_AMOUNT_MAX = MIN(AVAILABLE_TO_ACCESS, employer_configured_max)
# Employer can set a lower cap — defaults to 50% if not configured
```

**Important:** The available balance is an estimate. At pay run, the actual net pay may differ from the estimate. If the employee has accessed more than their actual net pay allows (rare, but possible with significant absence), payroll operations handles the shortfall. This is NOT a product error — it is a known edge case with a defined payroll process.

---

## The product — full feature set

Fourth Pay has 18 screens covering the following functional areas. Each maps to a YAML spec in Document 2.

### Core EWA
- **Get paid now (stream)** — Select amount, choose transfer speed, confirm with FCA disclosure, receive confirmation
- **Earnings tracker** — Real-time shift-by-shift earnings from WFM, period summary stats

### Financial management
- **Spending tracker** — Open banking integration, all linked accounts in one view, spending by category, bill reminders
- **Budget planner** — Category budget limits, 50/30/20 / zero-based / custom methods, real-time vs target
- **Save & budget** — Savings pots with 4.5% AER (FSCS protected), auto-save, round-up saving

### Borrowing
- **Workplace loans** — Active loan tracking, salary-linked repayment, new loan applications (9.9–13.9% APR)

### Wellbeing & support
- **Benefits checker** — Government benefits eligibility calculator, estimated unclaimed value
- **Pension** — Pension finder, pot consolidation, retirement forecast
- **AI money coach** — Live chat with AI coach, personalised learning plans
- **Financial learning** — Structured learning modules, topic library
- **Financial wellbeing score** — Composite score, personalised insights

### Discounts
- **Discounts & perks** — 500+ brand discounts including UK supermarkets, lifestyle brands, cashback

### Account management
- **Payslips** — Full digital payslip, download PDF, year-to-date summary
- **Self-controls** — Monthly limit, per-transfer limit, cooling-off period, auto-save on access, wellbeing nudges, pause all
- **Notifications** — Categorised alerts, bill due reminders, pay access confirmations, wellbeing nudges
- **Profile** — Bank account management, FCA information, support access, refer a colleague

### Transfer flow
- **Confirm screen** — Post-transfer confirmation with full fee breakdown
- **Home screen** — Greeting, period summary card, iQ insight strip, quick actions grid, recent activity

---

## Design system

The Fourth Pay app uses the same design system as the Fourth Employee App. This is non-negotiable — the EWA product will live inside the Fourth app.

### Colours (exact hex values)
```
--navy:        #002747   /* header/nav bar */
--navy-deep:   #14304F   /* primary text */
--navy-soft:   #234B73   /* dark card backgrounds */
--teal:        #00B69F   /* primary action colour */
--teal-light:  #E0F7F4   /* teal tint backgrounds */
--teal-text:   #007F6F   /* teal text on white */
--orange:      #FAA51A   /* warning / accent */
--red:         #D81632   /* danger / error */
--bg-page:     #F5F7FA   /* page background */
--bg-card:     #FFFFFF   /* card background */
--border:      #E8ECF1   /* card/input borders */
--text-1:      #14304F   /* primary text */
--text-2:      #4A5568   /* secondary text */
--text-3:      #647282   /* muted/label text */
```

### Typography
- **Font:** Roboto (system fallback: -apple-system, sans-serif)
- **Weights:** 400 (regular), 500 (medium), 700 (bold) — never use 800 or 900
- **Primary heading:** 20px, weight 700, color text-1
- **Section title:** 14px, weight 700, color text-1
- **Body:** 13px, weight 400, color text-1, line-height 1.5
- **Label/muted:** 12px, weight 500, color text-3
- **Micro label:** 10px, weight 700, uppercase, letter-spacing 0.8px, color text-3

### Layout
- **Page background:** #F5F7FA — everything sits on this, no full-screen dark backgrounds except the navy status/header bar
- **Cards:** white (#FFFFFF), border 1px solid #E8ECF1, border-radius 10px (--r-md) or 14px (--r-lg for hero cards), shadow: 0 1px 3px rgba(20,48,79,0.06)
- **Screen header:** #002747 navy bar, 56px tall, contains F mark + wordmark on left, icons on right — this is the ONLY dark zone
- **Content starts immediately below header** on the grey page background
- **Bottom nav:** white, 5 tabs (Home / Shifts / Pay / Money / More), teal active state

### Spacing tokens
```
--s1: 4px   --s2: 8px   --s3: 12px  --s4: 16px
--s5: 20px  --s6: 24px  --s8: 32px
```

### Border radius tokens
```
--r-sm: 6px   --r-md: 10px   --r-lg: 14px   --r-xl: 20px
```

### Component patterns
- **Buttons:** radius 6px (--r-sm), 700 weight, 14px, full-width in forms, auto-width in pairs
- **Form inputs:** radius 8px, border #E8ECF1, focus border #00B69F
- **Toggle switches:** 42×23px, teal when on, #D1D9E2 when off
- **Progress bars:** 6px height, radius 100px, teal fill on #E8ECF1 track
- **Badges:** pill shape (radius 100px), 10px uppercase text, semantic colours
- **Icons:** Inline SVG only (no webfont), 18–22px, stroke-based, stroke-width 1.75

---

## What we have already built

A complete working HTML prototype exists at:  
`/mnt/user-data/outputs/fourth-pay-app.html`

This prototype:
- Implements all 18 screens listed above
- Uses the correct Fourth design system (colours, typography, spacing)
- Has working JavaScript routing between all screens
- Has live calculations (transfer fee, available balance, subsidy toggle)
- Has interactive controls (sliders, toggles, chat input, bill reminders)
- Uses inline SVG icons (no external CDN dependency)
- Is structurally sound (all div trees balanced, verified)

The prototype is the **design and interaction reference** for the production build. Every screen, every component, every interaction in the prototype should be reproduced in production with the same behaviour.

---

## What does NOT yet exist

- A backend service (Node.js / TypeScript)
- A database schema
- API contracts (OpenAPI spec)
- Authentication / session management
- Fourth WFM integration (real API calls)
- Fourth Payroll integration (real API calls)
- Fourth HR integration (real API calls)
- FCA disclosure audit logging
- Real open banking integration (spending tracker)
- Real savings account integration
- Real loan origination integration
- Push notification service
- PDF payslip generation

These are the things we need to build. Document 2 contains the technical architecture. Document 3 contains the Fourth integration contracts. Document 4 contains the feature-by-feature YAML specs.

---

## Non-negotiable rules for all AI agents working on this product

1. **Never modify the earnings calculation formula** defined in this document. If the spec conflicts with the formula, flag it — do not resolve it autonomously.

2. **Never write to Fourth Payroll directly** from the EWA service without a human-approved deduction record. All writes to payroll go via a queue with human-reviewable state.

3. **Always surface the fee before confirmation.** FCA requirement. No transfer can complete without the fee (and "free" if subsidised) being shown on the confirmation screen.

4. **The employer never sees individual employee transfer data.** Any analytics feature must aggregate to anonymised employer-level data only.

5. **All FCA disclosure events must be logged.** The audit log is a regulatory requirement, not a nice-to-have. Every disclosure shown, every self-control override, every transfer must produce an audit record.

6. **Self-controls are employee-owned, not employer-owned.** An employer cannot set or override an employee's self-control limits. The employee sets their own limits. The employer configures the product-level maximum only.

7. **Use the design system exactly.** No new colours. No new font weights. No departure from the Employee App visual language. Fourth Pay lives inside the Fourth app — it must be indistinguishable from the rest of the product.
