import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const AUDIT_LOG_WRITER = Symbol('AuditLogWriter');

export type AuditEventType =
  | 'transfer_initiated'
  | 'transfer_completed'
  | 'transfer_failed'
  | 'fca_disclosure_shown'
  | 'fca_disclosure_acknowledged'
  | 'self_control_changed'
  | 'self_control_override'
  | 'account_paused'
  | 'account_resumed'
  | 'login'
  | 'bank_account_changed'
  // Fraud-detection markers — TransferService writes these from the
  // velocity + anomaly checks. Append-only per CLAUDE.md rule 6;
  // fraud-review consumes them for follow-up action.
  | 'velocity_blocked'
  | 'amount_anomaly';

export interface AuditEvent {
  id: string;
  employeeAccountId: string;
  eventType: AuditEventType;
  eventData: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogWriter {
  append(input: {
    employeeAccountId: string;
    eventType: AuditEventType;
    eventData?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AuditEvent>;
}

// Append-only by construction — only `append` is exposed. Real Pg impl will
// also use INSERT-only access at the DB role level. See CLAUDE.md rule 6.
@Injectable()
export class InMemoryAuditLogWriter implements AuditLogWriter {
  readonly events: AuditEvent[] = [];

  async append(input: {
    employeeAccountId: string;
    eventType: AuditEventType;
    eventData?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: randomUUID(),
      employeeAccountId: input.employeeAccountId,
      eventType: input.eventType,
      eventData: input.eventData ?? {},
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date(),
    };
    this.events.push(event);
    return event;
  }
}
