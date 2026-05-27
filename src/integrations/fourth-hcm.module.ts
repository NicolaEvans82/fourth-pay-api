import { Module, type Provider } from '@nestjs/common';
import { FOURTH_HCM_CONFIG } from './fourth-hcm.config';

const fourthHcmConfigProvider: Provider = {
  provide: FOURTH_HCM_CONFIG,
  useFactory: () => ({
    baseUrl: process.env.FOURTH_HCM_API_URL ?? '',
    orgToken: process.env.FOURTH_HCM_ORG_TOKEN ?? '',
    orgId: process.env.FOURTH_HCM_ORG_ID ?? '',
  }),
};

@Module({
  providers: [fourthHcmConfigProvider],
  exports: [FOURTH_HCM_CONFIG],
})
export class FourthHcmModule {}
