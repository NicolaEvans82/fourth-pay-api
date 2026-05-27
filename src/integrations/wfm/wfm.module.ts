import { Module, type Provider } from '@nestjs/common';
import { FOURTH_HCM_CONFIG } from '../fourth-hcm.config';
import { FourthWfmAdapter, WFM_ADAPTER } from './wfm.adapter';
import { MockWfmAdapter } from './wfm.mock';

const fourthHcmConfigProvider: Provider = {
  provide: FOURTH_HCM_CONFIG,
  useFactory: () => ({
    baseUrl: process.env.FOURTH_HCM_API_URL ?? '',
    orgToken: process.env.FOURTH_HCM_ORG_TOKEN ?? '',
    orgId: process.env.FOURTH_HCM_ORG_ID ?? '',
  }),
};

// NODE_ENV is read once at module-load. Tests can override via
// Test.createTestingModule(...).overrideProvider(WFM_ADAPTER).useValue(...).
const wfmAdapterProvider: Provider = {
  provide: WFM_ADAPTER,
  useClass:
    process.env.NODE_ENV === 'production' ? FourthWfmAdapter : MockWfmAdapter,
};

@Module({
  providers: [fourthHcmConfigProvider, wfmAdapterProvider],
  exports: [WFM_ADAPTER],
})
export class WfmModule {}
