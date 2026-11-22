import { t } from '@app/lib/i18n';
import EmptyStateCallsGraphic from '@design/empty-state-calls.svg';
import EmptyStateDocGraphic from '@design/empty-state-doc.svg';
import { createSignal } from 'solid-js';
import { CrmListEmpty } from '../components/list-state';
import { RecordSection } from '../components/record-section';
import { useCrmContext } from '../context/crm-context';
import type { CrmRecordScope } from '../core/record';
import { RecordItemList } from './record-item-list';

/**
 * Documents associated with the record through its properties or references,
 * plus attachments of emails exchanged with its people.
 */
export function RecordFilesSection(props: { scope?: CrmRecordScope }) {
  const [search, setSearch] = createSignal('');
  const crm = useCrmContext();
  const files = crm.createRecordFiles(() => props.scope);
  return (
    <RecordSection
      title={t('crm.files')}
      search={search()}
      onSearchChange={setSearch}
      createAction={{
        label: t('crm.newNote'),
        onClick: () => crm.openCreateItem('notes'),
      }}
    >
      <RecordItemList
        source={files}
        search={search()}
        pending={!props.scope}
        onClearSearch={() => setSearch('')}
        emptyContent={
          <CrmListEmpty
            graphic={EmptyStateDocGraphic}
            title={t('crm.noFilesLinked')}
            description={`Create a note and link it to this ${props.scope?.type ?? 'record'} through its Companies or Contacts property.`}
            action={{
              label: t('crm.newNote'),
              onClick: () => crm.openCreateItem('notes'),
            }}
          />
        }
      />
    </RecordSection>
  );
}

/**
 * Calls associated with the record: linked to it or (for a company) to one of
 * its contacts when the call ended, or referencing it in the call thread.
 */
export function RecordCallsSection(props: { scope?: CrmRecordScope }) {
  const [search, setSearch] = createSignal('');
  const crm = useCrmContext();
  const calls = crm.createRecordCalls(() => props.scope);
  return (
    <RecordSection
      title={t('crm.calls')}
      search={search()}
      onSearchChange={setSearch}
      createAction={{
        label: t('crm.newCall'),
        onClick: () => crm.openCreateItem('calls'),
      }}
    >
      <RecordItemList
        source={calls}
        search={search()}
        pending={!props.scope}
        onClearSearch={() => setSearch('')}
        emptyContent={
          <CrmListEmpty
            graphic={EmptyStateCallsGraphic}
            title={t('crm.noCallsLinked')}
            description={`Calls with a Companies or Contacts link to this ${props.scope?.type ?? 'record'} will appear here.`}
            action={{
              label: t('crm.newCall'),
              onClick: () => crm.openCreateItem('calls'),
            }}
          />
        }
      />
    </RecordSection>
  );
}

/**
 * Items of any type associated with the record: what names it in a
 * Companies or Contacts property and what references it, including through a
 * company's contacts. Lives in the floating information panel.
 */
export function RecordReferencesSection(props: { scope?: CrmRecordScope }) {
  const references = useCrmContext().createRecordReferences(() => props.scope);
  return (
    <RecordItemList
      source={references}
      pending={!props.scope}
      empty={`Nothing references this ${props.scope?.type ?? 'record'} yet.`}
      narrowLayout="condensed"
    />
  );
}
