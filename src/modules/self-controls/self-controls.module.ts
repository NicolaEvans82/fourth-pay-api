import { Module, type Provider } from '@nestjs/common';
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

// Dev/test bindings only — production needs DatabaseModule for PG-backed
// readers/writers + a shared AuditLogWriter across all modules.
const devProviders: Provider[] =
  process.env.NODE_ENV === 'production'
    ? []
    : [
        InMemorySelfControlsStore,
        {
          provide: SELF_CONTROLS_READER,
          useExisting: InMemorySelfControlsStore,
        },
        {
          provide: SELF_CONTROLS_WRITER,
          useExisting: InMemorySelfControlsStore,
        },
        {
          provide: EMPLOYEE_ACCOUNT_READER,
          useClass: MockEmployeeAccountReader,
        },
        { provide: AUDIT_LOG_WRITER, useClass: InMemoryAuditLogWriter },
      ];

@Module({
  imports: [HrModule],
  controllers: [SelfControlsController],
  providers: [SelfControlsService, ...devProviders],
  exports: [SelfControlsService, SELF_CONTROLS_READER, SELF_CONTROLS_WRITER],
})
export class SelfControlsModule {}
