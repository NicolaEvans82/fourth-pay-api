# Fourth Pay — Product Brain
## Document 2: Technical Architecture

**Version:** 1.0  
**Owner:** Engineering (to be assigned)  
**Status:** Draft — pending engineering review  
**Classification:** Internal — AI agent context document

---

## Overview

Fourth Pay is a TypeScript/Node.js microservice that sits between the Fourth platform (WFM, Payroll, HR) and the employee-facing mobile app. It does not replace or replicate any Fourth platform functionality — it orchestrates data from existing Fourth services and adds the EWA business logic on top.

---

## Service architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Fourth Pay API Service                      │
│                   (Node.js / TypeScript)                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   EWA Engine │  │ Wellbeing    │  │  Account Management  │ │
│  │              │  │ Engine       │  │                      │ │
│  │ - Balance    │  │ - Score calc │  │ - Self-controls      │ │
│  │ - Transfer   │  │ - Insights   │  │ - Notifications      │ │
│  │ - Cooling-off│  │ - Coach      │  │ - Profile            │ │
│  │ - Limits     │  │ - Learn      │  │ - Audit log          │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│         │                 │                       │             │
│  ┌──────┴─────────────────┴───────────────────────┴──────────┐ │
│  │              Integration Layer                              │ │
│  │  WFMAdapter │ PayrollAdapter │ HRAdapter │ BankingAdapter  │ │
│  └──────┬──────────────┬────────────────┬────────────────────┘ │
└─────────┼──────────────┼────────────────┼─────────────────────┘
          │              │                │
   Fourth WFM    Fourth Payroll    Fourth HR
   (hours/shifts) (deductions)  (eligibility)
```

---

## Technology stack

```yaml
runtime: Node.js 20 LTS
language: TypeScript 5.x
framework: NestJS (consistent with Fourth platform services)
database: PostgreSQL 15 (primary store)
cache: Redis (session, balance cache, rate limiting)
queue: Bull/BullMQ on Redis (payroll deduction queue, notification queue)
auth: JWT (issued by Fourth SSO — Fourth Pay does not own auth)
api_style: REST + OpenAPI 3.1
testing: Jest (unit), Supertest (integration)
deployment: Docker / Kubernetes (consistent with Fourth infra)
observability: iQ360 events + structured logging (Winston)
```

---

## Module structure

Each module is a NestJS feature module — controller(s), service(s),
DTOs, and a `<name>.module.ts` wiring file. Modules consume one or
more reader/writer interfaces (database) or adapter interfaces
(integrations); they never touch `pg.Pool` or `fetch` directly.

```
src/
├── main.ts                    # NestFactory bootstrap, CORS, ValidationPipe, 0.0.0.0 bind
├── app.module.ts              # Wires every feature module + the conditional Pg switch
│
├── modules/
│   ├── ewa/                   # /api/v1/ewa — balance, transfer, transfers, earnings (P0, IMPLEMENTED)
│   ├── self-controls/         # /api/v1/self-controls (P0, IMPLEMENTED)
│   ├── payslip/               # /api/v1/payslips, /:period, /:period/pdf (P0, IMPLEMENTED)
│   ├── notifications/         # /api/v1/notifications (P0, IMPLEMENTED)
│   ├── shifts/                # /api/v1/shifts — upcoming + recent + weekly (P1, IMPLEMENTED)
│   ├── savings/               # /api/v1/savings/pots — pots + manual + auto-save sink (P1, IMPLEMENTED)
│   ├── budget/                # /api/v1/budget — 50/30/20 from real earnings (P1, IMPLEMENTED)
│   ├── coach/                 # /api/v1/coach/message — money coach (P2, IMPLEMENTED, keyword-routed)
│   ├── employer/              # /api/v1/employer/stats — anonymised dashboard (cross-cutting, IMPLEMENTED)
│   ├── benefits/              # /api/v1/benefits — statutory entitlements (P2, IMPLEMENTED)
│   ├── pension/               # /api/v1/pension — contributions + projection + lost-pot nudge (P2, IMPLEMENTED)
│   ├── discounts/             # /api/v1/discounts — partner catalogue + employer perks (P2, IMPLEMENTED)
│   ├── wellbeing/             # /api/v1/wellbeing/score — 4-component score (P2, IMPLEMENTED)
│   └── demo/                  # /api/v1/demo/reset — in-memory reseed (gated off in Pg mode)
│
├── integrations/
│   ├── wfm/                   # Fourth WFM adapter (Approved Hours, FAID→EmployeeID lookup)
│   │   ├── wfm.adapter.ts
│   │   ├── wfm.module.ts
│   │   └── wfm.mock.ts
│   ├── payroll/               # Fourth Payroll adapter (Periods, Payslips, Deductions)
│   │   ├── payroll.adapter.ts
│   │   ├── payroll.module.ts
│   │   └── payroll.mock.ts
│   ├── hr/                    # Fourth HR adapter (Employees, Employments, employment profile)
│   │   ├── hr.adapter.ts
│   │   ├── hr.module.ts
│   │   └── hr.mock.ts
│   ├── fourth-hcm.config.ts   # FOURTH_HCM_CONFIG token (baseUrl + orgId)
│   └── fourth-hcm.module.ts   # Reads FOURTH_INTERNAL_API_URL + FOURTH_ORG_ID env
│
├── common/
│   └── instrumentation/       # iQ360 service (global, fire-and-forget)
│       ├── iq360.service.ts
│       └── instrumentation.module.ts
│
└── database/
    ├── pg.ts                  # PG_POOL DI token + Pool factory
    ├── database.module.ts     # @Global, conditionally provides PG_POOL via .forRoot()
    ├── use-pg.ts              # usePg() = NODE_ENV === 'production' && !!DATABASE_URL
    ├── migrations/            # TypeORM migrations (5 files, see Database schema below)
    ├── readers/               # *.reader.ts interfaces + EMPLOYEE_ACCOUNT_READER
    ├── writers/               # *.writer.ts interfaces + InMemory* + Pg* implementations
    ├── ewa-transfer.store.ts          # InMemory + seed (Jordan 3, Marcus 1, +56 anon)
    ├── pg-ewa-transfer.store.ts       # Pg-backed equivalent
    ├── self-controls.store.ts         # InMemory + seed (Marcus £150 cap)
    ├── pg-self-controls.store.ts
    ├── notifications.store.ts         # InMemory + seed (3 unread notifs for Jordan)
    ├── pg-notifications.store.ts
    └── savings-pot.store.ts           # InMemory + seed (Jordan Emergency fund £45/£500)
```

---

## Database schema

### Core tables

```sql
-- Employee account (Fourth Pay profile, not Fourth HR record)
CREATE TABLE employee_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fourth_employee_id    VARCHAR(64) NOT NULL UNIQUE,  -- links to Fourth HR
  fourth_employer_id    VARCHAR(64) NOT NULL,
  enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                VARCHAR(32) NOT NULL DEFAULT 'active',
  -- status: active | paused | suspended | closed
  bank_account_id       UUID REFERENCES bank_accounts(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank accounts (employee-linked, not employer-visible)
CREATE TABLE bank_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
  account_name          VARCHAR(128),
  sort_code             CHAR(6),                      -- stored encrypted
  account_number        CHAR(8),                      -- stored encrypted
  bank_name             VARCHAR(64),
  is_primary            BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EWA transfers (the core transaction record)
CREATE TABLE ewa_transfers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
  pay_period_start      DATE NOT NULL,
  pay_period_end        DATE NOT NULL,
  requested_amount      DECIMAL(10,2) NOT NULL,
  fee_amount            DECIMAL(10,2) NOT NULL,       -- 1.95 or 0.00
  fee_subsidised        BOOLEAN NOT NULL DEFAULT false,
  net_amount            DECIMAL(10,2) NOT NULL,       -- requested - fee
  transfer_speed        VARCHAR(16) NOT NULL,          -- instant | standard
  status                VARCHAR(32) NOT NULL DEFAULT 'pending',
  -- status: pending | processing | completed | failed | reversed
  bank_account_id       UUID REFERENCES bank_accounts(id),
  initiated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  failure_reason        TEXT,
  -- FCA requirement: full audit trail
  fca_disclosure_shown  BOOLEAN NOT NULL DEFAULT false,
  fca_disclosure_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payroll deduction queue (written at transfer, processed at pay run)
CREATE TABLE payroll_deduction_queue (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ewa_transfer_id       UUID NOT NULL REFERENCES ewa_transfers(id),
  employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
  fourth_employee_id    VARCHAR(64) NOT NULL,
  pay_period_start      DATE NOT NULL,
  amount                DECIMAL(10,2) NOT NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'queued',
  -- status: queued | submitted | confirmed | failed | manual_review
  queued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at          TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  payroll_reference     VARCHAR(128),                 -- Fourth Payroll ref
  notes                 TEXT                          -- for manual_review
);

-- Self-controls (employee-owned)
CREATE TABLE self_controls (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id) UNIQUE,
  monthly_limit_enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_limit_amount  DECIMAL(10,2) DEFAULT 200.00,
  per_transfer_limit_enabled BOOLEAN NOT NULL DEFAULT false,
  per_transfer_limit_amount  DECIMAL(10,2),
  cooling_off_enabled   BOOLEAN NOT NULL DEFAULT false,
  cooling_off_hours     INTEGER DEFAULT 48,            -- 24 | 48 | 168
  auto_save_enabled     BOOLEAN NOT NULL DEFAULT false,
  auto_save_percent     INTEGER DEFAULT 10,
  wellbeing_nudges_enabled BOOLEAN NOT NULL DEFAULT true,
  paused_until          TIMESTAMPTZ,                   -- null = not paused
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log (FCA requirement — 7 year retention)
CREATE TABLE audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
  event_type            VARCHAR(64) NOT NULL,
  -- event types: transfer_initiated | transfer_completed | transfer_failed
  -- fca_disclosure_shown | self_control_changed | self_control_override
  -- account_paused | account_resumed | login | bank_account_changed
  event_data            JSONB NOT NULL DEFAULT '{}',
  ip_address            INET,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Savings pots
CREATE TABLE savings_pots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
  name                  VARCHAR(128) NOT NULL,
  emoji                 VARCHAR(8),
  target_amount         DECIMAL(10,2),
  current_balance       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  interest_rate_aer     DECIMAL(5,4) NOT NULL DEFAULT 0.0450, -- 4.50% AER
  auto_save_enabled     BOOLEAN NOT NULL DEFAULT false,
  auto_save_amount      DECIMAL(10,2),
  round_up_enabled      BOOLEAN NOT NULL DEFAULT false,
  status                VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employer configuration (set by employer, not employee)
CREATE TABLE employer_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fourth_employer_id    VARCHAR(64) NOT NULL UNIQUE,
  max_access_percent    INTEGER NOT NULL DEFAULT 50,   -- max 50, FCA rule
  fee_subsidised        BOOLEAN NOT NULL DEFAULT false,
  min_tenure_days       INTEGER NOT NULL DEFAULT 0,    -- eligibility threshold
  enabled               BOOLEAN NOT NULL DEFAULT true,
  payroll_lockdown_start_day INTEGER DEFAULT 27,       -- day of month
  payroll_lockdown_end_day   INTEGER DEFAULT 31,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## API contracts — core endpoints

### Authentication
All endpoints require a valid JWT issued by Fourth SSO. The JWT contains `fourth_employee_id` and `fourth_employer_id`. Fourth Pay does not issue or validate JWTs — it trusts the Fourth auth gateway.

```
Authorization: Bearer <fourth_sso_jwt>
```

### EWA endpoints

```
GET  /api/v1/ewa/balance
     Returns: available_amount, earned_amount, accessed_amount, 
              pay_period_start, pay_period_end, next_payday, 
              employer_subsidy, monthly_limit_remaining

POST /api/v1/ewa/transfer
     Body: { amount: number, transfer_speed: 'instant'|'standard', 
             bank_account_id: string, fca_disclosure_acknowledged: boolean }
     Returns: transfer_id, status, fee_amount, net_amount, 
              estimated_arrival, fca_reference

GET  /api/v1/ewa/transfers
     Query: ?pay_period_start=YYYY-MM-DD&limit=20&offset=0
     Returns: transfers[], total_accessed_this_period

GET  /api/v1/ewa/transfers/:id
     Returns: full transfer record with status history
```

### Self-controls endpoints

```
GET  /api/v1/self-controls
     Returns: full self_controls record for the authenticated employee

PUT  /api/v1/self-controls
     Body: partial self_controls object (any updatable fields)
     Returns: updated self_controls record

POST /api/v1/self-controls/pause
     Body: { duration_days: 30 }
     Returns: paused_until timestamp

POST /api/v1/self-controls/override
     Body: { override_type: string, reason: string }
     Returns: override_token (short-lived, used in transfer request)
     Side effect: writes to audit_log with reason
```

### Payslip endpoints

```
GET  /api/v1/payslips
     Query: ?limit=12&offset=0
     Returns: payslip[] with pay_period, net_pay, gross_pay, paid_at

GET  /api/v1/payslips/:pay_period_start
     Returns: full payslip breakdown (earnings, deductions, YTD, 
              ewa_advances_deducted)

GET  /api/v1/payslips/:pay_period_start/pdf
     Returns: binary PDF stream
```

### Spending / budget endpoints

```
GET  /api/v1/spending/accounts
     Returns: linked bank accounts with balances (open banking)

POST /api/v1/spending/accounts/link
     Body: { bank: string, auth_code: string }  (open banking OAuth)

GET  /api/v1/spending/summary
     Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
     Returns: total_spent, by_category[], daily_totals[]

GET  /api/v1/spending/bills
     Returns: bill_reminders[]

POST /api/v1/spending/bills
     Body: { name, amount, due_day_of_month, category }
     Returns: created bill reminder

PUT  /api/v1/spending/budget
     Body: { method: '503020'|'zerobased'|'custom', categories: [] }
     Returns: updated budget config
```

### Savings endpoints

```
GET  /api/v1/savings/pots
     Returns: savings_pots[] with balances and progress

POST /api/v1/savings/pots
     Body: { name, emoji, target_amount?, auto_save_amount?, round_up_enabled }
     Returns: created pot

PUT  /api/v1/savings/pots/:id
     Body: partial pot update
     Returns: updated pot

POST /api/v1/savings/pots/:id/deposit
     Body: { amount }
     Returns: updated balance, transaction record
```

### Notifications endpoints

```
GET  /api/v1/notifications
     Query: ?category=pay|savings|payslip|wellbeing|pension&limit=50
     Returns: notifications[] with read status

POST /api/v1/notifications/:id/read
     Returns: updated notification

POST /api/v1/notifications/mark-all-read
     Returns: { updated_count }
```

---

## Error handling

All errors follow this structure:

```json
{
  "error": {
    "code": "EWA_INSUFFICIENT_BALANCE",
    "message": "Requested amount exceeds available balance",
    "details": {
      "requested": 100.00,
      "available": 68.25
    },
    "fca_reference": null,
    "support_reference": "REF-20260527-001234"
  }
}
```

### Error codes (EWA-specific)

```
EWA_INSUFFICIENT_BALANCE      - Requested > available
EWA_MONTHLY_LIMIT_EXCEEDED    - Would exceed monthly cap
EWA_PER_TRANSFER_LIMIT        - Exceeds per-transfer self-control
EWA_COOLING_OFF_ACTIVE        - Within cooling-off window
EWA_ACCOUNT_PAUSED            - Employee has paused access
EWA_PAYROLL_LOCKDOWN          - Deduction queue is processing (transfers still work)
EWA_NOT_ELIGIBLE              - Employee not eligible (tenure, employer config)
EWA_FCA_DISCLOSURE_REQUIRED   - fca_disclosure_acknowledged must be true
EWA_TRANSFER_IN_PROGRESS      - Concurrent transfer attempt
```

---

## iQ360 instrumentation events

All events flow through `Iq360Service.emit()` in
`src/common/instrumentation/iq360.service.ts`. The service is
fire-and-forget — it never throws back into the call site so an
instrumentation outage cannot block a transfer, balance fetch, or
any other user-facing flow. Payload contract: every event carries
`event` (name), `timestamp` (ISO 8601), `employee_id` (FAID — **never**
the internal UUID or NI number), `employer_id` where the action is
employer-scoped, and optional `properties`.

```yaml
events:
  # EWA — transfer lifecycle
  - name: ewa.transfer.initiated
    properties: [employee_id, employer_id, amount, transfer_speed]
  - name: ewa.transfer.completed
    properties: [employee_id, employer_id, amount, fee, transfer_speed]
  - name: ewa.transfer.failed
    properties: [employee_id, employer_id, amount, transfer_speed, error_code]
    # error_code is the HttpException 'code' field (e.g. EWA_FCA_DISCLOSURE_REQUIRED)
  - name: ewa.balance.viewed
    properties: [employee_id, employer_id]
  - name: ewa.transfers.list.viewed
    properties: [employee_id, employer_id, result_count]

  # EWA — FCA compliance gates
  - name: ewa.fca.disclosure_shown
    properties: [employee_id, employer_id]
    # Fires alongside ewa.balance.viewed — the balance card carries the FCA copy
  - name: ewa.fca.disclosure_acknowledged
    properties: [employee_id, employer_id]
    # Fires when the controller sees fcaDisclosureAcknowledged: true on a transfer

  # Self-controls
  - name: ewa.self_control.updated
    properties: [employee_id, employer_id, fields_changed]
    # fields_changed[] is filtered to keys the caller actually sent;
    # raw values never leave the service (CLAUDE.md rule 4 / 5)
  - name: ewa.self_control.override
    properties: [employee_id, employer_id, control_type]
    # Reason is free-text and could carry PII — only the bucket goes to iQ360
  - name: ewa.account.paused
    properties: [employee_id, employer_id, duration_days]

  # Earnings + shifts
  - name: earnings.tracker.viewed
    properties: [employee_id, employer_id]
  - name: shifts.viewed
    properties: [employee_id, employer_id]

  # Notifications
  - name: notifications.list.viewed
    properties: [employee_id, result_count, unread_count, category]
    # category is set only when the caller filters by one
  - name: notifications.read
    properties: [employee_id, notification_id, category]

  # Payslips
  - name: payslip.viewed
    properties: [employee_id, pay_period_start]
  - name: payslip.pdf.downloaded
    properties: [employee_id, pay_period_start]

  # Coach
  - name: coach.session.started
    properties: [employee_id, employer_id]
    # Fires only on the first message of a session (empty conversationHistory)

  # Employer dashboard (workforce-aggregate; no employee_id — rule 5)
  - name: employer.dashboard.viewed
    properties: [employer_id]

  # Wealth-building modules
  - name: savings.pot.viewed
    properties: [employee_id, employer_id, pot_count]
  - name: budget.viewed
    properties: [employee_id, employer_id]
  - name: wellbeing.score.viewed
    properties: [employee_id, employer_id, score, band]
  - name: benefits.viewed
    properties: [employee_id, employer_id, nmw_compliant, pension_auto_enrol_eligible]
  - name: discounts.viewed
    properties: [employee_id, employer_id, partner_count, employer_perk_count]
  - name: pension.viewed
    properties: [employee_id, employer_id, auto_enrolment_status]
```

---

## Security requirements

```
ENCRYPTION_AT_REST:     AES-256 for bank account details
ENCRYPTION_IN_TRANSIT:  TLS 1.3 minimum
PII_IN_LOGS:            Never log sort code, account number, or full name
RATE_LIMITING:          10 transfer attempts per hour per employee
SESSION_TIMEOUT:        30 minutes inactivity
AUDIT_LOG_INTEGRITY:    Audit records are append-only, never updated or deleted
GDPR_DATA_EXPORT:       Employee can request all their data (DSAR)
GDPR_RIGHT_TO_ERASURE:  Supported except for FCA-required audit records (7yr retention)
```

---

## Environment configuration

```yaml
# Required environment variables
DATABASE_URL:           PostgreSQL connection string
REDIS_URL:              Redis connection string
FOURTH_WFM_API_URL:     Fourth WFM API base URL
FOURTH_WFM_API_KEY:     Service-to-service API key
FOURTH_PAYROLL_API_URL: Fourth Payroll API base URL
FOURTH_PAYROLL_API_KEY: Service-to-service API key
FOURTH_HR_API_URL:      Fourth HR API base URL
FOURTH_HR_API_KEY:      Service-to-service API key
JWT_PUBLIC_KEY:         Fourth SSO public key for JWT verification
ENCRYPTION_KEY:         AES-256 key for PII encryption
IQ360_API_URL:          iQ360 event ingestion endpoint
IQ360_API_KEY:          iQ360 service key
OPEN_BANKING_CLIENT_ID: Open Banking API client ID
OPEN_BANKING_SECRET:    Open Banking API secret

# Feature flags
FEATURE_OPEN_BANKING:   true/false (open banking integration)
FEATURE_LOANS:          true/false (workplace loans)
FEATURE_PENSION_FINDER: true/false (pension finder)
FEATURE_AI_COACH:       true/false (AI money coach)
```
