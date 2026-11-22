import { t } from '@app/lib/i18n';
import { useSplitPanelOrThrow } from '@components/app/split-layout/layoutUtils';
import { withAuth } from '@components/app/split-layout/split-router/app-route-shell';
import { onMount } from 'solid-js';
import { AccountPortal } from './account-portal';
import { SettingsPanelComponentWrapper } from './Settings';

export function SettingsRouteView() {
  const panel = useSplitPanelOrThrow();
  onMount(() => panel.handle.setDisplayName(t('nav.settings')));
  return <SettingsPanelComponentWrapper />;
}

function AccountPortalView() {
  const panel = useSplitPanelOrThrow();
  onMount(() => panel.handle.setDisplayName('Аккаунт'));
  return <AccountPortal />;
}

/** `/account`: the account portal, one page for the whole account. */
export const AccountPortalRouteView = withAuth(AccountPortalView);
