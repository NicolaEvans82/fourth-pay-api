import { Inject, Injectable } from '@nestjs/common';
import {
  SELF_CONTROLS_READER,
  type SelfControlsReader,
} from '../../database/readers/self-controls.reader';

export const AUTO_SAVE_SINK = Symbol('AutoSaveSink');

export interface AutoSaveSink {
  onTransferCompleted(input: {
    employeeAccountId: string;
    transferId: string;
    transferAmount: number;
  }): Promise<void>;
}

export interface AutoSaveTrigger {
  transferId: string;
  transferAmount: number;
  savedAmount: number;
}

// Reads selfControls.autoSaveEnabled itself so TransferService doesn't have
// to encode auto-save business rules. Real impl will write to a savings pot.
@Injectable()
export class InMemoryAutoSaveSink implements AutoSaveSink {
  readonly triggered: AutoSaveTrigger[] = [];

  constructor(
    @Inject(SELF_CONTROLS_READER)
    private readonly selfControls: SelfControlsReader,
  ) {}

  async onTransferCompleted(input: {
    employeeAccountId: string;
    transferId: string;
    transferAmount: number;
  }): Promise<void> {
    const sc = await this.selfControls.findByEmployeeAccountId(
      input.employeeAccountId,
    );
    if (!sc?.autoSaveEnabled) return;
    const savedAmount =
      Math.round(input.transferAmount * (sc.autoSavePercent / 100) * 100) /
      100;
    this.triggered.push({
      transferId: input.transferId,
      transferAmount: input.transferAmount,
      savedAmount,
    });
  }
}
