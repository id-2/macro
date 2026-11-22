import { PULL_REQUEST_REPOSITORIES_PROMOTION as COPY } from '@app/features/sidebar-promotion/core/promotions';
import { createLastKnown } from '@app/features/sidebar-promotion/primitives/last-known';
import { t } from '@app/lib/i18n';
import {
  allOf,
  SidebarPromotion,
} from '@app/features/sidebar-promotion/sidebar-promotion';
import { authorizeGithub } from '@core/auth/authorize-github';
import { toast } from '@core/component/Toast/Toast';
import { SERVER_HOSTS } from '@core/constant/servers';
import { useUserId } from '@core/context/user';
import { fireAndForget } from '@core/util/fireAndForget';
import { ThrownResultError } from '@core/util/result';
import {
  useGithubLinkStatusQuery,
  useInitGithubLinkMutation,
  useReauthenticateGithubMutation,
} from '@queries/auth';
import { untrack } from 'solid-js';
import { match } from 'ts-pattern';
import { z } from 'zod';

/** The GitHub App install page, where orgs and repositories are chosen. */
const GITHUB_APP_INSTALL_URL = `${SERVER_HOSTS['document-storage-service']}/github/install-sync`;

/**
 * The service's own words when it can name the missing setting, else `fallback`.
 */
function connectFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof ThrownResultError) {
    const message = error.message.trim();
    // Only its own Russian explanation is worth showing; transport and status
    // errors keep the localized fallback.
    if (/[А-Яа-яЁё]/.test(message)) return message;
  }
  return fallback;
}

/** The Pull requests sidebar's prompt to sync more GitHub orgs and
 * repositories. The app install callback needs a linked account, so until
 * one exists the card links the account first, like Settings → GitHub.
 */
export function RepositoriesPromotion(props: { class?: string }) {
  const githubLink = useGithubLinkStatusQuery();
  const initGithubLink = useInitGithubLinkMutation();
  const reauthenticateGithub = useReauthenticateGithubMutation();
  const userId = useUserId();
  // Gate the status read so a pending query never suspends the sidebar; until
  // it loads, the card keeps the status this browser last saw.
  const status = createLastKnown(
    'pull-request-repositories:github',
    untrack(userId),
    () => (githubLink.isPending ? undefined : githubLink.data?.status),
    z.enum(['linked', 'reauthentication_required', 'unlinked'])
  );

  // Settings → GitHub runs the same two grants; an expired link must be
  // reauthenticated rather than linked again.
  const authorize = async (reconnect: boolean) => {
    try {
      await authorizeGithub(
        (callbackUrl) =>
          reconnect
            ? reauthenticateGithub.mutateAsync(callbackUrl)
            : initGithubLink.mutateAsync(callbackUrl),
        reconnect ? t('reviews.reconnectFailed') : t('reviews.connectFailed')
      );
    } catch (error) {
      toast.failure(
        connectFailureMessage(
          error,
          reconnect
            ? t('reviews.reconnectFlowFailed')
            : t('reviews.connectFlowFailed')
        )
      );
    }
  };

  const action = () =>
    match(status())
      .with('linked', () => ({
        label: t('reviews.promotionAction'),
        onClick: () =>
          window.open(GITHUB_APP_INSTALL_URL, '_blank', 'noopener'),
      }))
      .with('reauthentication_required', () => ({
        label: t('reviews.promotionReconnect'),
        onClick: () =>
          fireAndForget(authorize(true), 'sidebar-promotion.github'),
      }))
      .otherwise(() => ({
        label: t('reviews.promotionConnect'),
        onClick: () =>
          fireAndForget(authorize(false), 'sidebar-promotion.github'),
      }));

  return (
    <SidebarPromotion
      id={COPY.id}
      applies={allOf(status() === undefined ? undefined : true)}
      logos={COPY.logos}
      headline={t('reviews.promotionHeadline')}
      pitch={t('reviews.promotionPitch')}
      class={props.class}
      dismissLabel={t('reviews.dismissPromotion', {
        headline: t('reviews.promotionHeadline'),
      })}
      action={action()}
    />
  );
}
