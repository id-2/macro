import { useEmailLinksContext } from '@core/context/emailLinks';

/**
 * Predicate: is this rox id a connected secondary inbox (an extra mailbox the
 * current user attached to their own account, `!is_primary`) rather than a real
 * user. Not to be confused with a delegated/shared inbox, which is a separate
 * loggable user (its own rox id) and reports `is_primary = true`.
 */
export function useIsConnectedSecondaryInbox() {
  return useEmailLinksContext().isConnectedSecondaryInbox;
}
