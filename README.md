# Fourth Pay API

FCA-regulated Earned Wage Access (EWA) for the Fourth hospitality platform.
Lets employees access wages they've already earned ahead of payday, with
employer-configurable controls, FCA disclosure gates, self-imposed limits,
and a deterministic payroll-deduction queue.

> Built on NestJS · TypeScript · PostgreSQL (when wired) · Anthropic Claude
> for the in-app money coach. The prototype runs purely on in-memory mocks
> so it can be demoed end-to-end without a database.

## Live URLs

| What | URL |
|---|---|
| API (Railway) | <https://fourth-pay-api-production.up.railway.app> |
| Employee app (GitHub Pages) | <https://nicolaevans82.github.io/fourth-pay-api/> |
| Employer dashboard | <https://nicolaevans82.github.io/fourth-pay-api/employer.html> |
| Health check | <https://fourth-pay-api-production.up.railway.app/health> |

Two demo personas are hard-wired into the prototype:

- **Jordan Harris** — Bar Supervisor at Crown Pub Group. FAID `JORDANHARRIS000001`.
- **Marcus Thompson** — Hotel Receptionist at Crown Pub Group. FAID `MARCUSTHOMPSON000001`.

Switch between them via the pill bar at the top of the home screen.

## Run it locally

```bash
nvm use 20            # Node 20 LTS
npm install
npm run start:dev     # nest start --watch on http://localhost:3000
```

Smoke test:

```bash
curl -s http://localhost:3000/api/v1/ewa/balance \
  -H 'x-fourth-employee-id: JORDANHARRIS000001' \
  -H 'x-fourth-employer-id: CROWN-PUB-GROUP' | jq
```

The demo data is seeded automatically at module init (transfers,
notifications, self-controls). Calling `POST /api/v1/demo/reset` wipes
the in-memory state and reapplies the seed — useful between demos.

## Environment variables

| Variable | Used for | Required? |
|---|---|---|
| `PORT` | HTTP listen port. Railway injects this automatically; do not hardcode. | No — defaults to `3000`. |
| `NODE_ENV` | `production` switches to Pg-backed stores when `DATABASE_URL` is also set; `test` keeps in-memory (Jest default). | No — defaults to development. |
| `DATABASE_URL` | Postgres connection string. When set in production, all reader/writer tokens bind to the Pg-backed implementations. Without it, the API keeps running on in-memory mocks (current Railway deploy mode). | Optional. |
| `ANTHROPIC_API_KEY` | Real LLM calls for the in-app money coach. Currently the coach is keyword-routed and **does not** need this — see `src/modules/coach/coach.service.ts`. Re-add if you swap the coach back to a live model. | No (current build). |
| `FOURTH_HCM_API_URL` | Base URL for the Fourth HCM PeopleSystem Integration API. Production-only. | Required when switching `MockWfmAdapter` → `FourthWfmAdapter`. |
| `FOURTH_HCM_ORG_TOKEN` | Org credential for the same API. | Same as above. |
| `FOURTH_HCM_ORG_ID` | Organisation ID for the same API. | Same as above. |

## Open questions for Ali Barlow

The real WFM adapter (`src/integrations/wfm/wfm.adapter.ts`) has two
unresolved points before it can call the Fourth HCM **PeopleSystem
Integration API** in anger:

1. **Base URL + endpoint path for `GET Approved hours`.** Doc 5 names
   the operation but does not specify the URL pattern. Current code
   guesses `${FOURTH_HCM_API_URL}/peoplesystem/approvedhours?FAID=...&from=...&to=...`
   — needs confirmation. (`wfm.adapter.ts:69-71`)
2. **Authentication header name.** Current code sends `X-Fourth-Org-Token`
   + `X-Fourth-Org-Id` but the actual header schema isn't documented in
   doc 5. (`wfm.adapter.ts:79`)

The same uncertainty applies in `payroll.adapter.ts` and `hr.adapter.ts`
for the corresponding HR/Payroll endpoints — Ali Barlow review needed
there too.

## Tests

```bash
npm test              # jest, 32 specs across 6 suites
npm run test:cov      # with coverage
npm run test:e2e      # /test/jest-e2e.json — currently empty scaffold
```

Tests run with `NODE_ENV=test` (Jest default), which keeps every store
on its in-memory implementation. The production switch in
`app.module.ts` ignores test by design.

## Build

```bash
npm run build         # nest build → dist/
npm run start:prod    # node dist/main.js
```

The Railway build runs `npm run build` then `npm run start:prod` per
`railway.json`. The container binds to `0.0.0.0` so Railway's edge
proxy can reach it (see `src/main.ts`).

## Project structure

```
src/
├── main.ts                      # CORS + ValidationPipe + 0.0.0.0 bind
├── app.module.ts                # Wires every feature module
├── modules/
│   ├── ewa/                     # /api/v1/ewa — balance, transfer, transfers, earnings
│   ├── self-controls/           # /api/v1/self-controls
│   ├── payslip/                 # /api/v1/payslips
│   ├── notifications/           # /api/v1/notifications
│   ├── coach/                   # /api/v1/coach/message — money coach
│   ├── employer/                # /api/v1/employer/stats — dashboard aggregates
│   ├── shifts/                  # /api/v1/shifts — upcoming + recent + weekly
│   └── demo/                    # /api/v1/demo/reset — re-seed in-memory stores
├── integrations/
│   ├── wfm/                     # MockWfmAdapter + FourthWfmAdapter (TODOs above)
│   ├── hr/                      # MockHrAdapter + FourthHrAdapter
│   ├── payroll/                 # MockPayrollAdapter + FourthPayrollAdapter
│   └── fourth-hcm.module.ts     # Shared FOURTH_HCM_CONFIG provider
└── database/
    ├── pg.ts                    # PG_POOL token + Pool factory
    ├── database.module.ts       # Selects Pg-backed bindings when DATABASE_URL is set
    ├── migrations/              # TypeORM migrations (run before Pg stores work)
    ├── readers/ writers/        # Interfaces + InMemory* + Pg* implementations
    ├── ewa-transfer.store.ts    # Seeded baseline for the demo
    ├── self-controls.store.ts
    └── notifications.store.ts
docs/
├── 01-product-context.md        # Product narrative + FCA rules + earnings formula
├── 02-technical-architecture.md # Service layout + DB schema + API contracts
├── 03-feature-specs.md          # YAML spec per feature (P0–P2)
├── 04-claude-code-instructions.md # Operating rules for AI contributions
├── 05-integration-contracts.md  # Fourth HCM endpoint contracts
├── index.html                   # Employee app prototype (mobile-framed)
└── employer.html                # Employer dashboard prototype (desktop)
openapi.yaml                     # Full API contract (OpenAPI 3.1)
```

## API reference

A complete OpenAPI 3.1 spec lives in [`openapi.yaml`](./openapi.yaml).
Headers expected on every employee-scoped endpoint:

- `x-fourth-employee-id: <FAID>`
- `x-fourth-employer-id: <employer ID>`

`/api/v1/employer/stats` only needs the employer ID.
`/api/v1/coach/message`, `/api/v1/demo/reset`, `/health`, and `/` are
public.

## Hard rules (from `CLAUDE.md`)

1. Never modify the earnings calculation formula.
2. Never write directly to Fourth Payroll — all writes go via the
   `payroll_deduction_queue`.
3. Always require `fcaDisclosureAcknowledged: true` before executing a
   transfer.
4. Never log `sort_code`, `account_number`, or `national_insurance_number`.
5. Never allow the employer to access individual employee transfer data.
6. The audit log is append-only — never `UPDATE` or `DELETE` an
   `audit_log` row.
7. Use the Fourth design system exactly — no new colours or font weights.
