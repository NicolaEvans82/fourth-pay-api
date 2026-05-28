// Connection details for the Fourth HCM UK PeopleSystem Integration API.
// `baseUrl` is the internal Fourth network root (e.g. http://10.12.6.10:85).
// `orgId` is the OrganisationID / GroupID — used both as a URL segment and
// as the value of the X-Fourth-Org auth header. No separate org token —
// Ali Barlow confirmed the auth model is single-header on 2026-05-28.
export interface FourthHcmConfig {
  baseUrl: string;
  orgId: string;
}

export const FOURTH_HCM_CONFIG = Symbol('FourthHcmConfig');
