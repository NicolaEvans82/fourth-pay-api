import { Injectable, type OnModuleInit } from '@nestjs/common';
import { MARCUS_ACCOUNT } from './readers/employee-account.reader';
import type {
  SelfControlsReader,
  SelfControlsRecord,
} from './readers/self-controls.reader';
import type { SelfControlsWriter } from './writers/self-controls.writer';

@Injectable()
export class InMemorySelfControlsStore
  implements SelfControlsReader, SelfControlsWriter, OnModuleInit
{
  private readonly records = new Map<string, SelfControlsRecord>();

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    if (this.records.size > 0) return;
    this.seedAll();
  }

  // Demo-only: wipe overrides and re-seed. Jordan goes back to the
  // service-level default (£200 cap); Marcus to the tighter £150 cap.
  resetToSeed(): void {
    this.records.clear();
    this.seedAll();
  }

  private seedAll(): void {
    // Jordan keeps the service-level default (£200 cap). Marcus opts
    // for a tighter £150 monthly cap — gives the demo two distinct
    // self-control profiles out of the box.
    this.records.set(MARCUS_ACCOUNT.id, {
      employeeAccountId: MARCUS_ACCOUNT.id,
      monthlyLimitEnabled: true,
      monthlyLimitAmount: 150,
      perTransferLimitEnabled: false,
      perTransferLimitAmount: null,
      coolingOffEnabled: false,
      coolingOffHours: 48,
      autoSaveEnabled: false,
      autoSavePercent: 10,
      wellbeingNudgesEnabled: true,
      pausedUntil: null,
    });
  }

  async findByEmployeeAccountId(
    employeeAccountId: string,
  ): Promise<SelfControlsRecord | null> {
    return this.records.get(employeeAccountId) ?? null;
  }

  async upsert(record: SelfControlsRecord): Promise<SelfControlsRecord> {
    const stored = { ...record };
    this.records.set(record.employeeAccountId, stored);
    return stored;
  }
}
