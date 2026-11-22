import EmptyStateNoFilterMatchGraphic from '@design/empty-state-no-filter-match.svg';
import EmptyStateNoSearchMatchGraphic from '@design/empty-state-no-search-match.svg';
import GitPullRequestIcon from '@icon/system/regular/git-pull-request.svg';
import { type TranslationKey, t } from '@app/lib/i18n';
import type { GithubLinkStatus } from '@queries/auth/github-link';
import { EmptyStatePanel } from '@ui';
import { Match, Switch } from 'solid-js';
import { match } from 'ts-pattern';
import {
  type ReviewsScope,
  scopeMatchesViewerGithubId,
} from '../reviews-types';

const IDENTITY_SUBJECTS: Record<ReviewsScope, TranslationKey> = {
  all: 'reviews.identityAll',
  authored: 'reviews.identityAuthored',
  assigned: 'reviews.identityAssigned',
  involving: 'reviews.identityInvolving',
  review_requests: 'reviews.identityReviewRequests',
};

export function ReviewsEmptyState(props: {
  scope: ReviewsScope;
  search: string;
  hasFilters: boolean;
  hasAuthorIdentity: boolean;
  githubAccountStatus?: GithubLinkStatus | 'error';
  onClearSearch: () => void;
  onClearFilters: () => void;
}) {
  const identityCopy = () => {
    const subject = t(IDENTITY_SUBJECTS[props.scope]);
    return match(props.githubAccountStatus)
      .with('linked', () => ({
        title: t('reviews.identityUnavailableTitle'),
        description: t('reviews.identityUnavailableBody', { subject }),
      }))
      .with('reauthentication_required', () => ({
        title: t('reviews.identityReconnectTitle'),
        description: t('reviews.identityReconnectBody', { subject }),
      }))
      .with('error', () => ({
        title: t('reviews.identityErrorTitle'),
        description: t('reviews.identityErrorBody', { subject }),
      }))
      .otherwise(() => ({
        title: t('reviews.identityConnectTitle'),
        description: t('reviews.identityConnectBody', { subject }),
      }));
  };

  return (
    <Switch>
      <Match
        when={
          scopeMatchesViewerGithubId(props.scope) && !props.hasAuthorIdentity
        }
      >
        <EmptyStatePanel
          centered
          graphic={GitPullRequestIcon}
          title={identityCopy().title}
          description={identityCopy().description}
        />
      </Match>
      <Match
        when={
          props.scope === 'involving' &&
          props.githubAccountStatus &&
          props.githubAccountStatus !== 'linked'
        }
      >
        <EmptyStatePanel
          centered
          graphic={GitPullRequestIcon}
          title={identityCopy().title}
          description={identityCopy().description}
        />
      </Match>
      <Match when={props.search.trim()}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateNoSearchMatchGraphic}
          title={t('reviews.noSearchResults', { search: props.search.trim() })}
          description={t('reviews.noSearchResultsBody')}
          primaryAction={{
            label: t('reviews.clearSearch'),
            onClick: props.onClearSearch,
          }}
        />
      </Match>
      <Match when={props.hasFilters}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateNoFilterMatchGraphic}
          title={t('reviews.noFilterMatch')}
          description={t('reviews.noFilterMatchBody')}
          primaryAction={{
            label: t('reviews.clearFilters'),
            onClick: props.onClearFilters,
          }}
        />
      </Match>
      <Match when={props.scope === 'involving'}>
        <EmptyStatePanel
          centered
          graphic={GitPullRequestIcon}
          title={t('reviews.noInvolving')}
          description={t('reviews.noInvolvingBody')}
        />
      </Match>
      <Match when={props.scope === 'authored'}>
        <EmptyStatePanel
          centered
          graphic={GitPullRequestIcon}
          title={t('reviews.noAuthored')}
          description={t('reviews.noAuthoredBody')}
        />
      </Match>
      <Match when={props.scope === 'assigned'}>
        <EmptyStatePanel
          centered
          graphic={GitPullRequestIcon}
          title={t('reviews.noAssigned')}
          description={t('reviews.noAssignedBody')}
        />
      </Match>
      <Match when={props.scope === 'review_requests'}>
        <EmptyStatePanel
          centered
          graphic={GitPullRequestIcon}
          title={t('reviews.noReviewRequests')}
          description={t('reviews.noReviewRequestsBody')}
        />
      </Match>
      <Match when={true}>
        <EmptyStatePanel
          centered
          graphic={GitPullRequestIcon}
          title={t('reviews.noPullRequestsYet')}
          description={t('reviews.noPullRequestsYetBody')}
        />
      </Match>
    </Switch>
  );
}
