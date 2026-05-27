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

```
src/
├── modules/
│   ├── ewa/                    # Core EWA engine
│   │   ├── ewa.controller.ts
│   │   ├── ewa.service.ts
│   │   ├── balance.service.ts  # Earnings calculation
│   │   ├── transfer.service.ts # Transfer execution
│   │   ├── cooling-off.service.ts
│   │   └── ewa.module.ts
│   │
│   ├── payslip/               # Payslip aggregation
│   ├── savings/               # Savings pots
│   ├── loans/                 # Workplace loans
│   ├── benefits/              # Benefits checker
│   ├── pension/               # Pension finder
│   ├── coach/                 # AI money coach
│   ├── spending/              # Open banking / budget
│   ├── discounts/             # Discount catalogue
│   ├── notifications/         # Push + in-app notifications
│   ├── self-controls/         # Employee self-controls
│   └── wellbeing/             # Wellbeing score + insights
│
├── integrations/
│   ├── wfm/                   # Fourth WFM adapter
│   │   ├── wfm.adapter.ts
│   │   ├── wfm.types.ts
│   │   └── wfm.mock.ts        # Mock for local dev
│   ├── payroll/               # Fourth Payroll adapter
│   │   ├── payroll.adapter.ts
│   │   ├── payroll.types.ts
│   │   ├── deduction-queue.service.ts
│   │   └── payroll.mock.ts
│   └── hr/                    # Fourth HR adapter
│       ├── hr.adapter.ts
│       ├── hr.types.ts
│       └── hr.mock.ts
│
├── common/
│   ├── audit/                 # FCA audit logging
│   ├── guards/                # Auth guards
│   ├── filters/               # Exception filters
│   ├── interceptors/          # Logging, transform
│   └── decorators/            # Custom decorators
│
└── database/
    ├── migrations/
    └── entities/
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

Every feature must emit defined events to iQ360. These are the events for the EWA module:

```yaml
events:
  # Transfer events
  - name: ewa.transfer.initiated
    properties: [employee_id, amount, transfer_speed, fee_amount, fee_subsidised]
    
  - name: ewa.transfer.completed
    properties: [employee_id, amount, transfer_speed, fee_amount, duration_ms]
    
  - name: ewa.transfer.failed
    properties: [employee_id, amount, error_code, failure_reason]
    
  # Balance check (indicates engagement)
  - name: ewa.balance.viewed
    properties: [employee_id, available_amount, period_day_number]
    
  # Self-controls events
  - name: ewa.self_control.updated
    properties: [employee_id, control_type, previous_value, new_value]
    
  - name: ewa.self_control.override
    properties: [employee_id, control_type, has_reason]
    # Note: reason text is NOT sent to iQ360 — privacy
    
  - name: ewa.account.paused
    properties: [employee_id, duration_days]
    
  # FCA compliance events  
  - name: ewa.fca.disclosure_shown
    properties: [employee_id, disclosure_type, context]
    
  - name: ewa.fca.disclosure_acknowledged
    properties: [employee_id, disclosure_type, acknowledged_at]
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
