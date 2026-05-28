import { Module } from '@nestjs/common';
import { InMemorySelfControlsStore } from '../../database/self-controls.store';
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
import { HrModule } from '../../integrations/hr/hr.module';
import { SelfControlsController } from './self-controls.controller';
import { SelfControlsService } from './self-controls.service';

// In-memory bindings used in every environment until DatabaseModule lands.
// When the PG-backed module ships, override these via module composition.
@Module({
  imports: [HrModule],
  controllers: [SelfControlsController],
  providers: [
    SelfControlsService,
    InMemorySelfControlsStore,
    { provide: SELF_CONTROLS_READER, useExisting: InMemorySelfControlsStore },
    { provide: SELF_CONTROLS_WRITER, useExisting: InMemorySelfControlsStore },
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
    { provide: AUDIT_LOG_WRITER, useClass: InMemoryAuditLogWriter },
  ],
  exports: [
    SelfControlsService,
    SELF_CONTROLS_READER,
    SELF_CONTROLS_WRITER,
    InMemorySelfControlsStore,
  ],
})
export class SelfControlsModule {}
