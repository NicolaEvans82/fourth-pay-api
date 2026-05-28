import { Module, type Provider } from '@nestjs/common';
import { FOURTH_HCM_CONFIG } from './fourth-hcm.config';

// Reads the two env vars Ali Barlow confirmed on 2026-05-28:
//   FOURTH_INTERNAL_API_URL — base URL of the PeopleSystem Integration API
//                              (e.g. http://10.12.6.10:85, internal only)
//   FOURTH_ORG_ID           — the OrganisationID / GroupID, used both as a
//                              URL segment and as the X-Fourth-Org header value
// The legacy FOURTH_HCM_* names are no longer read.
const fourthHcmConfigProvider: Provider = {
  provide: FOURTH_HCM_CONFIG,
  useFactory: () => ({
    baseUrl: process.env.FOURTH_INTERNAL_API_URL ?? '',
    orgId: process.env.FOURTH_ORG_ID ?? '',
  }),
};

@Module({
  providers: [fourthHcmConfigProvider],
  exports: [FOURTH_HCM_CONFIG],
})
export class FourthHcmModule {}
