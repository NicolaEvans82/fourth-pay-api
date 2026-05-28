import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  SELF_CONTROLS_READER,
  type SelfControlsReader,
} from '../../database/readers/self-controls.reader';
import {
  SAVINGS_POT_READER,
  SAVINGS_POT_WRITER,
  type SavingsPotReader,
  type SavingsPotWriter,
} from '../../database/savings-pot.store';

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

// Reads selfControls.autoSaveEnabled itself so TransferService doesn't
// have to encode auto-save business rules. When autoSave is on and the
// employee has a default savings pot, credits it. Otherwise records the
// trigger in-memory so tests can observe the call.
@Injectable()
export class InMemoryAutoSaveSink implements AutoSaveSink {
  private readonly logger = new Logger(InMemoryAutoSaveSink.name);
  readonly triggered: AutoSaveTrigger[] = [];

  constructor(
    @Inject(SELF_CONTROLS_READER)
    private readonly selfControls: SelfControlsReader,
    @Optional()
    @Inject(SAVINGS_POT_READER)
    private readonly potReader?: SavingsPotReader,
    @Optional()
    @Inject(SAVINGS_POT_WRITER)
    private readonly potWriter?: SavingsPotWriter,
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
    if (this.potReader && this.potWriter && savedAmount > 0) {
      const pot = await this.potReader.findDefault(input.employeeAccountId);
      if (pot) {
        await this.potWriter.credit({ id: pot.id, amount: savedAmount });
      } else {
        this.logger.warn(
          `auto-save fired for ${input.employeeAccountId} but no default savings pot exists`,
        );
      }
    }
  }
}
