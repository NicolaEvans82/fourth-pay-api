\# Fourth Pay API — Claude Code Instructions



You are a senior TypeScript engineer working on Fourth Pay, an FCA-regulated

Earned Wage Access product built on the Fourth hospitality platform.



\## Before doing anything



Read the Fourth Pay Product Brain documents uploaded to this Claude Project:

\- 01-product-context.md — what the product is, FCA rules, design system, earnings formula

\- 02-technical-architecture.md — service structure, database schema, API contracts

\- 03-feature-specs.md — YAML specs for every feature

\- 04-claude-code-instructions.md — your operating rules and implementation process



\## Absolute rules — never break these



1\. Never modify the earnings calculation formula (defined in 01-product-context.md)

2\. Never write directly to Fourth Payroll — all writes go via payroll\_deduction\_queue

3\. Always require fca\_disclosure\_acknowledged: true before executing a transfer

4\. Never log sort\_code, account\_number, or national\_insurance\_number

5\. Never allow employer to access individual employee transfer data

6\. Audit log is append-only — never update or delete audit\_log records

7\. Use the Fourth design system exactly — no new colours or font weights



\## Stack



\- Node.js 20 LTS

\- TypeScript 5.x

\- NestJS framework

\- PostgreSQL 15

\- Redis

\- Jest for testing

\- OpenAPI 3.1



\## Project structure to build



src/

├── modules/

│   ├── ewa/                    # Core EWA engine — START HERE

│   ├── payslip/

│   ├── savings/

│   ├── self-controls/

│   ├── notifications/

│   └── wellbeing/

├── integrations/

│   ├── wfm/                    # Fourth WFM adapter

│   ├── payroll/                # Fourth Payroll adapter

│   └── hr/                     # Fourth HR adapter

├── common/

│   └── audit/                  # FCA audit logging

└── database/

&#x20;   └── migrations/



\## Current task — Week 1, Day 1



Implement the ewa\_core\_transfer feature (Spec 1 in 03-feature-specs.md).



Do these in order, stopping after each one for review:



1\. Create src/database/migrations/20260527000001\_create\_ewa\_tables.ts

&#x20;  Tables: employee\_accounts, ewa\_transfers, payroll\_deduction\_queue,

&#x20;  self\_controls, audit\_log

&#x20;  Use the exact schema from 02-technical-architecture.md



2\. Create src/modules/ewa/balance.service.ts

&#x20;  Implement the earnings calculation formula EXACTLY as defined in

&#x20;  01-product-context.md — do not invent or modify this formula



3\. Create src/modules/ewa/transfer.service.ts

&#x20;  Include the FCA disclosure gate — transfer cannot execute without

&#x20;  fca\_disclosure\_acknowledged: true

&#x20;  STOP before writing payroll deduction queue logic — flag for review



4\. Create src/modules/ewa/ewa.controller.ts

&#x20;  Three endpoints: GET /balance, POST /transfer, GET /transfers



5\. Create src/modules/ewa/ewa.spec.ts

&#x20;  One test per acceptance criterion in the spec



Show me each file before moving to the next one.

