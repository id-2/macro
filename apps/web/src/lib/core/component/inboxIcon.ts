import type { UserIconProps } from '@core/component/UserIcon';
import { emailToRoxId } from '@core/user';

// Resolve an inbox's identity from its own address, not the link's rox_id:
// an own secondary inbox shares the parent account's rox_id, so keying on the
// address gives each inbox its own name and icon.
export function inboxIconProps(emailAddress: string): UserIconProps {
  const roxId = emailToRoxId(emailAddress);
  return roxId ? { id: roxId } : { email: emailAddress };
}
