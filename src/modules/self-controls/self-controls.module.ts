import { Module, type Provider } from '@nestjs/common';
import { InMemorySelfControlsStore } from '../../database/self-controls.store';
import { PgSelfControlsStore } from '../../database/pg-self-controls.store';
import { SELF_CONTROLS_READER } from '../../database/readers/self-controls.reader';
import { SELF_CONTROLS_WRITER } from '../../database/writers/self-controls.writer';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  AUDIT_LOG_WRITER,
  InMemoryAuditLogWriter,
} from '../../database/writers/audit-log.writer';
import { PgAuditLogWriter } from '../../database/writers/pg-audit-log.writer';
import { usePg } from '../../database/use-pg';
import { HrModule } from '../../integrations/hr/hr.module';
import { SelfControlsController } from './self-controls.controller';
import { SelfControlsService } from './self-controls.service';

const pgProviders: Provider[] = [
  PgSelfControlsStore,
  { provide: SELF_CONTROLS_READER, useExisting: PgSelfControlsStore },
  { provide: SELF_CONTROLS_WRITER, useExisting: PgSelfControlsStore },
  { provide: AUDIT_LOG_WRITER, useClass: PgAuditLogWriter },
];

const inMemoryProviders: Provider[] = [
  InMemorySelfControlsStore,
  { provide: SELF_CONTROLS_READER, useExisting: InMemorySelfControlsStore },
  { provide: SELF_CONTROLS_WRITER, useExisting: InMemorySelfControlsStore },
  { provide: AUDIT_LOG_WRITER, useClass: InMemoryAuditLogWriter },
];

const storeProviders = usePg() ? pgProviders : inMemoryProviders;

@Module({
  imports: [HrModule],
  controllers: [SelfControlsController],
  providers: [
    SelfControlsService,
    ...storeProviders,
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
  ],
  exports: [
    SelfControlsService,
    SELF_CONTROLS_READER,
    SELF_CONTROLS_WRITER,
    ...(usePg() ? [] : [InMemorySelfControlsStore]),
  ],
})
export class SelfControlsModule {}
