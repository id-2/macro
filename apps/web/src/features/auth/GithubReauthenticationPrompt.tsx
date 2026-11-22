import { t } from '@app/lib/i18n';
import { authorizeGithub } from '@core/auth/authorize-github';
import { toast } from '@core/component/Toast/Toast';
import { useKeyedPersistentToasts } from '@core/component/Toast/useKeyedPersistentToasts';
import { isNativeMobilePlatform } from '@core/mobile/isNativeMobilePlatform';
import { fireAndForget } from '@core/util/fireAndForget';
import ArrowCounterClockwise from '@icon/system/regular/arrow-counter-clockwise.svg?component-solid';
import PlugIcon from '@icon/system/regular/plug.svg';
import { useReauthenticateGithubMutation } from '@queries/auth';
import { useGithubLinkAvailable } from '@queries/auth/outlook-link';
import { authServiceClient } from '@service-auth/client';
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';

async function checkGithubReauthenticationStatus(): Promise<boolean> {
  const response = await authServiceClient.checkGithubLinkStatus();
  return response.isOk()
    ? response.value.reauthentication_required
    : response.error.some(
        (error) => error.code === 'REAUTHENTICATION_REQUIRED'
      );
}

/**
 * Surfaces a "Reconnect GitHub" prompt when the GitHub grant has expired,
 * probed on mount and browser history restoration. Shares the capped prompt
 * region with the other auth prompts, so it takes its turn instead of stacking.
 */
export function GithubReauthenticationPrompt() {
  const [needsReauth, setNeedsReauth] = createSignal(false);
  const [reconnecting, setReconnecting] = createSignal(false);
  const reauthenticateGithub = useReauthenticateGithubMutation();
  // A deployment with no `github` identity provider (a local stack started
  // without a real GitHub OAuth app) cannot link or relink, and its status read
  // only answers "not linked": there is nothing to prompt about there.
  const githubAvailable = useGithubLinkAvailable();

  async function reconnect() {
    if (reconnecting()) return;
    setReconnecting(true);
    try {
      const connected = await authorizeGithub(
        (callbackUrl) => reauthenticateGithub.mutateAsync(callbackUrl),
        'Failed to reconnect GitHub'
      );
      if (connected) setNeedsReauth(false);
      // Browser OAuth is navigating away. Native OAuth settles in this view.
      if (!isNativeMobilePlatform()) return;
    } catch {
      toast.failure('Failed to start GitHub reconnect flow');
    }
    setReconnecting(false);
  }

  // Probe once the deployment says it can link GitHub: a stack that cannot
  // link never asks. Once per mount, as before.
  let probed = false;
  createEffect(() => {
    if (probed || !githubAvailable()) return;
    probed = true;
    fireAndForget(
      checkGithubReauthenticationStatus().then(setNeedsReauth),
      'github-reauth'
    );
  });

  onMount(() => {
    if (isNativeMobilePlatform()) return;

    async function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted || !githubAvailable()) return;
      try {
        setNeedsReauth(await checkGithubReauthenticationStatus());
      } catch {
        // Preserve the previous status if the restored page cannot reach auth.
      } finally {
        setReconnecting(false);
      }
    }

    window.addEventListener('pageshow', onPageShow);
    onCleanup(() => window.removeEventListener('pageshow', onPageShow));
  });

  useKeyedPersistentToasts({
    // One GitHub grant per user, so the set is empty or this one fixed key.
    items: () => (needsReauth() && !reconnecting() ? ['github'] : []),
    key: (item) => item,
    toast: () => ({
      title: 'Reconnect GitHub',
      icon: PlugIcon,
      color: 'var(--color-failure)',
      titleColor: 'var(--color-failure)',
      dismissLabel: t('common.maybeLater'),
      content(): string {
        return 'Your GitHub authorization has expired. Reconnect GitHub to restore pull request details.';
      },
      actions: [
        {
          label: 'Reconnect',
          icon: ArrowCounterClockwise,
          onClick: () => {
            fireAndForget(reconnect(), 'github-reauth');
          },
        },
      ],
    }),
  });

  return null;
}
