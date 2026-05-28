import { MigrationInterface, QueryRunner } from 'typeorm';

// Backs src/modules/savings/. Each row is one named savings pot —
// e.g. "Emergency fund", "Holiday". An employee can have many pots;
// exactly one is `is_default = true` to receive auto-save contributions.
//
// `target_amount` is the user-chosen goal (optional — null means
// "save as much as you can"). `balance` is the running total, kept
// in sync by SavingsService (manual contribute) and AutoSaveSink (on
// transfer side-effect).
export class CreateSavingsPotsTable20260528000005 implements MigrationInterface {
  name = 'CreateSavingsPotsTable20260528000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE savings_pots (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
        name                  VARCHAR(64) NOT NULL,
        target_amount         DECIMAL(10,2),
        balance               DECIMAL(10,2) NOT NULL DEFAULT 0,
        is_default            BOOLEAN NOT NULL DEFAULT false,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT savings_pots_balance_chk CHECK (balance >= 0),
        CONSTRAINT savings_pots_target_chk
          CHECK (target_amount IS NULL OR target_amount > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_savings_pots_employee
         ON savings_pots (employee_account_id)`,
    );
    // At most one default pot per employee. NULL distinct semantics
    // mean non-default rows don't conflict.
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_savings_pots_one_default_per_employee
         ON savings_pots (employee_account_id)
         WHERE is_default = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS savings_pots`);
  }
}
