import { t } from '@app/lib/i18n';
import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import { ThrownResultError, thrownResultErrorHasCode } from '@core/util/result';
import { createSignal } from 'solid-js';
import { CreditPurchaseDialog } from '../components/credit-purchase-dialog';
import type { UsageContext } from '../context/usage-context';
import { formatCreditBalance, parseDollarInput } from '../core/usage';

/** The server's reason for a refused purchase, as a sentence. */
function purchaseRejection(error: unknown) {
  const message =
    error instanceof ThrownResultError &&
    error.errors.find((e) => e.code === 'CREDIT_PURCHASE_REJECTED')?.message;
  return message
    ? `${message.charAt(0).toUpperCase()}${message.slice(1)}.`
    : t('settingsUsage.buyFailed');
}

export function CreditPurchaseView(props: {
  context: UsageContext;
  onClose: () => void;
  onRestoreFocus?: () => void;
}) {
  const [selection, setSelection] = createSignal<number | 'other'>(2_500);
  const [customAmount, setCustomAmount] = createSignal('');
  const [error, setError] = createSignal<string>();
  const [subscriptionRequired, setSubscriptionRequired] = createSignal(false);
  const amountCents = () => {
    const selected = selection();
    return typeof selected === 'number'
      ? selected
      : parseDollarInput(customAmount());
  };
  const previewing = () =>
    props.context.developer?.active() || props.context.autoReload.preview();
  const teamCard = () =>
    props.context.summary()?.billingAccess === 'team-member';
  const notice = () => {
    if (previewing())
      return t('settingsUsage.purchaseDisabledPreview');
    const summary = props.context.summary();
    if (summary?.unlimited)
      return t('settingsUsage.unlimitedNoCredits');
    if (summary?.billingAccess === 'free')
      return t('settingsUsage.subscribeToBuy');
    const amount = amountCents();
    if (amount === undefined)
      return t('settingsUsage.enterAmountError');
    if (!props.context.creditPurchase.supportedAmounts().includes(amount))
      return t('settingsUsage.customAmountsUnavailable');
    const limit = summary?.purchaseLimit;
    if (limit && amount > limit.remainingCents)
      return `${t('settingsUsage.creditLimitLeft', {
        remaining: formatCreditBalance(limit.remainingCents),
        limit: formatCreditBalance(limit.limitCents),
      })} ${teamCard() ? t('settingsUsage.askOwnerToRaise') : t('settingsUsage.raiseInAutoReload')}`;
  };
  /** The card on file can't be charged off-session (none on file, or it
   * needs 3-D Secure): the payer pays this pack through Stripe Checkout. */
  const checkout = async (
    amount: number,
    reason: 'payment_method_required' | 'authentication_required'
  ) => {
    if (teamCard()) {
      setError(
        reason === 'payment_method_required'
          ? t('settingsUsage.teamNoCard')
          : t('settingsUsage.teamCardNeedsVerification')
      );
      return;
    }
    try {
      props.context.navigateToPayment(
        await props.context.creditPurchase.checkout(amount)
      );
    } catch {
      setError(t('settingsUsage.checkoutFailed'));
    }
  };
  const buy = async () => {
    const amount = amountCents();
    if (
      notice() ||
      amount === undefined ||
      props.context.creditPurchase.pending()
    )
      return;
    setError(undefined);
    try {
      const { status, amountCents: charged } =
        await props.context.creditPurchase.buy(amount);
      if (
        status === 'payment_method_required' ||
        status === 'authentication_required'
      ) {
        await checkout(amount, status);
        return;
      }
      if (status === 'declined') {
        setError(
          teamCard()
            ? t('settingsUsage.teamCardDeclined')
            : t('settingsUsage.ownCardDeclined')
        );
        return;
      }
      props.onClose();
      toast.success(
        t('settingsUsage.creditsAdded', {
          amount: formatCreditBalance(charged),
        })
      );
    } catch (error) {
      const needsPlan = thrownResultErrorHasCode(error, 'PAID_PLAN_REQUIRED');
      setSubscriptionRequired(needsPlan);
      setError(
        needsPlan
          ? t('settingsUsage.subscribeToBuy')
          : purchaseRejection(error)
      );
    }
  };
  return (
    <CreditPurchaseDialog
      sharedWithTeam={props.context.summary()?.creditScope === 'team'}
      teamCard={teamCard()}
      selection={selection()}
      customAmount={customAmount()}
      amountCents={amountCents()}
      onSelect={(value) => {
        setSelection(value);
        setError(undefined);
      }}
      onCustomAmount={setCustomAmount}
      onClose={props.onClose}
      onRestoreFocus={props.onRestoreFocus}
      onBuy={() => fireAndForget(buy(), 'usage')}
      onViewPlans={
        (props.context.summary()?.billingAccess === 'free' && !previewing()) ||
        subscriptionRequired()
          ? () => {
              props.onClose();
              props.context.openPlans();
            }
          : undefined
      }
      pending={props.context.creditPurchase.pending()}
      disabled={!!notice()}
      notice={notice()}
      error={error()}
    />
  );
}
