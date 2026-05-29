import { Module, type Provider } from '@nestjs/common';
import { FourthHcmModule } from '../fourth-hcm.module';
import { EMPLOYER_CONFIG_WRITER, HR_ADAPTER } from './hr.adapter';
import { MockEmployerConfigWriter, MockHrAdapter } from './hr.mock';

// Mock adapter everywhere until DatabaseModule binds PG_POOL and the
// PgEmployerConfigReader can be wired in.
const hrAdapterProvider: Provider = {
  provide: HR_ADAPTER,
  useClass: MockHrAdapter,
};

const employerConfigWriterProvider: Provider = {
  provide: EMPLOYER_CONFIG_WRITER,
  useClass: MockEmployerConfigWriter,
};

@Module({
  imports: [FourthHcmModule],
  providers: [hrAdapterProvider, employerConfigWriterProvider],
  exports: [HR_ADAPTER, EMPLOYER_CONFIG_WRITER],
})
export class HrModule {}
