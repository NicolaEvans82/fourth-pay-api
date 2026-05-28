import { Module, type Provider } from '@nestjs/common';
import {
  EWA_TRANSFER_READER,
  EWA_TRANSFER_WRITER,
  InMemoryEwaTransferStore,
} from '../../database/ewa-transfer.store';
import { PgEwaTransferStore } from '../../database/pg-ewa-transfer.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  AUDIT_LOG_WRITER,
  InMemoryAuditLogWriter,
} from '../../database/writers/audit-log.writer';
import { PgAuditLogWriter } from '../../database/writers/pg-audit-log.writer';
import {
  EWA_DEDUCTION_QUEUE_WRITER,
  InMemoryEwaDeductionQueueWriter,
} from '../../database/writers/ewa-deduction-queue.writer';
import { PgEwaDeductionQueueWriter } from '../../database/writers/pg-ewa-deduction-queue.writer';
import { usePg } from '../../database/use-pg';
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

// Pg vs in-memory swap — same EWA_TRANSFER_READER / _WRITER tokens
// either way, so the BalanceService / TransferService / EarningsService
// code paths are completely unchanged.
const pgStoreProviders: Provider[] = [
  PgEwaTransferStore,
  { provide: EWA_TRANSFER_READER, useExisting: PgEwaTransferStore },
  { provide: EWA_TRANSFER_WRITER, useExisting: PgEwaTransferStore },
  { provide: AUDIT_LOG_WRITER, useClass: PgAuditLogWriter },
  { provide: EWA_DEDUCTION_QUEUE_WRITER, useClass: PgEwaDeductionQueueWriter },
];

const inMemoryStoreProviders: Provider[] = [
  InMemoryEwaTransferStore,
  { provide: EWA_TRANSFER_READER, useExisting: InMemoryEwaTransferStore },
  { provide: EWA_TRANSFER_WRITER, useExisting: InMemoryEwaTransferStore },
  { provide: AUDIT_LOG_WRITER, useClass: InMemoryAuditLogWriter },
  { provide: EWA_DEDUCTION_QUEUE_WRITER, useClass: InMemoryEwaDeductionQueueWriter },
];

const storeProviders = usePg() ? pgStoreProviders : inMemoryStoreProviders;

@Module({
  imports: [WfmModule, HrModule, PayrollModule, SelfControlsModule],
  controllers: [EwaController, EarningsController],
  providers: [
    BalanceService,
    TransferService,
    EarningsService,
    ...storeProviders,
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
    { provide: AUTO_SAVE_SINK, useClass: InMemoryAutoSaveSink },
  ],
  // InMemoryEwaTransferStore is only exported when it actually exists —
  // DemoModule consumes it for the reset endpoint, which is itself
  // disabled in Pg mode (see app.module.ts).
  exports: [
    BalanceService,
    EarningsService,
    EWA_TRANSFER_READER,
    ...(usePg() ? [] : [InMemoryEwaTransferStore]),
  ],
})
export class EwaModule {}
