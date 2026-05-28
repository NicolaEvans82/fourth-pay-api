import { Module, type Provider } from '@nestjs/common';
import { FourthHcmModule } from '../fourth-hcm.module';
import { WFM_ADAPTER } from './wfm.adapter';
import { MockWfmAdapter } from './wfm.mock';

// Mock adapter everywhere until Fourth HCM credentials are wired through.
// Tests can override via overrideProvider(WFM_ADAPTER).useValue(...).
const wfmAdapterProvider: Provider = {
  provide: WFM_ADAPTER,
  useClass: MockWfmAdapter,
};

@Module({
  imports: [FourthHcmModule],
  providers: [wfmAdapterProvider],
  exports: [WFM_ADAPTER],
})
export class WfmModule {}
