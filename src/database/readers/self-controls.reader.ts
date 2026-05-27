import { Injectable } from '@nestjs/common';

export const SELF_CONTROLS_READER = Symbol('SelfControlsReader');

export interface SelfControlsRecord {
  employeeAccountId: string;
  monthlyLimitEnabled: boolean;
  monthlyLimitAmount: number | null;
  perTransferLimitEnabled: boolean;
  perTransferLimitAmount: number | null;
  coolingOffEnabled: boolean;
  coolingOffHours: number;
  pausedUntil: Date | null;
}

export interface SelfControlsReader {
  findByEmployeeAccountId(
    employeeAccountId: string,
  ): Promise<SelfControlsRecord | null>;
}

// Defaults match the self_controls migration: monthly limit £200 enabled,
// no per-transfer limit, no cooling-off, not paused.
@Injectable()
export class MockSelfControlsReader implements SelfControlsReader {
  async findByEmployeeAccountId(
    employeeAccountId: string,
  ): Promise<SelfControlsRecord | null> {
    return {
      employeeAccountId,
      monthlyLimitEnabled: true,
      monthlyLimitAmount: 200,
      perTransferLimitEnabled: false,
      perTransferLimitAmount: null,
      coolingOffEnabled: false,
      coolingOffHours: 48,
      pausedUntil: null,
    };
  }
}
