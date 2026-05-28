import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './pg';
import type {
  NewNotification,
  Notification,
  NotificationCategory,
  NotificationPreferences,
  NotificationsStore,
  NotificationUrgency,
} from './notifications.store';

@Injectable()
export class PgNotificationsStore implements NotificationsStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(input: NewNotification): Promise<Notification> {
    const r = await this.pool.query<NotificationRow>(
      `INSERT INTO notifications (
         employee_account_id, category, title, body,
         screen_link, urgency, fca_required
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.employeeAccountId,
        input.category,
        input.title,
        input.body,
        input.screenLink,
        input.urgency,
        input.fcaRequired ?? false,
      ],
    );
    return fromRow(r.rows[0]);
  }

  async list(input: {
    employeeAccountId: string;
    category?: NotificationCategory;
  }): Promise<Notification[]> {
    const sql = input.category
      ? `SELECT * FROM notifications
          WHERE employee_account_id = $1 AND category = $2
          ORDER BY created_at DESC`
      : `SELECT * FROM notifications
          WHERE employee_account_id = $1
          ORDER BY created_at DESC`;
    const params = input.category
      ? [input.employeeAccountId, input.category]
      : [input.employeeAccountId];
    const r = await this.pool.query<NotificationRow>(sql, params);
    return r.rows.map(fromRow);
  }

  async markRead(input: {
    id: string;
    employeeAccountId: string;
  }): Promise<Notification | null> {
    const r = await this.pool.query<NotificationRow>(
      `UPDATE notifications
          SET read_at = COALESCE(read_at, NOW())
        WHERE id = $1 AND employee_account_id = $2
        RETURNING *`,
      [input.id, input.employeeAccountId],
    );
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async markAllRead(input: { employeeAccountId: string }): Promise<number> {
    const r = await this.pool.query(
      `UPDATE notifications
          SET read_at = NOW()
        WHERE employee_account_id = $1 AND read_at IS NULL`,
      [input.employeeAccountId],
    );
    return r.rowCount ?? 0;
  }

  async getPreferences(
    employeeAccountId: string,
  ): Promise<NotificationPreferences> {
    const r = await this.pool.query<{
      disabled_categories: NotificationCategory[];
    }>(
      `SELECT disabled_categories
         FROM notification_preferences
        WHERE employee_account_id = $1`,
      [employeeAccountId],
    );
    return {
      employeeAccountId,
      disabledCategories: r.rows[0]?.disabled_categories ?? [],
    };
  }

  async setPreferences(input: NotificationPreferences): Promise<void> {
    await this.pool.query(
      `INSERT INTO notification_preferences
         (employee_account_id, disabled_categories, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (employee_account_id) DO UPDATE SET
         disabled_categories = EXCLUDED.disabled_categories,
         updated_at = NOW()`,
      [input.employeeAccountId, input.disabledCategories],
    );
  }
}

interface NotificationRow {
  id: string;
  employee_account_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  screen_link: string;
  urgency: NotificationUrgency;
  fca_required: boolean;
  read_at: Date | null;
  created_at: Date;
}

function fromRow(r: NotificationRow): Notification {
  return {
    id: r.id,
    employeeAccountId: r.employee_account_id,
    category: r.category,
    title: r.title,
    body: r.body,
    screenLink: r.screen_link,
    urgency: r.urgency,
    fcaRequired: r.fca_required,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}
