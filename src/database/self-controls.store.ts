import { Injectable } from '@nestjs/common';
import type {
  SelfControlsReader,
  SelfControlsRecord,
} from './readers/self-controls.reader';
import type { SelfControlsWriter } from './writers/self-controls.writer';

@Injectable()
export class InMemorySelfControlsStore
  implements SelfControlsReader, SelfControlsWriter
{
  private readonly records = new Map<string, SelfControlsRecord>();

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
