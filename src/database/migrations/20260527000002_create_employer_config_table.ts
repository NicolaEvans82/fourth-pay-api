import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployerConfigTable20260527000002
  implements MigrationInterface
{
  name = 'CreateEmployerConfigTable20260527000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employer_config (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fourth_employer_id          VARCHAR(64) NOT NULL UNIQUE,
        max_access_percent          INTEGER NOT NULL DEFAULT 50,
        fee_subsidised              BOOLEAN NOT NULL DEFAULT false,
        min_tenure_days             INTEGER NOT NULL DEFAULT 0,
        enabled                     BOOLEAN NOT NULL DEFAULT true,
        payroll_lockdown_start_day  INTEGER DEFAULT 27,
        payroll_lockdown_end_day    INTEGER DEFAULT 31,
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT employer_config_max_access_chk
          CHECK (max_access_percent BETWEEN 0 AND 50),
        CONSTRAINT employer_config_min_tenure_chk
          CHECK (min_tenure_days >= 0),
        CONSTRAINT employer_config_lockdown_start_chk
          CHECK (payroll_lockdown_start_day BETWEEN 1 AND 31),
        CONSTRAINT employer_config_lockdown_end_chk
          CHECK (payroll_lockdown_end_day BETWEEN 1 AND 31)
      )
    `);
    await queryRunner.query(
      `COMMENT ON CONSTRAINT employer_config_max_access_chk ON employer_config IS
         'FCA EWA Code of Practice: monthly access capped at 50% of earned wages.'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employer_config`);
  }
}
