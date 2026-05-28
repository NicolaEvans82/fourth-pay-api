import { Module, type Provider } from '@nestjs/common';
import { FourthHcmModule } from '../fourth-hcm.module';
import { HR_ADAPTER } from './hr.adapter';
import { MockHrAdapter } from './hr.mock';

// Mock adapter everywhere until DatabaseModule binds PG_POOL and the
// PgEmployerConfigReader can be wired in.
const hrAdapterProvider: Provider = {
  provide: HR_ADAPTER,
  useClass: MockHrAdapter,
};

@Module({
  imports: [FourthHcmModule],
  providers: [hrAdapterProvider],
  exports: [HR_ADAPTER],
})
export class HrModule {}
