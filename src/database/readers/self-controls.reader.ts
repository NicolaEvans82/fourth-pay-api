export const SELF_CONTROLS_READER = Symbol('SelfControlsReader');

export interface SelfControlsRecord {
  employeeAccountId: string;
  monthlyLimitEnabled: boolean;
  monthlyLimitAmount: number | null;
  perTransferLimitEnabled: boolean;
  perTransferLimitAmount: number | null;
  coolingOffEnabled: boolean;
  coolingOffHours: number;
  autoSaveEnabled: boolean;
  autoSavePercent: number;
  wellbeingNudgesEnabled: boolean;
  pausedUntil: Date | null;
}

export interface SelfControlsReader {
  findByEmployeeAccountId(
    employeeAccountId: string,
  ): Promise<SelfControlsRecord | null>;
}
