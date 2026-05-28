# Fourth Pay — Product Brain
## Document 5: Fourth HCM UK Integration Contracts

**Version:** 1.0  
**Source:** Fourth HCM UK API Explorer (alibarlow.github.io/fourth-hcmuk-api-explorer)  
**Last scraped:** 27 May 2026  
**Classification:** Internal — AI agent context document

---

## Overview

Fourth Pay integrates with the **PeopleSystem Integration API (UK HR API)** — the main
data exchange layer for Fourth HCM UK. This is an **Open API** using **org-scoped
authentication**. It is the same API used by Informatica and other integration partners.

**Base characteristics:**
- Auth: Organisation-scoped token (not employee JWT — this is a service-to-service API)
- Style: REST, returns lists for GET endpoints
- Async writes: POST/PUT/DELETE return HTTP 202 Accepted + SubmissionID for tracking
- 41 endpoints total — Fourth Pay uses 6 of them

---

## The 6 endpoints Fourth Pay uses

### 1. GET — Get employees
**Purpose:** Check employee eligibility and get identity data  
**Fourth Pay use:** Called by HRAdapter.checkEligibility() before every transfer  

**Confirmed by Ali Barlow (API Explorer):**
```
URL    GET http://10.12.6.10:85/organisations/{orgId}/Employees
Auth   X-Fourth-Org: <OrganisationID/GroupID>
Filter Client-side by FAID against the response array
```

**Key response fields:**
```
EmployeeID          Integer   Internal numeric ID
FAID                Text      Fourth Account ID — 18-char unique identifier (USE THIS as fourth_employee_id)
PayrollNumber       Text      Payroll reference number
CompanyName         Text      Employer name
Paybasis            Text      Pay schedule (monthly, weekly, etc.)
FirstName/LastName  Text      Employee name
DateOfBirth         Date      Date of birth
NationalInsuranceNumber Text  NI number — NEVER log this, encrypted at rest
IR35                Boolean   Whether within IR35 (affects EWA eligibility)
```

**Fourth Pay mapping:**
```typescript
// FAID is the canonical employee identifier to use across all Fourth systems
// Store as fourth_employee_id in employee_accounts table
// EmployeeID is internal to HCM — use FAID for cross-system references
```

---

### 2. GET — Employment records
**Purpose:** Employment history and contract type  
**Fourth Pay use:** Eligibility check — confirm active employment, get start date for tenure check  

**Confirmed by Ali Barlow (API Explorer):**
```
URL  GET http://10.12.6.10:85/organisations/{orgId}/Employees/Employments
Auth X-Fourth-Org: <OrganisationID/GroupID>
```

**Full response field list:**
```
EmployeeID              Integer  Internal numeric ID (joins to Employees)
EmploymentReference     Text     Per-employment reference code
EmploymentStartDate     Date     Employment start date (use this for tenure)
EmploymentEndDate       Date     Employment end date (blank/empty when current)
AssignmentStartDate     Date     Current assignment start
AssignmentEndDate       Date     Current assignment end
TerminationReason       Text     Free-text leaver reason
Rehire                  Text     Eligible-for-rehire flag (Yes/No)
EmploymentStatus        Text     Active / Current / Terminated / etc. — drives the tenure gate
IsPermanent             Text     Yes/No
IsFulltime              Text     Yes/No
IsForeignStudent        Text     Yes/No
IsLiveIn                Text     Yes/No
EmploymentType          Text     e.g. PAYE, Self-employed
Department              Text     Department code
DepartmentDescription   Text     Department name
JobCode                 Text     Job code
JobDescription          Text     Job title at time of payslip
ShiftType               Text     e.g. Day, Night
SiteCode                Text     Site code
SiteDescription         Text     Site / venue name
RateOfPay               Number   Current pay rate
```

**Fourth Pay mapping:**
```typescript
// EmploymentStatus is the primary signal for "is this employee
// currently working" — see ACTIVE_EMPLOYMENT_STATUSES in
// hr.adapter.ts. EmploymentEndDate is informational; do not use it
// as the active-employment check (status can flip independently).
//
// EmploymentStartDate (not AssignmentStartDate) is the tenure clock —
// AssignmentStartDate resets on every internal move.
//
// Note: every Is* flag arrives as a "Yes"/"No" string, not a boolean.
```

---

### 3. GET — Payslips  
**Purpose:** Historical payslip data  
**Fourth Pay use:** Populate the Payslip screen in the app  

**Confirmed by Ali Barlow (API Explorer):**
```
URL  GET http://10.12.6.10:85/organisations/{orgId}/Payslips
Auth X-Fourth-Org: <OrganisationID/GroupID>
```

**Key response fields:**
```
PayslipDate         Date      Payslip date
PaymentDate         Date      Actual payment date (use as next_payday)
ElementName         Text      Pay element name (e.g. "Basic Pay", "Holiday Pay", "Overtime")
Units               Number    Quantity (hours worked)
Rate                Number    Rate of pay
Value               Number    Amount for this element
Department          Text      Department attribution
JobDescription      Text      Job title at time of payslip
SiteDescription     Text      Site/location name
```

**Fourth Pay mapping:**
```typescript
// Group by PayslipDate to build a single payslip
// ElementName drives the line items in the payslip breakdown
// Elements where ElementName contains "deduction" or known deduction types
// become negative line items
// EWA advances appear as a deduction ElementName — confirm exact name with payroll team
```

---

### 4. GET — Payroll periods
**Purpose:** Pay period definitions — start/end dates and payday  
**Fourth Pay use:** Calculate current pay period, determine next_payday, identify lockdown window  

**Confirmed by Ali Barlow (API Explorer):**
```
URL  GET http://10.12.6.10:85/organisations/{orgId}/PayrollPeriod
Auth X-Fourth-Org: <OrganisationID/GroupID>
```

> Singular `PayrollPeriod`, not `PayrollPeriods` — the prior placeholder
> guessed plural.

**Key response fields:**
```
CompanyName         Text      Company
PeriodName          Text      Human-readable period name
PeriodNumber        Integer   Period sequence number
PeriodTaxYear       Integer   Tax year
PayDate             Date      PAYDAY — the date employees are paid
PeriodStartDate     Date      Period start
PeriodEndDate       Date      Period end
```

**Fourth Pay mapping:**
```typescript
// PayDate = next_payday in EWA balance response
// PeriodStartDate / PeriodEndDate = current pay period boundaries
// CRITICAL: Payroll lockdown window is NOT in this API
// Lockdown start/end day must be configured per employer in employer_config table
// Default: lockdown starts day 27 of each period — confirm with payroll ops
```

---

### 5. GET — Approved hours
**Purpose:** Hours approved for payment — this is the source for earnings calculation  
**Fourth Pay use:** Called by WFMAdapter.getConfirmedShifts() — the input to the earnings formula  

**Confirmed by Ali Barlow on 2026-05-28:**
```
URL          GET http://10.12.6.10:85/Organisations/{OrganisationID}/Employees/ApprovedHours
Query params Start, Duration, DateFrom, DateTo, Delta=False
Auth         X-Fourth-Org: <OrganisationID/GroupID>
```

> ⚠️ `10.12.6.10:85` resolves only inside Fourth's internal network.
> The Railway demo cannot reach it and routes via `MockWfmAdapter`
> instead. This adapter only runs when the Fourth Pay API is deployed
> inside Fourth infrastructure.

> 📝 The endpoint has no employee-scoping query param — it returns
> approved hours for every employee in the org. Response rows carry
> `EmployeeID` (numeric) but not `FAID`, so a FAID → EmployeeID
> resolution step runs first via the HR Get Employees endpoint
> (`FourthWfmAdapter.resolveEmployeeId`, with a per-process cache).
> Unknown FAIDs short-circuit to `[]` rather than returning the
> unfiltered org list.

**Key response fields:**
```
EmployeeID          Integer   Employee ID
ElementName         Text      Pay element name — e.g. "Basic Hours", "Overtime", "Bank Holiday"
ElementLocalRef     Text      Element reference code
StartDateTime       Date      Shift start datetime
EndDateTime         Date      Shift end datetime
Units               Number    Number of units (hours)
UnitType            Text      Type — e.g. "Hours"
Rate                Number    Rate of pay for this element
Value               Number    Total value (Units × Rate)
ActHours            Number    Actual hours worked
Department          Text      Department
JobDescription      Text      Job title / role description
SiteDescription     Text      Site name
SubmittedToPayroll  Text      "Yes" or "No" — whether already in payroll run
```

**Fourth Pay mapping:**
```typescript
// This IS the confirmed hours source for the earnings calculation
// Filter: SubmittedToPayroll = "No" for current period hours not yet in payroll
// GROSS_EARNED = SUM(Value) for all approved hours in current pay period
// ElementName drives the line items shown in the Earnings Tracker screen
// "Basic Hours" = standard shift pay
// "Overtime" = overtime premium (already in Value at correct rate)
// "Bank Holiday" = bank holiday supplement
// IMPORTANT: Value already includes Rate — do NOT multiply again
```

---

### 6. GET — Deductions
**Purpose:** Payroll deductions (pension, student loan, etc.)  
**Fourth Pay use:** Estimate net pay from gross for available balance calculation  

**Confirmed by Ali Barlow (API Explorer):**
```
URL  GET http://10.12.6.10:85/organisations/{orgId}/Employees/Deductions
Auth X-Fourth-Org: <OrganisationID/GroupID>
```

Wired in `FourthPayrollAdapter.getDeductions()`. Returns positive
amounts (unlike payslip rows where deductions arrive as negative
`Value`s).

**Fourth Pay mapping:**
```typescript
// Used to calculate average_deduction_rate for the earnings formula
// average_deduction_rate = average of (total_deductions / gross_pay) over last 3 periods
// This is an ESTIMATE — actual deductions calculated by payroll at pay run
```

---

### WRITE — Submit payment batch (POST)
**Purpose:** The mechanism for writing EWA deduction records back to payroll  
**Fourth Pay use:** Called by PayrollAdapter when processing the deduction queue at pay run  

**Response fields:**
```
SubmissionID        GUID      Reference to track this submission
```

**CRITICAL RULES for this endpoint:**
```
1. This is called by the deduction queue processor, NOT by the transfer service directly
2. A human must review the deduction queue before this endpoint is called in production
3. HTTP 202 = accepted for processing, not confirmed — poll with SubmissionID
4. HTTP 400 = validation failure — flag for manual payroll ops review
5. Never call this during the payroll lockdown window — queue and wait
```

---

## Authentication pattern

The PeopleSystem Integration API uses **org-scoped authentication** — not employee JWT.

```typescript
// Service-to-service auth — Fourth Pay API calls HCM UK API as a service account
// The OrganisationID identifies the employer (e.g. The Crown Pub Group)
// Employee data is scoped by the org — the service account sees all employees
// Fourth Pay must enforce its own employee-level scoping
// i.e. never return employee A's data in a request authenticated as employee B
```

**Auth header (confirmed by Ali Barlow, 2026-05-28):**

A single header carries the OrganisationID / GroupID — no separate
token field:

```
X-Fourth-Org: <OrganisationID>
```

**Environment variables (confirmed):**
```
FOURTH_INTERNAL_API_URL = http://10.12.6.10:85     # base URL, internal to Fourth network
FOURTH_ORG_ID           = <OrganisationID/GroupID> # used as both URL segment and X-Fourth-Org header
```

The legacy `FOURTH_HCM_API_URL` / `FOURTH_HCM_ORG_TOKEN` /
`FOURTH_HCM_ORG_ID` env vars are no longer read.

> ⚠️ `10.12.6.10:85` is an **internal** Fourth address. It resolves
> only from inside Fourth's network — the Railway-hosted demo cannot
> reach it, so every adapter falls back to its `Mock*Adapter`
> implementation when deployed outside Fourth.

---

## The 3 adapter implementations

Based on the API contracts above, the Fourth integration layer maps as follows:

### HRAdapter (src/integrations/hr/hr.adapter.ts)
```typescript
// Calls: Get employees + Employment records
// Returns: EmployeeEligibility {
//   eligible: boolean
//   reason?: string  
//   faid: string          // Use as fourth_employee_id
//   paybasis: string      // Pay schedule
//   employerConfig: EmployerConfig
// }
```

### WFMAdapter (src/integrations/wfm/wfm.adapter.ts)  
```typescript
// Calls: Approved hours
// Returns: ShiftRecord[] {
//   elementName: string   // "Basic Hours", "Overtime", "Bank Holiday"
//   startDateTime: Date
//   endDateTime: Date
//   units: number         // Hours
//   rate: number          // Rate of pay
//   value: number         // Total value (units × rate — already calculated)
//   submittedToPayroll: boolean
// }
// Filter: only return records where submittedToPayroll = false for current period
```

### PayrollAdapter (src/integrations/payroll/payroll.adapter.ts)
```typescript
// Reads: Payslips + Payroll periods + Deductions
// Writes: Submit payment batch (via deduction queue only)
// Returns for reads: PayPeriodConfig {
//   periodStart: Date
//   periodEnd: Date  
//   nextPayday: Date      // from PayDate field
//   averageDeductionRate: number  // calculated from last 3 periods' Deductions
// }
```

---

## Key field name mapping (HCM API → Fourth Pay DB)

```
HCM API field           Fourth Pay field              Notes
─────────────────────── ───────────────────────────── ──────────────────────────────
FAID                  → fourth_employee_id             Primary cross-system identifier
EmployeeID            → (internal HCM only, not stored)
PayDate               → next_payday                   In EWA balance response
PeriodStartDate       → pay_period_start              In EWA transfers table
PeriodEndDate         → pay_period_end                In EWA transfers table
Value (approved hours)→ earnings input                Summed for GROSS_EARNED
NationalInsuranceNumber → (never stored in Fourth Pay) Encrypted in HCM only
AccountNumber         → (never stored in Fourth Pay)  Employees provide bank details
                                                       directly to Fourth Pay
```

---

## What is NOT in this API (important gaps)

These things Fourth Pay needs but must get elsewhere or calculate itself:

```
1. Employer configuration (EWA max %, fee subsidy, lockdown day)
   → Stored in employer_config table, set up during employer onboarding
   → NOT derivable from the HCM API

2. EWA advance history  
   → Stored in Fourth Pay's own ewa_transfers table
   → NOT in HCM — Fourth Pay is the source of truth for this

3. Payroll lockdown window exact dates
   → PeriodStartDate/PeriodEndDate are in the API but lockdown days are not
   → Default: day 27–31, but employer-configurable in employer_config table

4. Net pay (actual)
   → HCM returns gross elements and deductions separately
   → Fourth Pay estimates net using average_deduction_rate
   → Actual net is calculated by payroll at pay run — not available until after

5. Tips, tronc, service charge
   → These are processed outside standard payroll in most hospitality businesses
   → Do NOT include in EWA available balance calculation
   → Confirm with each employer during onboarding whether any tip elements
   → appear in Approved Hours (some do, most don't)
```

---

## WFM UK — BI WebApi (secondary reference)

The WFM UK BI WebApi has 15 endpoints covering labour hours, budgets, payroll, 
sales and shifts. Auth: Subdomain-based. This is a **reporting/BI feed**, not a 
transactional API. Fourth Pay does not use this API directly — the Approved Hours 
endpoint in the HCM UK API is the correct source for shift data.

If future versions of Fourth Pay need labour forecasting (e.g. "you have 3 shifts 
scheduled this week worth an estimated £X"), the BI WebApi's forecast labour cost 
endpoint would be the source.

---

## Next steps for Claude Code

Update the following files now that real API contracts are known:

1. **src/integrations/hr/hr.adapter.ts** — implement against Get employees + Employment records
2. **src/integrations/wfm/wfm.adapter.ts** — implement against Approved hours (use Value field directly, not Units × Rate)
3. **src/integrations/payroll/payroll.adapter.ts** — implement against Payslips + Payroll periods + Deductions + Submit payment batch
4. **src/integrations/hr/hr.mock.ts** — mock data should use FAID format (18-char alphanumeric) not arbitrary IDs
5. **src/modules/ewa/balance.service.ts** — update to use Value from Approved Hours (not calculated from Units/Rate)

**Critical correction to Document 2 (Technical Architecture):**  
The balance calculation in Document 2 uses `confirmed_shift_hours * hourly_rate`.  
The correct approach is to use the `Value` field from Approved Hours directly,  
as this already incorporates the correct rate including any premiums.  
`GROSS_EARNED = SUM(approvedHour.value) for current period, submittedToPayroll = false`
