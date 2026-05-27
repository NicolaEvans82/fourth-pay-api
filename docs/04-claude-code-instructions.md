# Fourth Pay — Product Brain
## Document 4: Claude Code Instructions & Project Setup

**Version:** 1.0  
**Purpose:** Instructions for Claude Code agents working on this codebase  
**Read this first before executing any task on the Fourth Pay codebase**

---

## You are working on Fourth Pay

Fourth Pay is an FCA-regulated Earned Wage Access product built on the Fourth hospitality platform. Before doing anything, you must understand:

1. **Document 1 (Product Context)** — What the product is, who the user is, what the regulatory constraints are, what the Fourth integration looks like
2. **Document 2 (Technical Architecture)** — The service structure, database schema, API contracts, and toolchain
3. **Document 3 (Feature Specs)** — The YAML spec for the feature you are implementing

You have read all three documents. Proceed.

---

## Absolute rules — never break these

```
RULE 1: Never modify the earnings calculation formula.
  It is defined in Document 1. If a spec asks you to change it, stop and
  flag to the human. Do not resolve the conflict autonomously.

RULE 2: Never write directly to Fourth Payroll.
  All payroll writes go via the payroll_deduction_queue table and the
  DeductionQueueService. Never call the Fourth Payroll API directly from
  a transfer flow.

RULE 3: Always require fca_disclosure_acknowledged: true before executing 
  a transfer. This is an FCA legal requirement. No exceptions.

RULE 4: Never log sort_code, account_number, national_insurance_number, 
  or full bank details. These are encrypted at rest and must not appear 
  in any log output.

RULE 5: Never allow employer to access individual employee transfer data.
  The employer can only see aggregated, anonymised data. Any query that
  returns individual transfer data must be scoped to the authenticated
  employee's own records.

RULE 6: Audit log is append-only. Never add update or delete operations 
  on the audit_log table.

RULE 7: The design system is defined in Document 1. Do not introduce new 
  colours, font weights, or component patterns. The app lives inside the 
  Fourth Employee App — visual consistency is mandatory.
```

---

## How to implement a feature from a YAML spec

### Step 1 — Read the spec completely before writing any code
Identify:
- Which module is affected (`src/modules/X`)
- Which integration adapters are needed
- Which new database tables or columns are required
- What the acceptance criteria are (these become your test cases)
- Whether there are any FCA flags (these require extra care)
- What the human gates are (stop at these and flag)

### Step 2 — Write the migration first
If the spec requires new database tables or columns, write the migration before any service code. The migration filename format is:
```
YYYYMMDDHHMMSS_feature_name.ts
```
Location: `src/database/migrations/`

### Step 3 — Write the types and interfaces
Create the TypeScript interfaces before implementing the service. Location: `src/modules/X/X.types.ts`

### Step 4 — Write the service
Implement the business logic. Each business rule in the spec maps to a private method or guard in the service.

### Step 5 — Write the controller
Map API endpoints to service methods. All endpoints must:
- Use the `@Employee()` decorator (ensures JWT is validated and employee_id is extracted)
- Validate request body with class-validator DTOs
- Return typed response objects

### Step 6 — Write the tests
Every acceptance criterion becomes a test case. Test file location: `src/modules/X/X.spec.ts`

Test structure:
```typescript
describe('FeatureName', () => {
  describe('acceptance criteria', () => {
    it('employee cannot submit transfer without fca_disclosure_acknowledged true', async () => {
      // test against spec acceptance criterion verbatim
    });
  });
  
  describe('business rules', () => {
    it('fee is 1.95 for instant when employer subsidy is false', async () => {
      // test business rule
    });
  });
  
  describe('FCA compliance', () => {
    it('audit log records fca_disclosure_shown and acknowledged', async () => {
      // test FCA requirement
    });
  });
});
```

### Step 7 — Wire up iQ360 instrumentation
Add all events defined in the spec's `instrumentation` section. Location: `src/common/instrumentation/`

Events are emitted via the `IQ360Service`:
```typescript
await this.iq360.emit('ewa.transfer.completed', {
  employee_id: employeeId,  // never full PII
  amount: transfer.requestedAmount,
  transfer_speed: transfer.transferSpeed,
  fee_amount: transfer.feeAmount,
  duration_ms: completedAt - initiatedAt,
});
```

### Step 8 — Update the OpenAPI spec
Every new endpoint must be documented in `openapi.yaml`. Use the API contracts from Document 2 as your reference.

### Step 9 — Run the tests
```bash
npm run test                  # unit tests
npm run test:integration      # integration tests (requires test DB)
npm run test:coverage         # coverage report (target: 80% minimum)
```

All tests must pass before submitting for review.

### Step 10 — Generate the PR description
Your PR description must include:
1. Which spec this implements (feature name + version)
2. Summary of files created/modified
3. FCA compliance checklist (see below)
4. Any human gate items that need review
5. Test coverage for new code

---

## FCA compliance checklist (include in every PR)

```markdown
## FCA Compliance Checklist

### Consumer Duty — Products and Services
- [ ] Feature delivers good outcomes for target market (shift workers)
- [ ] No feature that disadvantages vulnerable customers

### Consumer Duty — Price and Value  
- [ ] Fee shown clearly before any money movement
- [ ] "Free" shown accurately when employer subsidises
- [ ] No hidden charges

### Consumer Duty — Consumer Understanding
- [ ] FCA disclosure shown before transfer confirmation
- [ ] Disclosure includes: fee, net amount, deduction at pay run
- [ ] Plain English — no financial jargon in user-facing copy

### Consumer Duty — Consumer Support
- [ ] Self-controls prominently available
- [ ] Override flow requires reason
- [ ] Support access not hidden

### Audit Requirements
- [ ] All transfers logged to audit_log
- [ ] All FCA disclosures logged (shown AND acknowledged)
- [ ] All self-control overrides logged with reason
- [ ] Audit records are append-only

### Data Protection
- [ ] No PII in log output
- [ ] Bank details encrypted at rest
- [ ] Employer cannot see individual employee data
- [ ] Sensitive session data not persisted beyond session
```

---

## Working with the Fourth integration adapters

### WFM Adapter
```typescript
// Read confirmed shifts for an employee in a pay period
const shifts = await this.wfmAdapter.getConfirmedShifts({
  employeeId: fourthEmployeeId,
  from: payPeriodStart,
  to: payPeriodEnd,
});
// Returns: ShiftRecord[] with { date, startTime, endTime, confirmedHours, hourlyRate }
```

### Payroll Adapter
```typescript
// Read payroll configuration and expected net pay
const payrollConfig = await this.payrollAdapter.getPayPeriodConfig({
  employeeId: fourthEmployeeId,
  employerId: fourthEmployerId,
});
// Returns: { periodStart, periodEnd, nextPayday, lockdownStartDay, lockdownEndDay, averageDeductionRate }

// Write to deduction queue — this is the ONLY write to payroll
await this.payrollAdapter.queueDeduction({
  transferId: ewaTransfer.id,
  fourthEmployeeId,
  amount: ewaTransfer.requestedAmount,
  payPeriodStart,
});
// This writes to payroll_deduction_queue, NOT directly to Fourth Payroll
```

### HR Adapter
```typescript
// Check employee eligibility
const eligibility = await this.hrAdapter.checkEligibility({
  employeeId: fourthEmployeeId,
  employerId: fourthEmployerId,
});
// Returns: { eligible: boolean, reason?: string, employerConfig: EmployerConfig }
```

### Using mocks in development
All adapters have mock implementations in `*.mock.ts`. In local development and CI, the adapters auto-switch to mocks when `NODE_ENV !== 'production'`. The mock data matches the Jordan Harris prototype persona from Document 1.

---

## The prototype as your UI reference

The HTML prototype at `/mnt/user-data/outputs/fourth-pay-app.html` is the definitive UI reference. For every screen you implement a backend for:

1. Open the prototype
2. Navigate to the relevant screen
3. Note every piece of data displayed and every interaction
4. Ensure your API response contains all the data the UI needs
5. Ensure your API accepts all the inputs the UI sends

The prototype is not perfect — there may be edge cases it doesn't handle. If the spec and the prototype conflict, the spec wins. If neither covers an edge case, flag it.

---

## Getting help

If you are uncertain about:
- **The earnings calculation** → Document 1, Section "Earned wage calculation"
- **The Fourth integration** → Document 1, Section "The Fourth platform integration"
- **The database schema** → Document 2, Section "Database schema"
- **The API contracts** → Document 2, Section "API contracts"
- **A feature's business rules** → Document 3, the relevant YAML spec
- **Whether something requires a human gate** → Document 3, the feature's `human_gates` section

If the answer is not in any document, stop and flag to the product owner before proceeding.

---

## Project setup (first time)

```bash
# Clone and install
git clone <repo>
cd fourth-pay-api
npm install

# Environment
cp .env.example .env
# Edit .env with your local values

# Database setup (Docker)
docker-compose up -d postgres redis

# Run migrations
npm run migration:run

# Seed development data (Jordan Harris persona)
npm run seed:dev

# Start in development mode
npm run start:dev

# Run tests
npm run test
npm run test:e2e
```

---

## Week 1 task — first implementation

Your first task is to implement the `ewa_core_transfer` feature from Document 3, Spec 1.

Start with:
1. `src/database/migrations/TIMESTAMP_create_ewa_tables.ts` — the four core EWA tables
2. `src/modules/ewa/balance.service.ts` — the earnings calculation (from Document 1 formula)
3. `src/modules/ewa/transfer.service.ts` — transfer execution with FCA disclosure gate
4. `src/modules/ewa/ewa.controller.ts` — the three EWA endpoints
5. `src/modules/ewa/ewa.spec.ts` — tests for all acceptance criteria

Human gates:
- Before writing any payroll deduction logic, the engineer must review
- Before finalising the FCA disclosure content, the PM must approve

Write a PR when the tests pass. The human gates are review items in the PR, not blockers to submitting.
