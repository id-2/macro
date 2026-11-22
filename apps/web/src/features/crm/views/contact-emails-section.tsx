import { t } from '@app/lib/i18n';
import EmptyStateEmailGraphic from '@design/empty-state-email.svg';
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
import {
  type CrmContact as CrmContactResponse,
  contactEmails,
} from '../core/contact';
import { RecordItemList } from './record-item-list';
import { useContactEmailsQuery } from './use-crm';

export function ContactEmailsSection(props: { contact?: CrmContactResponse }) {
  const email = () => props.contact?.email ?? undefined;
  // The list covers every address; a new email goes to the primary.
  const emails = createMemo(
    () => (props.contact ? contactEmails(props.contact) : []),
    [],
    { equals: (a, b) => a.join('\n') === b.join('\n') }
  );
  const [search, setSearch] = createSignal('');
  const crm = useCrmContext();
  const [view, setView] = createSignal<EmailView>('team');
  const [signalView, setSignalView] = createSignal<EmailSignalView>('all');
  const emailsQuery = useContactEmailsQuery(emails, view, signalView);

  return (
    <RecordSection
      title={t('crm.emails')}
      search={search()}
      onSearchChange={setSearch}
      createAction={{
        label: t('crm.newEmail'),
        onClick: () => crm.openEmailComposer(email()),
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
        pending={!props.contact}
        onClearSearch={() => setSearch('')}
        emptyContent={
          <CrmListEmpty
            graphic={EmptyStateEmailGraphic}
            title={
                signalView() === 'signal'
                  ? view() === 'me'
                    ? t('crm.noContactSignalEmailsInbox')
                    : t('crm.noContactSignalEmails')
                  : view() === 'me'
                    ? t('crm.noContactEmailsInbox')
                    : t('crm.noContactEmails')
              }
            description={t('crm.contactEmailsEmpty')}
            action={{
              label: t('crm.newEmail'),
              onClick: () => crm.openEmailComposer(email()),
            }}
          />
        }
      />
    </RecordSection>
  );
}
