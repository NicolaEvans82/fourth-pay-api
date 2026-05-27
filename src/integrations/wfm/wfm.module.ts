import { Module, type Provider } from '@nestjs/common';
import { FourthHcmModule } from '../fourth-hcm.module';
import { FourthWfmAdapter, WFM_ADAPTER } from './wfm.adapter';
import { MockWfmAdapter } from './wfm.mock';

// NODE_ENV is read once at module-load. Tests can override via
// Test.createTestingModule(...).overrideProvider(WFM_ADAPTER).useValue(...).
const wfmAdapterProvider: Provider = {
  provide: WFM_ADAPTER,
  useClass:
    process.env.NODE_ENV === 'production' ? FourthWfmAdapter : MockWfmAdapter,
};

@Module({
  imports: [FourthHcmModule],
  providers: [wfmAdapterProvider],
  exports: [WFM_ADAPTER],
})
export class WfmModule {}
