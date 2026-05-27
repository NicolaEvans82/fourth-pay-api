import { Module, type Provider } from '@nestjs/common';
import { PgEmployerConfigReader } from '../../database/readers/pg-employer-config.reader';
import { FourthHcmModule } from '../fourth-hcm.module';
import {
  EMPLOYER_CONFIG_READER,
  FourthHrAdapter,
  HR_ADAPTER,
} from './hr.adapter';
import { MockHrAdapter } from './hr.mock';

const hrAdapterProvider: Provider = {
  provide: HR_ADAPTER,
  useClass:
    process.env.NODE_ENV === 'production' ? FourthHrAdapter : MockHrAdapter,
};

// The Pg-backed reader is only registered in prod. Dev/test go through
// MockHrAdapter which has no reader dependency, so PG_POOL's absence does
// not block boot. Prod still needs a future DatabaseModule to bind PG_POOL.
const productionProviders: Provider[] =
  process.env.NODE_ENV === 'production'
    ? [{ provide: EMPLOYER_CONFIG_READER, useClass: PgEmployerConfigReader }]
    : [];

@Module({
  imports: [FourthHcmModule],
  providers: [hrAdapterProvider, ...productionProviders],
  exports: [HR_ADAPTER],
})
export class HrModule {}
