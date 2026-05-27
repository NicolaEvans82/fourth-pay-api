import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEwaTables20260527000001 implements MigrationInterface {
  name = 'CreateEwaTables20260527000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE employee_accounts (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fourth_employee_id    VARCHAR(64) NOT NULL UNIQUE,
        fourth_employer_id    VARCHAR(64) NOT NULL,
        enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status                VARCHAR(32) NOT NULL DEFAULT 'active',
        bank_account_id       UUID,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT employee_accounts_status_chk
          CHECK (status IN ('active', 'paused', 'suspended', 'closed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_employee_accounts_employer ON employee_accounts (fourth_employer_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE bank_accounts (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
        account_name          VARCHAR(128),
        sort_code             CHAR(6),
        account_number        CHAR(8),
        bank_name             VARCHAR(64),
        is_primary            BOOLEAN NOT NULL DEFAULT false,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `COMMENT ON COLUMN bank_accounts.sort_code IS
         'Encrypted at rest (AES-256). Never log this column.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN bank_accounts.account_number IS
         'Encrypted at rest (AES-256). Never log this column.'`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_bank_accounts_employee ON bank_accounts (employee_account_id)`,
    );

    await queryRunner.query(`
      ALTER TABLE employee_accounts
        ADD CONSTRAINT employee_accounts_bank_account_fk
        FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
    `);

    await queryRunner.query(`
      CREATE TABLE ewa_transfers (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
        pay_period_start      DATE NOT NULL,
        pay_period_end        DATE NOT NULL,
        requested_amount      DECIMAL(10,2) NOT NULL,
        fee_amount            DECIMAL(10,2) NOT NULL,
        fee_subsidised        BOOLEAN NOT NULL DEFAULT false,
        net_amount            DECIMAL(10,2) NOT NULL,
        transfer_speed        VARCHAR(16) NOT NULL,
        status                VARCHAR(32) NOT NULL DEFAULT 'pending',
        bank_account_id       UUID REFERENCES bank_accounts(id),
        initiated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at          TIMESTAMPTZ,
        failure_reason        TEXT,
        fca_disclosure_shown  BOOLEAN NOT NULL DEFAULT false,
        fca_disclosure_at     TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT ewa_transfers_speed_chk
          CHECK (transfer_speed IN ('instant', 'standard')),
        CONSTRAINT ewa_transfers_status_chk
          CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed')),
        CONSTRAINT ewa_transfers_amounts_chk
          CHECK (requested_amount >= 0 AND fee_amount >= 0 AND net_amount >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_ewa_transfers_employee_period
         ON ewa_transfers (employee_account_id, pay_period_start)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_ewa_transfers_status ON ewa_transfers (status)`,
    );

    await queryRunner.query(`
      CREATE TABLE payroll_deduction_queue (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ewa_transfer_id       UUID NOT NULL REFERENCES ewa_transfers(id),
        employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
        fourth_employee_id    VARCHAR(64) NOT NULL,
        pay_period_start      DATE NOT NULL,
        amount                DECIMAL(10,2) NOT NULL,
        status                VARCHAR(32) NOT NULL DEFAULT 'queued',
        queued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_at          TIMESTAMPTZ,
        confirmed_at          TIMESTAMPTZ,
        payroll_reference     VARCHAR(128),
        notes                 TEXT,
        CONSTRAINT payroll_deduction_queue_status_chk
          CHECK (status IN ('queued', 'submitted', 'confirmed', 'failed', 'manual_review'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_payroll_deduction_queue_status
         ON payroll_deduction_queue (status, queued_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_payroll_deduction_queue_employee_period
         ON payroll_deduction_queue (fourth_employee_id, pay_period_start)`,
    );

    await queryRunner.query(`
      CREATE TABLE self_controls (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_account_id         UUID NOT NULL UNIQUE REFERENCES employee_accounts(id),
        monthly_limit_enabled       BOOLEAN NOT NULL DEFAULT true,
        monthly_limit_amount        DECIMAL(10,2) DEFAULT 200.00,
        per_transfer_limit_enabled  BOOLEAN NOT NULL DEFAULT false,
        per_transfer_limit_amount   DECIMAL(10,2),
        cooling_off_enabled         BOOLEAN NOT NULL DEFAULT false,
        cooling_off_hours           INTEGER DEFAULT 48,
        auto_save_enabled           BOOLEAN NOT NULL DEFAULT false,
        auto_save_percent           INTEGER DEFAULT 10,
        wellbeing_nudges_enabled    BOOLEAN NOT NULL DEFAULT true,
        paused_until                TIMESTAMPTZ,
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT self_controls_cooling_off_hours_chk
          CHECK (cooling_off_hours IN (24, 48, 168)),
        CONSTRAINT self_controls_auto_save_percent_chk
          CHECK (auto_save_percent BETWEEN 5 AND 30)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE audit_log (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
        event_type            VARCHAR(64) NOT NULL,
        event_data            JSONB NOT NULL DEFAULT '{}',
        ip_address            INET,
        user_agent            TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE audit_log IS
         'FCA audit trail — append-only. 7-year retention. No UPDATE/DELETE in application code.'`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audit_log_employee_created
         ON audit_log (employee_account_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audit_log_event_type_created
         ON audit_log (event_type, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS self_controls`);
    await queryRunner.query(`DROP TABLE IF EXISTS payroll_deduction_queue`);
    await queryRunner.query(`DROP TABLE IF EXISTS ewa_transfers`);
    await queryRunner.query(`DROP TABLE IF EXISTS bank_accounts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS employee_accounts CASCADE`);
  }
}
