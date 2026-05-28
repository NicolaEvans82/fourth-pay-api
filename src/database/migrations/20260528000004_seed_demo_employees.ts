import { MigrationInterface, QueryRunner } from 'typeorm';

// Seed migration — populates the rows the in-memory code already
// assumes exist (Crown Pub Group as the demo employer, Jordan Harris
// and Marcus Thompson as enrolled employees, Marcus's tighter £150
// self-controls cap). Without this, the Pg-backed adapters would have
// no employee_accounts row to FK against and every balance/transfer
// request would 404.
//
// The UUIDs match the constants the in-memory code uses:
//   - JORDAN_ACCOUNT.id  = '00000000-0000-0000-0000-000000000001'
//   - MARCUS_ACCOUNT.id  = '11111111-1111-1111-1111-111111111111'
// (see src/database/readers/employee-account.reader.ts). Keeping them
// aligned means the same UUIDs work whether you're in in-memory or
// Pg mode, so the existing tests, prototype, and demo flow don't have
// to be re-anchored.
export class SeedDemoEmployees20260528000004 implements MigrationInterface {
  name = 'SeedDemoEmployees20260528000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crown Pub Group's employer_config. Matches the mock's
    // CROWN_PUB_GROUP_CONFIG in src/integrations/hr/hr.mock.ts.
    await queryRunner.query(`
      INSERT INTO employer_config (
        fourth_employer_id,
        max_access_percent,
        fee_subsidised,
        min_tenure_days,
        enabled,
        payroll_lockdown_start_day,
        payroll_lockdown_end_day
      ) VALUES (
        'CROWN-PUB-GROUP',
        50,
        false,
        90,
        true,
        27,
        31
      )
      ON CONFLICT (fourth_employer_id) DO NOTHING
    `);

    // Jordan Harris — Bar Supervisor.
    await queryRunner.query(`
      INSERT INTO employee_accounts (
        id, fourth_employee_id, fourth_employer_id, status, enrolled_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        'JORDANHARRIS000001',
        'CROWN-PUB-GROUP',
        'active',
        '2024-08-15T00:00:00Z'
      )
      ON CONFLICT (fourth_employee_id) DO NOTHING
    `);

    // Marcus Thompson — Hotel Receptionist.
    await queryRunner.query(`
      INSERT INTO employee_accounts (
        id, fourth_employee_id, fourth_employer_id, status, enrolled_at
      ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'MARCUSTHOMPSON000001',
        'CROWN-PUB-GROUP',
        'active',
        '2025-08-20T00:00:00Z'
      )
      ON CONFLICT (fourth_employee_id) DO NOTHING
    `);

    // Marcus's tighter £150 monthly self-controls cap. Mirrors the
    // seed in InMemorySelfControlsStore.seedAll(). Jordan keeps the
    // service-level default (£200) by simply not having a row here —
    // SelfControlsService.get() falls back to defaultRecord() when
    // findByEmployeeAccountId() returns null.
    await queryRunner.query(`
      INSERT INTO self_controls (
        employee_account_id,
        monthly_limit_enabled, monthly_limit_amount,
        per_transfer_limit_enabled, per_transfer_limit_amount,
        cooling_off_enabled, cooling_off_hours,
        auto_save_enabled, auto_save_percent,
        wellbeing_nudges_enabled, paused_until
      ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        true, 150.00,
        false, NULL,
        false, 48,
        false, 10,
        true, NULL
      )
      ON CONFLICT (employee_account_id) DO NOTHING
    `);

    // Jordan's Emergency fund — default pot, target £500, balance £45
    // from 3 prior auto-saves. Mirrors the InMemorySavingsPotStore
    // seed. Requires migration 5 (savings_pots) to have run first.
    await queryRunner.query(`
      INSERT INTO savings_pots (
        id, employee_account_id, name, target_amount, balance, is_default
      ) VALUES (
        '22222222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-000000000001',
        'Emergency fund',
        500.00,
        45.00,
        true
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM savings_pots WHERE employee_account_id IN (
         '00000000-0000-0000-0000-000000000001',
         '11111111-1111-1111-1111-111111111111'
       )`,
    );
    await queryRunner.query(
      `DELETE FROM self_controls WHERE employee_account_id IN (
         '00000000-0000-0000-0000-000000000001',
         '11111111-1111-1111-1111-111111111111'
       )`,
    );
    await queryRunner.query(
      `DELETE FROM employee_accounts WHERE fourth_employee_id IN (
         'JORDANHARRIS000001',
         'MARCUSTHOMPSON000001'
       )`,
    );
    await queryRunner.query(
      `DELETE FROM employer_config WHERE fourth_employer_id = 'CROWN-PUB-GROUP'`,
    );
  }
}
