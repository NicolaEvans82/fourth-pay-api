import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../pg';
import type {
  EwaDeductionQueueWriter,
  QueuedDeduction,
} from './ewa-deduction-queue.writer';

// Production writer for the payroll_deduction_queue table. Per CLAUDE.md
// rule 2, every EWA advance MUST be queued here — never written directly
// to Fourth Payroll. A separate worker process drains the queue, calls
// the HCM Submit Payment Batch endpoint, and flips status to
// 'submitted' / 'confirmed' / 'failed'.
@Injectable()
export class PgEwaDeductionQueueWriter implements EwaDeductionQueueWriter {
  private readonly logger = new Logger(PgEwaDeductionQueueWriter.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async queue(input: QueuedDeduction): Promise<void> {
    await this.pool.query(
      `INSERT INTO payroll_deduction_queue (
         ewa_transfer_id, employee_account_id, fourth_employee_id,
         pay_period_start, amount, status, queued_at
       ) VALUES ($1, $2, $3, $4, $5, 'queued', NOW())`,
      [
        input.ewaTransferId,
        input.employeeAccountId,
        input.fourthEmployeeId,
        input.payPeriodStart.toISOString().slice(0, 10),
        input.amount,
      ],
    );
    this.logger.log(
      `Queued deduction for transfer ${input.ewaTransferId} (£${input.amount})`,
    );
  }
}
