import { Module } from '@nestjs/common';
import {
  EWA_TRANSFER_READER,
  EWA_TRANSFER_WRITER,
  InMemoryEwaTransferStore,
} from '../../database/ewa-transfer.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  AUDIT_LOG_WRITER,
  InMemoryAuditLogWriter,
} from '../../database/writers/audit-log.writer';
import {
  EWA_DEDUCTION_QUEUE_WRITER,
  InMemoryEwaDeductionQueueWriter,
} from '../../database/writers/ewa-deduction-queue.writer';
import { HrModule } from '../../integrations/hr/hr.module';
import { PayrollModule } from '../../integrations/payroll/payroll.module';
import { WfmModule } from '../../integrations/wfm/wfm.module';
import {
  AUTO_SAVE_SINK,
  InMemoryAutoSaveSink,
} from '../savings/auto-save.sink';
import { SelfControlsModule } from '../self-controls/self-controls.module';
import { BalanceService } from './balance.service';
import { EarningsController } from './earnings.controller';
import { EarningsService } from './earnings.service';
import { EwaController } from './ewa.controller';
import { TransferService } from './transfer.service';

// In-memory bindings used in every environment until DatabaseModule lands.
@Module({
  imports: [WfmModule, HrModule, PayrollModule, SelfControlsModule],
  controllers: [EwaController, EarningsController],
  providers: [
    BalanceService,
    TransferService,
    EarningsService,
    InMemoryEwaTransferStore,
    { provide: EWA_TRANSFER_READER, useExisting: InMemoryEwaTransferStore },
    { provide: EWA_TRANSFER_WRITER, useExisting: InMemoryEwaTransferStore },
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
    { provide: AUDIT_LOG_WRITER, useClass: InMemoryAuditLogWriter },
    {
      provide: EWA_DEDUCTION_QUEUE_WRITER,
      useClass: InMemoryEwaDeductionQueueWriter,
    },
    { provide: AUTO_SAVE_SINK, useClass: InMemoryAutoSaveSink },
  ],
  exports: [BalanceService, EarningsService],
})
export class EwaModule {}
