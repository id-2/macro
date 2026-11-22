import { t } from '@app/lib/i18n';
import EmptyStateEmailGraphic from '@design/empty-state-email.svg';
import type { CrmCompanyEntity } from '@entity';
import { Tabs } from '@ui';
import { createMemo, createSignal } from 'solid-js';
import { CrmListEmpty } from '../components/list-state';
import {
  RecordSection,
  RecordSectionFilters,
} from '../components/record-section';
import { useCrmContext } from '../context/crm-context';
import type {
  CrmEmailSignal as EmailSignalView,
  CrmEmailScope as EmailView,
} from '../context/crm-sources';
import { RecordItemList } from './record-item-list';
import { useCompanyEmailsQuery } from './use-crm';

export function CompanyEmailsSection(props: { company?: CrmCompanyEntity }) {
  const domains = createMemo(
    () => props.company?.domains.map((domain) => domain.domain) ?? []
  );
  const [search, setSearch] = createSignal('');
  const crm = useCrmContext();
  const [view, setView] = createSignal<EmailView>('team');
  const [signalView, setSignalView] = createSignal<EmailSignalView>('all');
  const emailsQuery = useCompanyEmailsQuery(domains, view, signalView);

  const emptyMessage = () => {
    const signal = signalView() === 'signal';
    if (view() === 'me') {
      return signal
        ? t('crm.noCompanySignalEmailsInbox')
        : t('crm.noCompanyEmailsInbox');
    }
    if (props.company?.emailSync === false) {
      return t('crm.emailSyncDisabled');
    }
    return signal ? t('crm.noCompanySignalEmails') : t('crm.noCompanyEmails');
  };

  return (
    <RecordSection
      title={t('crm.emails')}
      search={search()}
      onSearchChange={setSearch}
      createAction={{
        label: t('crm.newEmail'),
        disabled: props.company?.emailSync === false,
        onClick: () => crm.openEmailComposer(),
      }}
      actions={
        <RecordSectionFilters
          activeCount={
            Number(signalView() !== 'all') + Number(view() !== 'team')
          }
          onClear={() => {
            setSignalView('all');
            setView('team');
          }}
        >
          <Tabs
            aria-label={t('crm.emailImportance')}
            size="sm"
            touch="inset"
            options={[
              { value: 'signal', label: t('crm.signal') },
              { value: 'all', label: t('crm.all') },
            ]}
            value={signalView()}
            onChange={setSignalView}
          />
          <Tabs
            aria-label={t('crm.emailInboxes')}
            size="sm"
            touch="inset"
            options={[
              { value: 'team', label: t('crm.team') },
              { value: 'me', label: t('crm.me') },
            ]}
            value={view()}
            onChange={setView}
          />
        </RecordSectionFilters>
      }
    >
      <RecordItemList
        source={emailsQuery}
        search={search()}
        pending={!props.company}
        onClearSearch={() => setSearch('')}
        emptyContent={
          <CrmListEmpty
            graphic={EmptyStateEmailGraphic}
            title={emptyMessage()}
            description={t('crm.companyEmailsEmpty')}
            action={
              props.company?.emailSync === false
                ? undefined
                : {
                    label: t('crm.newEmail'),
                    onClick: () => crm.openEmailComposer(),
                  }
            }
          />
        }
      />
    </RecordSection>
  );
}
