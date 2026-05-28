import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../pg';
import type {
  AuditEvent,
  AuditEventType,
  AuditLogWriter,
} from './audit-log.writer';

// CLAUDE.md rule 6: audit_log is append-only. This writer exposes
// only `append`. Production should additionally lock down UPDATE /
// DELETE at the DB role level.
@Injectable()
export class PgAuditLogWriter implements AuditLogWriter {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async append(input: {
    employeeAccountId: string;
    eventType: AuditEventType;
    eventData?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AuditEvent> {
    const r = await this.pool.query<{
      id: string;
      employee_account_id: string;
      event_type: AuditEventType;
      event_data: Record<string, unknown>;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(
      `INSERT INTO audit_log (
         employee_account_id, event_type, event_data, ip_address, user_agent
       ) VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING *`,
      [
        input.employeeAccountId,
        input.eventType,
        JSON.stringify(input.eventData ?? {}),
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );
    const row = r.rows[0];
    return {
      id: row.id,
      employeeAccountId: row.employee_account_id,
      eventType: row.event_type,
      eventData: row.event_data,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    };
  }
}
