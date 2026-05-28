import { MigrationInterface, QueryRunner } from 'typeorm';

// Tables backing src/database/notifications.store.ts.
// Categories and urgencies are kept as VARCHAR + CHECK rather than ENUM
// types so adding values later doesn't require a schema migration.
export class CreateNotificationsTables20260527000003
  implements MigrationInterface
{
  name = 'CreateNotificationsTables20260527000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_account_id   UUID NOT NULL REFERENCES employee_accounts(id),
        category              VARCHAR(32) NOT NULL,
        title                 VARCHAR(255) NOT NULL,
        body                  TEXT NOT NULL,
        screen_link           VARCHAR(255) NOT NULL,
        urgency               VARCHAR(16) NOT NULL DEFAULT 'normal',
        fca_required          BOOLEAN NOT NULL DEFAULT false,
        read_at               TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT notifications_category_chk
          CHECK (category IN ('pay','savings','payslip','wellbeing','pension','bills','system')),
        CONSTRAINT notifications_urgency_chk
          CHECK (urgency IN ('normal','warning','urgent'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_notifications_employee_created
         ON notifications (employee_account_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_notifications_unread
         ON notifications (employee_account_id) WHERE read_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE notification_preferences (
        employee_account_id   UUID PRIMARY KEY REFERENCES employee_accounts(id),
        disabled_categories   VARCHAR(32)[] NOT NULL DEFAULT '{}',
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_preferences`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
  }
}
