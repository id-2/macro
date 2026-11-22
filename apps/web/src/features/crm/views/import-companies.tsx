import { t } from '@app/lib/i18n';
import { fireAndForget } from '@core/util/fireAndForget';
import UploadIcon from '@icon/system/regular/upload-simple.svg';
import { Button, Dialog, Panel, Select } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { PipelineImportFailures } from '../components/pipeline-import-failures';
import type { CompanyImportPipelines } from '../context/pipelines';
import {
  createCompanyImport,
  type ImportDestination,
} from '../primitives/import-companies';
import { useCompanyImporter } from './use-crm';

/** The preview lists this many rows; the import takes them all. */
const PREVIEW_ROWS = 100;

export function CrmImport(props: {
  onClose: () => void;
  /** Where Stage, Owner, and Revenue go; absent while pipelines are unavailable. */
  pipelines?: CompanyImportPipelines;
  onOpenPipeline: (id: string) => void;
}) {
  let fileInput!: HTMLInputElement;
  const [fileName, setFileName] = createSignal('');
  const {
    rows,
    skipped,
    error,
    pending,
    completed,
    existing,
    pipelineData,
    pipeline,
    destination,
    setDestination,
    runnable,
    read,
    run,
  } = createCompanyImport(useCompanyImporter(), props.pipelines);
  type Choice = {
    value: string;
    label: string;
    destination: ImportDestination;
  };
  const choices = (): Choice[] => [
    {
      value: 'new:private',
      label: t('crm.newPrivatePipeline'),
      destination: { kind: 'new', sharing: 'private' },
    },
    {
      value: 'new:team',
      label: t('crm.newTeamPipeline'),
      destination: { kind: 'new', sharing: 'team' },
    },
    ...(props.pipelines?.existing() ?? []).map(
      (existing): Choice => ({
        value: `existing:${existing.id}`,
        label: existing.name,
        destination: { kind: 'existing', id: existing.id },
      })
    ),
  ];
  const chosen = () => {
    const current = destination();
    return choices().find((choice) =>
      current.kind === 'existing'
        ? choice.value === `existing:${current.id}`
        : choice.value === `new:${current.sharing}`
    );
  };
  const done = () => completed() + existing();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending() && props.onClose()}
      class="w-112 max-w-[calc(100vw-2rem)]"
    >
      <Panel class="h-auto">
        <Panel.Header class="px-5 py-3">
          <Dialog.Title class="text-sm font-semibold">
            {t('crm.importCompanies')}
          </Dialog.Title>
        </Panel.Header>
        <Panel.Body class="flex flex-col gap-4 p-5">
          <Dialog.Description class="text-sm leading-5 text-ink-muted">
            {t('crm.importCompaniesDescription')}
          </Dialog.Description>
          <input
            ref={fileInput}
            aria-label={t('crm.companiesCsv')}
            type="file"
            accept=".csv,text/csv"
            disabled={pending()}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              e.currentTarget.value = '';
              setFileName(file.name);
              fireAndForget(read(file), 'crm');
            }}
            class="hidden"
          />
          <div class="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              disabled={pending()}
              onClick={() => fileInput.click()}
            >
              <UploadIcon class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
              {fileName() ? t('crm.changeFile') : t('crm.chooseFile')}
            </Button>
            <span
              role="status"
              class="min-w-0 break-all text-sm text-ink-muted"
            >
              {fileName() || t('crm.noFileSelected')}
            </span>
          </div>
          <Show when={rows().length && !pending()}>
            <div class="max-h-64 overflow-auto rounded-lg border border-edge-muted">
              <For each={rows().slice(0, PREVIEW_ROWS)}>
                {(row) => (
                  <div class="flex justify-between gap-3 border-b border-edge-muted px-3 py-2 text-sm last:border-0">
                    <span class="truncate">{row.name}</span>
                    <span class="text-ink-muted">{row.domain}</span>
                  </div>
                )}
              </For>
              <Show when={rows().length > PREVIEW_ROWS}>
                <div class="px-3 py-2 text-sm text-ink-muted">
                  {t('crm.andMoreRows', {
                    count: rows().length - PREVIEW_ROWS,
                  })}
                </div>
              </Show>
            </div>
          </Show>
          <Show when={skipped() && !done()}>
            <p class="text-sm text-ink-muted">
              {t('crm.rowsSkipped', { count: skipped() })}
            </p>
          </Show>
          <Show when={!pipeline() && pipelineData()}>
            {(data) => (
              <p class="text-sm text-ink-muted">
                <Show
                  when={props.pipelines}
                  fallback={t('crm.fieldsNotImported', {
                    fields: data().fields.join(', '),
                  })}
                >
                  {t('crm.fieldsImport', {
                    fields: data().fields.join(', '),
                    count: data().csv.rows.length,
                  })}{' '}
                  <Show when={destination().kind === 'new'}>
                    {' '}
                    {t('crm.pipelineNamed', { name: data().name })}
                  </Show>
                  :
                </Show>
              </p>
            )}
          </Show>
          <Show when={props.pipelines && !pipeline() && pipelineData()}>
            <Select<Choice>
              options={choices()}
              optionValue="value"
              optionTextValue="label"
              value={chosen()}
              onChange={(choice) =>
                choice && setDestination(choice.destination)
              }
              disabled={pending()}
              modal={false}
            >
              <Select.Trigger
                aria-label={t('crm.pipelineForStageOwner')}
                class="h-10 w-full min-w-0 rounded-lg border border-edge bg-surface-2 px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:opacity-50"
              >
                <Select.Value<Choice>>
                  {(state) => state.selectedOption()?.label}
                </Select.Value>
                <Select.Icon />
              </Select.Trigger>
              <Select.Content>
                <Select.Listbox />
              </Select.Content>
            </Select>
          </Show>
          <Show when={done()}>
            <p role="status" class="text-sm">
              {completed().toLocaleString()}{' '}
              {completed() === 1 ? 'company' : 'companies'} imported
              <Show when={existing()}>
                , {existing().toLocaleString()} already in your CRM
              </Show>
              .
            </p>
          </Show>
          <Show when={pipeline()}>
            {(added) => (
              <p
                role="status"
                class="flex flex-wrap items-center gap-1 text-sm"
              >
                {t('crm.rowsAdded', {
                  count: added().added,
                  pipeline: added().pipeline.name,
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => props.onOpenPipeline(added().pipeline.id)}
                >
                  {t('crm.openPipeline')}
                </Button>
              </p>
            )}
          </Show>
          <PipelineImportFailures
            addLabel={t('crm.addDeal')}
            failures={pipeline()?.invalid}
          />
          <Show when={error()}>
            <p role="alert" class="text-sm text-failure">
              {error()}
            </p>
          </Show>
        </Panel.Body>
        <Panel.Footer class="flex-wrap justify-end gap-2 px-5 py-3">
          <Button variant="ghost" disabled={pending()} onClick={props.onClose}>
            {t('common.close')}
          </Button>
          <Button
            variant="secondary"
            disabled={pending() || !runnable()}
            onClick={() => fireAndForget(run(), 'crm')}
          >
            {pending()
              ? t('crm.importingProgress', {
                  done: done(),
                  total: rows().length,
                })
              : rows().length || !runnable()
                ? t('crm.importCompaniesCount', { count: rows().length })
                : t('crm.addToPipeline')}
          </Button>
        </Panel.Footer>
      </Panel>
    </Dialog>
  );
}
