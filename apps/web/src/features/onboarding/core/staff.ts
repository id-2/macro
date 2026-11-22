import { emailDomain } from './team';

const ROX_STAFF_DOMAIN = 'rox.one';

/** Whether the address belongs to a Rox staff account (`@rox.one`). */
export function isMacroStaffEmail(address: string | undefined): boolean {
  return emailDomain(address) === ROX_STAFF_DOMAIN;
}

/** Whether this account gets the staff Bypass button on the onboarding flow. */
export function canBypassOnboarding(address: string | undefined): boolean {
  return isMacroStaffEmail(address?.trim());
}
