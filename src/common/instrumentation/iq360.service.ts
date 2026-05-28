import { Injectable, Logger } from '@nestjs/common';

// iQ360 event payload. `employee_id` is the FAID — never a UUID, PII,
// or any account-level identifier. CLAUDE.md rule 4: sort_code,
// account_number, and national_insurance_number must never appear in
// any event payload. Rule 5: never emit other employees' data.
export interface Iq360Event {
  event: string;
  employee_id?: string;
  employer_id?: string;
  properties?: Record<string, unknown>;
}

const TIMEOUT_MS = 2000;

@Injectable()
export class Iq360Service {
  private readonly logger = new Logger('iQ360');
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor() {
    this.endpoint = process.env.IQ360_API_URL ?? '';
    this.apiKey = process.env.IQ360_API_KEY ?? '';
    this.enabled = !!(this.endpoint && this.apiKey);
    if (process.env.NODE_ENV === 'production' && !this.enabled) {
      this.logger.warn(
        'IQ360_API_URL or IQ360_API_KEY unset — events will only be logged, not delivered.',
      );
    }
  }

  // Fire-and-forget. Instrumentation must never throw at the call site —
  // a downed iQ360 cannot block a transfer or balance fetch.
  emit(eventName: string, payload: Omit<Iq360Event, 'event'> = {}): void {
    const enriched: Iq360Event & { timestamp: string } = {
      event: eventName,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    if (process.env.NODE_ENV === 'production' && this.enabled) {
      void this.send(enriched);
    } else {
      // Dev / test: console-log so engineers can verify wiring without
      // standing up an iQ360 endpoint. Tests use Jest's default
      // NODE_ENV=test and land here too.
      this.logger.log(JSON.stringify(enriched));
    }
  }

  private async send(event: Iq360Event & { timestamp: string }): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(
          `iQ360 emit failed for ${event.event}: HTTP ${res.status}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `iQ360 emit error for ${event.event}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
