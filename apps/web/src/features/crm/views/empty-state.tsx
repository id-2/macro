import { t } from '@app/lib/i18n';
import EmptyStateCompaniesGraphic from '@design/empty-state-companies.svg';
import { EmptyStatePanel } from '@ui';
import { Match, Switch } from 'solid-js';
import {
  CrmListEmpty,
  CrmListError,
  CrmListSearchEmpty,
  CrmListSkeleton,
} from '../components/list-state';
import { useCrmContext } from '../context/crm-context';
import { useCrmWorkspace } from '../context/workspace-context';
import { useCurrentTeamQuery } from './use-crm';

export function CrmEmptyState(
  props: {
    filtered?: boolean;
    onClearFilters?: () => void;
    onClearPeopleSearch?: () => void;
    onEditList?: () => void;
  } = {}
) {
  const {
    host,
    activeTab,
    peopleVisibility,
    queryFilters,
    searchText,
    setSearchText,
    stageFilter,
    ownerFilter,
  } = useCrmWorkspace();
  const { openCreateCompany, openCreateContact } = useCrmContext();
  const peopleSearch = () => queryFilters.state.include.crmContactSearch;
  const teamQuery = useCurrentTeamQuery();
  const teamResolved = () => teamQuery.data !== undefined;
  const hasNoTeam = () => teamQuery.data === null;
  return (
    <Switch>
      <Match when={teamQuery.isError && !teamResolved()}>
        <CrmListError
          title={t('crm.couldNotLoadSettings')}
          onRetry={() => teamQuery.refetch()}
        />
      </Match>
      <Match when={!teamResolved()}>
        <CrmListSkeleton label={t('crm.loadingCrm')} />
      </Match>
      <Match when={hasNoTeam()}>
        <EmptyStatePanel
          centered
          topSpacerClass="grow-[0.5] basis-0 mobile:basis-0"
          graphic={EmptyStateCompaniesGraphic}
          title={t('crm.teamRequiredTitle')}
          description={t('crm.teamRequiredDescription')}
          primaryAction={{
            label: t('crm.openTeamSettings'),
            onClick: () => host.openTeamSettings(),
          }}
        />
      </Match>
      <Match when={activeTab() === 'people' && !!peopleSearch()}>
        <CrmListSearchEmpty
          title={
            peopleVisibility.showRemoved()
              ? t('crm.noArchivedPeople')
              : t('crm.noPeopleMatchFilters')
          }
          description={t('crm.tryDifferentName')}
          onClearSearch={props.onClearPeopleSearch}
        />
      </Match>
      <Match when={peopleVisibility.showRemoved()}>
        <CrmListEmpty
          title={
            activeTab() === 'people'
              ? t('crm.noArchivedPeople')
              : t('crm.noArchivedCompanies')
          }
        />
      </Match>
      <Match when={activeTab() === 'people' && props.filtered}>
        <CrmListEmpty
          filtered
          title={t('crm.noPeopleMatchFilters')}
          description={t('crm.adjustFiltersHint')}
          action={
            props.onClearFilters
              ? { label: t('crm.clearFilters'), onClick: props.onClearFilters }
              : undefined
          }
        />
      </Match>
      <Match when={activeTab() === 'people'}>
        <CrmListEmpty
          title={t('crm.noPeopleYet')}
          description={t('crm.peopleWillAppear')}
          action={{ label: t('crm.addPerson'), onClick: () => openCreateContact() }}
        />
      </Match>
      <Match when={!!searchText().trim()}>
        <CrmListSearchEmpty
          title={t('crm.noMatchingCompanies')}
          onClearSearch={() => setSearchText('')}
        />
      </Match>
      <Match
        when={
          (props.filtered && !activeTab()?.startsWith('list:')) ||
          stageFilter().length > 0 ||
          ownerFilter().length > 0
        }
      >
        <CrmListEmpty
          filtered
          title={t('crm.noCompaniesMatchFilters')}
          description={t('crm.adjustStageOwnerHint')}
          action={
            props.onClearFilters
              ? { label: t('crm.clearFilters'), onClick: props.onClearFilters }
              : undefined
          }
        />
      </Match>
      <Match when={true}>
        <CrmListEmpty
          title={
            !activeTab() || activeTab() === 'active'
              ? t('crm.noCustomersYet')
              : activeTab()?.startsWith('list:')
                ? t('crm.noCompaniesInList')
                : t('crm.noCompaniesInView')
          }
          description={
            !activeTab() || activeTab() === 'active'
              ? t('crm.addCompanyOrOptIn')
              : activeTab()?.startsWith('list:')
                ? t('crm.editListHint')
                : t('crm.companiesWillAppear')
          }
          action={
            !activeTab() || activeTab() === 'active'
              ? { label: t('crm.addCompany'), onClick: openCreateCompany }
              : props.onEditList
                ? { label: t('crm.editList'), onClick: props.onEditList }
                : undefined
          }
        />
      </Match>
    </Switch>
  );
}
