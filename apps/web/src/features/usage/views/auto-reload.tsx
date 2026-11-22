import { t } from '@app/lib/i18n';
import { fireAndForget } from '@core/util/fireAndForget';
import { createSignal } from 'solid-js';
import { AutoReloadDialog } from '../components/auto-reload-dialog';
import type { UsageContext } from '../context/usage-context';
import { createAutoReloadForm } from '../primitives/auto-reload-form';

export function AutoReloadView(props: {
  context: UsageContext;
  onClose: () => void;
  onRestoreFocus?: () => void;
}) {
  const form = createAutoReloadForm(props.context.autoReload.settings());
  const [error, setError] = createSignal<string>();
  const notice = () => {
    if (props.context.autoReload.preview())
      return t('settingsUsage.autoReloadPreviewOnly');
    if (props.context.summary()?.billingAccess === 'team-member')
      return t('settingsUsage.onlyPayerChangesReload');
    if (props.context.autoReload.suspended())
      return t('settingsUsage.lastReloadFailed');
  };
  const save = async (enabled: boolean) => {
    const settings = enabled
      ? form.settings()
      : props.context.autoReload.settings();
    if (
      !settings ||
      !props.context.autoReload.available() ||
      props.context.autoReload.pending() ||
      (enabled && form.error())
    )
      return;
    setError(undefined);
    try {
      await props.context.autoReload.save({ ...settings, enabled });
      props.onClose();
    } catch {
      setError(t('settingsUsage.saveAutoReloadFailed'));
    }
  };
  const paymentMethods = async () => {
    if (
      props.context.summary()?.billingAccess !== 'payer' ||
      props.context.autoReload.preview() ||
      props.context.developer?.active() ||
      props.context.paymentMethods.pending()
    )
      return;
    setError(undefined);
    try {
      const url = await props.context.paymentMethods.open();
      props.context.navigateToPayment(url);
    } catch {
      setError(t('settingsUsage.openPaymentMethodsFailed'));
    }
  };
  return (
    <AutoReloadDialog
      sharedWithTeam={props.context.summary()?.creditScope === 'team'}
      enabled={props.context.autoReload.settings().enabled}
      minimum={form.minimum()}
      target={form.target()}
      maximum={form.maximum()}
      onMinimum={form.setMinimum}
      onTarget={form.setTarget}
      onMaximum={form.setMaximum}
      onClose={props.onClose}
      onRestoreFocus={props.onRestoreFocus}
      onSave={() => fireAndForget(save(true), 'usage')}
      onTurnOff={() => fireAndForget(save(false), 'usage')}
      onPaymentMethods={() => fireAndForget(paymentMethods(), 'usage')}
      canManagePaymentMethods={
        props.context.summary()?.billingAccess === 'payer' &&
        !props.context.autoReload.preview() &&
        !props.context.developer?.active()
      }
      pending={props.context.autoReload.pending()}
      paymentMethodsPending={props.context.paymentMethods.pending()}
      disabled={!props.context.autoReload.available()}
      invalid={!!form.error()}
      notice={notice()}
      error={form.error() ?? error()}
    />
  );
}
