import { Injectable, Logger } from '@nestjs/common';

export const EWA_DEDUCTION_QUEUE_WRITER = Symbol('EwaDeductionQueueWriter');

export interface QueuedDeduction {
  ewaTransferId: string;
  employeeAccountId: string;
  fourthEmployeeId: string;
  payPeriodStart: Date;
  amount: number;
}

export interface EwaDeductionQueueWriter {
  queue(input: QueuedDeduction): Promise<void>;
}

// CLAUDE.md week-1 task: STOP before writing payroll deduction queue logic —
// engineer review required before this becomes a real DB insert + (later)
// real call to the HCM Submit Payment Batch endpoint. This mock records
// queued items in memory so dev API calls exercise the TransferService call
// site; the production PgEwaDeductionQueueWriter lands after human review
// per the spec 1 human_gate "payroll_deduction_boundary".
@Injectable()
export class InMemoryEwaDeductionQueueWriter
  implements EwaDeductionQueueWriter
{
  private readonly logger = new Logger(InMemoryEwaDeductionQueueWriter.name);
  readonly queued: QueuedDeduction[] = [];

  async queue(input: QueuedDeduction): Promise<void> {
    this.queued.push(input);
    this.logger.warn(
      `Queued deduction for transfer ${input.ewaTransferId} (£${input.amount}) — in-memory only; production queue write awaits human review.`,
    );
  }
}
