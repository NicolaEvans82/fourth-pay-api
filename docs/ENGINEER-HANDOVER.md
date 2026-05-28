# Engineer handover — Fourth Pay API

A step-by-step guide for any engineer picking up this codebase. Read
this **before** you start writing code — it'll save you the hour you'd
spend rediscovering what's mocked and what's real.

## 1. What this is in 30 seconds

Fourth Pay is an FCA-regulated Earned Wage Access product built on top
of the Fourth HCM hospitality platform. This repository contains the
**API service** (NestJS / TypeScript) plus two HTML prototypes in
`docs/` — the employee app and the employer dashboard — that ship via
GitHub Pages and call this API.

The API runs in two modes:

- **Demo mode** (current Railway deploy): every store is in-memory and
  pre-seeded with realistic data for two personas. Lets the prototypes
  work end-to-end without any backing services. Good for product demos
  and PM walk-throughs.
- **Production mode**: when `NODE_ENV=production` *and* `DATABASE_URL`
  is set, the wiring flips to the PostgreSQL-backed stores. The
  Fourth*Adapter integration classes call the real Fourth HCM
  PeopleSystem API. Only meaningful inside Fourth's network.

Everything below assumes you're in production-mode territory unless
otherwise stated.

## 1.5 What's built

All P0 features are shipped. Most P2 features are shipped. The only
outstanding employee-facing surfaces are workplace loans and the
spending tracker (both need Open Banking integration to be
meaningful).

| Priority | Feature | Endpoint(s) | Status |
|---|---|---|---|
| P0 | EWA core transfer | `GET /api/v1/ewa/balance`, `POST /ewa/transfer`, `GET /ewa/transfers` | ✅ implemented |
| P0 | Earnings tracker | `GET /api/v1/ewa/earnings` | ✅ implemented |
| P0 | Self-controls | `GET / PUT /api/v1/self-controls`, `POST /pause`, `POST /override` | ✅ implemented |
| P0 | Payslips | `GET /api/v1/payslips`, `/:period`, `/:period/pdf` | ✅ implemented |
| P0 | Notifications | `GET /api/v1/notifications`, `POST /:id/read`, `POST /mark-all-read` | ✅ implemented |
| P1 | Shifts | `GET /api/v1/shifts` (upcoming + recent + weekly) | ✅ implemented |
| P1 | Savings pots | `GET / POST /api/v1/savings/pots`, `POST /:id/contribute` + auto-save | ✅ implemented |
| P1 | Budget planner | `GET /api/v1/budget` (50/30/20, EWA = needs spend) | ✅ implemented |
| P1 | Bill reminders | — | ❌ not started |
| P1 | Spending tracker | — | ⌛ UI-only (needs Open Banking) |
| P2 | Money coach | `POST /api/v1/coach/message` | ✅ implemented (keyword-routed; Anthropic SDK wiring still in tree) |
| P2 | Benefits checker | `GET /api/v1/benefits` (statutory entitlements) | ✅ implemented |
| P2 | Pension finder | `GET /api/v1/pension` (contributions + projection + lost-pot nudge) | ✅ implemented |
| P2 | Discounts | `GET /api/v1/discounts` (catalogue + employer perks) | ✅ implemented |
| P2 | Wellbeing score | `GET /api/v1/wellbeing/score` (4-component) | ✅ implemented |
| P2 | Workplace loans | — | ⌛ UI-only |
| P2 | Financial learning | — | ❌ not started |
| — | Employer dashboard | `GET /api/v1/employer/stats` + `docs/employer.html` | ✅ implemented |
| — | Demo reset | `POST /api/v1/demo/reset` (gated off in Pg mode) | ✅ implemented |
| — | iQ360 instrumentation | 24 events, fire-and-forget via global `Iq360Service` | ✅ implemented |
| — | Persona switcher | Jordan + Marcus, `localStorage`-backed | ✅ implemented |
| — | DatabaseModule | `usePg()` gates the swap; tests stay in-memory | ✅ implemented |
| — | Fourth HCM adapters | All 6 endpoints with confirmed URL paths | ✅ implemented |

Live URLs are in the top of this file. Specs for everything above
live in `docs/03-feature-specs.md`; the OpenAPI 3.1 contract is
`openapi.yaml`.

## 2. Required reading

Skim, in this order, before touching code:

1. `CLAUDE.md` — the seven hard rules (formula immutability, FCA
   disclosure gate, audit log append-only, no employer access to
   individual transfer data, etc.).
2. `docs/01-product-context.md` — what the product is, who Jordan and
   Marcus are, the earnings formula.
3. `docs/02-technical-architecture.md` — service layout + DB schema.
4. `docs/05-integration-contracts.md` — the Fourth HCM endpoints we
   call. The **Approved Hours** contract is fully confirmed; the
   others have placeholder paths.
5. `openapi.yaml` — full request/response contract for everything this
   API exposes.

## 3. Prerequisites

- Node 20 LTS (`nvm use 20`).
- PostgreSQL 15 — local or on whichever Fourth-managed environment
  you're targeting.
- Access to the Anthropic Console *only if* you swap the keyword-
  routed coach back to the live model (currently disabled).
- Access to the internal Fourth network *only if* you intend to call
  the real Fourth HCM API (`10.12.6.10:85` does not resolve outside).

## 4. Run locally (demo mode, no database)

```bash
git clone <repo>
cd fourth-pay-api
npm install
npm run start:dev
```

Smoke test — should return Jordan's seeded balance:

```bash
curl -s http://localhost:3000/api/v1/ewa/balance \
  -H 'x-fourth-employee-id: JORDANHARRIS000001' \
  -H 'x-fourth-employer-id: CROWN-PUB-GROUP' | jq
```

Run the tests — 32 specs, all green on a clean checkout:

```bash
npm test
```

Tests run with `NODE_ENV=test` (Jest default) so the in-memory stores
are always used; you can't accidentally hit a real database from the
test suite.

## 5. Run against a real PostgreSQL

There is no `npm run migration:run` script today — TypeORM is a dep but
the CLI is not configured. The recommended path is:

### 5.1 Stand up a database

Anything Postgres 15+ works. Two options:

- **Locally:** `docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=fp postgres:15`
- **Railway:** add a Postgres plugin to the existing service.
  `DATABASE_URL` will be injected automatically.

### 5.2 Run the five migrations

The migrations live in `src/database/migrations/`. They are
TypeORM-style classes but the project has no DataSource registered, so
the simplest path is to extract the SQL from each `up()` and execute
it manually:

```bash
# 1. Connect
psql "$DATABASE_URL"

# 2. Run each .up() in order. The migrations are:
#    20260527000001_create_ewa_tables.ts            — employee_accounts,
#                                                     bank_accounts,
#                                                     ewa_transfers,
#                                                     payroll_deduction_queue,
#                                                     self_controls,
#                                                     audit_log
#    20260527000002_create_employer_config_table.ts — employer_config
#    20260527000003_create_notifications_tables.ts  — notifications,
#                                                     notification_preferences
#    20260528000004_seed_demo_employees.ts          — Crown Pub Group +
#                                                     Jordan + Marcus + Jordan's
#                                                     £150 self_controls cap
#                                                     + Emergency fund savings pot
#    20260528000005_create_savings_pots_table.ts    — savings_pots
```

The fourth migration is a **data seed**, not a schema change — it
inserts the same UUIDs the in-memory code uses (`00000000-…-001` for
Jordan, `11111111-…-1111` for Marcus, `22222222-…-2222` for Jordan's
Emergency Fund pot) so the Pg stores see the same demo personas the
prototype expects.

If you want a proper migration runner, wire `typeorm-ts-node-commonjs`
into a `migration:run` script — the migrations themselves are
already in the right shape.

### 5.3 Flip the API into Pg mode

Set both env vars and restart:

```bash
export NODE_ENV=production
export DATABASE_URL='postgres://postgres:fp@localhost:5432/postgres'
npm run start:prod
```

You should see at boot:

```
[DatabaseModule] DATABASE_URL set — wiring PG_POOL for production stores.
```

If `DATABASE_URL` is unset in production you'll instead see a `WARN`
and the API falls back to in-memory. This is deliberate — Railway's
demo deploy runs without a DB.

### 5.4 What you'll get

- `/api/v1/ewa/balance`, `/api/v1/ewa/transfers`, `/api/v1/ewa/transfer`,
  `/api/v1/self-controls`, `/api/v1/notifications` all read/write
  against PostgreSQL.
- The `/api/v1/demo/reset` endpoint **does not exist** in Pg mode —
  `DemoModule` is gated off in `app.module.ts:21`.
- The `audit_log` table is INSERT-only via `PgAuditLogWriter` (rule 6).
  Lock down UPDATE/DELETE at the DB role level when you're ready.

## 6. Fourth HCM PeopleSystem Integration API — confirmed details

Ali Barlow confirmed the following on 2026-05-28
(`docs/05-integration-contracts.md`):

| Field | Value |
|---|---|
| Base URL | `http://10.12.6.10:85` (internal Fourth network only) |
| Auth header | `X-Fourth-Org: <OrganisationID/GroupID>` (single header, no separate token) |
| Approved Hours endpoint | `GET /Organisations/{OrganisationID}/Employees/ApprovedHours` |
| Approved Hours params | `Start`, `Duration`, `DateFrom`, `DateTo`, `Delta=False` |

**`10.12.6.10:85` only resolves inside Fourth's network.** Outside
Fourth (e.g. the Railway-hosted demo) it is unreachable, which is why
every adapter falls back to its `Mock*Adapter` when `NODE_ENV` is not
production or when the host can't reach the Fourth network.

### Confirmed since the original handover

All six PeopleSystem endpoints have confirmed paths now — see
`docs/05-integration-contracts.md`:

| Adapter | Endpoint |
|---|---|
| WFM | `GET /Organisations/{orgId}/Employees/ApprovedHours` |
| HR | `GET /organisations/{orgId}/Employees` |
| HR | `GET /organisations/{orgId}/Employees/Employments` |
| Payroll | `GET /organisations/{orgId}/PayrollPeriod` |
| Payroll | `GET /organisations/{orgId}/Payslips` |
| Payroll | `GET /organisations/{orgId}/Employees/Deductions` |

Path casing differs by adapter (`Organisations` for WFM, lowercase
`organisations` for HR/Payroll) — matches Ali's confirmation from the
API Explorer; do not normalise without re-checking.

FAID → EmployeeID resolution is now wired:
`FourthWfmAdapter.resolveEmployeeId` calls the HR `Employees` endpoint
(same URL `HrAdapter.fetchEmployee` uses — lowercase `/organisations/`
even though we're inside the WFM adapter, because casing follows the
endpoint not the calling adapter), finds the row by FAID, and caches
the resulting EmployeeID for the process lifetime. The Approved Hours
response is then filtered client-side to that EmployeeID — and short-
circuits to `[]` for an unknown FAID rather than returning the
unfiltered org list (CLAUDE.md rule 5).

### Still open with Ali

Nothing currently blocked. All six PeopleSystem endpoints are
wired against confirmed paths and the `EmploymentRecordApiRow`
field list is now complete from the API Explorer. The tenure check
in `hr.adapter.ts` uses `EmploymentStatus` as the active signal — if
production reveals a status value outside the current allow-list
(`active` / `current` / `employed` / `live`), extend
`ACTIVE_EMPLOYMENT_STATUSES` rather than loosening the check.

## 7. Switching from Mock* to Fourth* adapters

Each of the three integration modules currently wires the mock adapter
unconditionally. Look for these lines:

```ts
// src/integrations/wfm/wfm.module.ts
const wfmAdapterProvider: Provider = {
  provide: WFM_ADAPTER,
  useClass: MockWfmAdapter,   // ← swap to FourthWfmAdapter
};
```

The same pattern exists in `hr.module.ts` and `payroll.module.ts`.
Switching to the real adapter requires:

1. **Set the env vars** (in your deployment environment, not in code):
   ```
   FOURTH_INTERNAL_API_URL = http://10.12.6.10:85
   FOURTH_ORG_ID           = <OrganisationID/GroupID>
   ```
2. **Swap `useClass`** for the relevant adapter(s). Recommend doing
   WFM first since that's the one fully confirmed.
3. **Gate the swap on `NODE_ENV === 'production' && process.env.FOURTH_INTERNAL_API_URL`**
   so tests and the Railway demo keep using mocks.
4. **Make sure the host can reach `10.12.6.10:85`.** A connectivity
   smoke test:
   ```bash
   curl -v "http://10.12.6.10:85/Organisations/$FOURTH_ORG_ID/Employees/ApprovedHours?Start=0&Duration=10&DateFrom=2026-05-01&DateTo=2026-05-31&Delta=False" \
     -H "X-Fourth-Org: $FOURTH_ORG_ID"
   ```
   If you don't get any response (not even an HTTP error), you're
   outside the Fourth network.

## 8. Definition of done — Milestone 1

**Milestone 1:** `GET /api/v1/ewa/balance` returns real Fourth data
for a real employee.

This is done when all of the following are true:

- [ ] PostgreSQL is provisioned in the deployment environment with the
  three schema migrations + the seed migration applied.
- [ ] `DATABASE_URL` is set; the boot log shows `[DatabaseModule]
  DATABASE_URL set — wiring PG_POOL for production stores.`
- [ ] `FOURTH_INTERNAL_API_URL` and `FOURTH_ORG_ID` are set; the
  curl smoke test in §7 returns a 200 with JSON rows.
- [ ] `WFM_ADAPTER` in `wfm.module.ts` is gated to use
  `FourthWfmAdapter` in production.
- [ ] The FAID → EmployeeID lookup is wired into
  `FourthWfmAdapter.resolveEmployeeId` (call Get Employees, cache the
  mapping), so the returned shifts are scoped to the calling employee
  only.
- [ ] `MockHrAdapter` and `MockPayrollAdapter` are still in place —
  `getBalance` calls all three adapters and we only have WFM
  confirmed. Cutover happens behind a feature flag or env var until
  HR and Payroll are also confirmed and tested.
- [ ] A real curl against the deployed API returns a balance whose
  `earnedAmount` matches the sum of `Value` in Approved Hours for the
  current pay period (the formula in `balance.service.ts:55-56` is
  rule 1 — do not modify it).
- [ ] The 32 unit tests still pass (they use mocks; they should be
  unaffected).
- [ ] An audit_log row exists in PostgreSQL for the balance request
  if any audit hooks were added.

**Not in milestone 1** (deliberately deferred):

- Writing to `payroll_deduction_queue` for real (CLAUDE.md rule 2 —
  human review gate before this becomes a live write).
- HR + Payroll real adapters.
- Replacing `MockEmployeeAccountReader` — currently still used in
  Pg mode. Build `PgEmployeeAccountReader` once you have a real
  employee enrolment flow.

## 9. Where to find things

| Need | File |
|---|---|
| Switch business logic in production | service classes in `src/modules/*/` — these are interface-driven and never touch DB or Fourth API directly |
| Add a new endpoint | new controller in `src/modules/<feature>/<feature>.controller.ts`, register the module in `src/app.module.ts` |
| Add a new table | new migration in `src/database/migrations/` + new reader/writer + new InMemory + Pg implementations behind tokens |
| Change a Fourth API call | the three adapters in `src/integrations/{wfm,hr,payroll}/` |
| Update the prototype | `docs/index.html` (employee app) and `docs/employer.html` (employer dashboard) — both pure HTML/JS, no build step |
| Demo data | seeders at the bottom of each `src/database/*.store.ts` file (in-memory) and `20260528000004_seed_demo_employees.ts` (Pg) |

## 10. Conventions to keep

- **Service code never touches `fetch` or `pg.Pool` directly.**
  Services inject reader/writer interfaces (`EWA_TRANSFER_READER`,
  `HR_ADAPTER`, etc.). This is what lets us swap mocks for real
  implementations without changing business logic.
- **Use Nest's DI symbols, never magic strings.** All injection
  tokens are exported as `Symbol`s.
- **Never modify the earnings formula** (`balance.service.ts:55-56`).
  Rule 1 in CLAUDE.md is not a guideline.
- **Never log PII.** `sort_code`, `account_number`, and
  `national_insurance_number` are excluded from every log line by
  policy. The Pg schema columns carry a SQL `COMMENT` saying so.
- **Audit log is append-only.** `PgAuditLogWriter` exposes only
  `append()`. Don't add an update method.

If anything in this doc disagrees with `CLAUDE.md`, `CLAUDE.md` wins.
