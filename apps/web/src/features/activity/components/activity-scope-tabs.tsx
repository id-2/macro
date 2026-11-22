import { t } from '@app/lib/i18n';
import { PillTabs } from '@components/app/mobile/PillTabs';
import { Tabs } from '@ui';
import type { ActivityScope } from '../core/event';

function scopeTabs(): { value: ActivityScope; label: string }[] {
  return [
    { value: 'mine', label: t('activity.scopeMine') },
    { value: 'team', label: t('activity.scopeTeam') },
  ];
}

/** The You / Team switch, as view tabs after the split header title. */
export function ActivityScopeTabs(props: {
  value: ActivityScope;
  onChange: (scope: ActivityScope) => void;
}) {
  return (
    <Tabs
      aria-label={t('activity.scopeLabel')}
      options={scopeTabs()}
      value={props.value}
      onChange={props.onChange}
    />
  );
}

/** The same switch as the touch pill strip, under the floating header. */
export function ActivityScopePills(props: {
  value: ActivityScope;
  onChange: (scope: ActivityScope) => void;
}) {
  return (
    <PillTabs
      items={scopeTabs()}
      value={props.value}
      onChange={props.onChange}
    />
  );
}
