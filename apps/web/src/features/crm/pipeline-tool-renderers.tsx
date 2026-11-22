import { t } from '@app/lib/i18n';
import { BaseTool } from '@core/component/AI/component/tool/BaseTool';
import { createToolRenderer } from '@core/component/AI/component/tool/ToolRenderer';
import FileCsv from '@icon/system/regular/file-csv.svg';
import Kanban from '@icon/system/regular/kanban.svg';
import { queryClient } from '@queries/client';
import { soupKeys } from '@queries/soup/keys';
import { Show } from 'solid-js';
import { pluralize } from './components/tool-companies';
import {
  PipelineEntriesToolResponse,
  PipelinesToolResponse,
  recordName,
  UpdatedEntriesToolResponse,
} from './components/tool-pipelines';
import { crmKeys } from './queries/keys';

/** New, renamed, re-shared or reshaped pipelines show in the sidebar now. */
async function refreshPipelines() {
  await queryClient.invalidateQueries({ queryKey: crmKeys.pipelines._def });
}

/** Imported companies and entries show in listings and open pipelines now. */
async function refreshImported() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: crmKeys._def }),
    queryClient.invalidateQueries({ queryKey: soupKeys._def }),
  ]);
}

function Summary(props: { text: string }) {
  return <p class="px-2 py-1 text-xs text-ink-muted">{props.text}</p>;
}

function Status(props: { text?: string }) {
  return (
    <Show when={props.text}>
      {(text) => (
        <span class="shrink-0 whitespace-nowrap text-xs text-ink-extra-muted">
          {text()}
        </span>
      )}
    </Show>
  );
}

function Label(props: { children: string; status?: string }) {
  return (
    <div class="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden">
      <span class="min-w-0 truncate">{props.children}</span>
      <Status text={props.status} />
    </div>
  );
}

const listPipelinesHandler = createToolRenderer({
  name: 'ListPipelines',
  render: (ctx) => (
    <BaseTool
      icon={Kanban}
      renderContext={ctx.renderContext}
      type="call"
      response={
        ctx.response ? (
          <PipelinesToolResponse pipelines={ctx.response.data.pipelines} />
        ) : undefined
      }
    >
      <Label
        status={
          ctx.response
            ? t('crm.pipelineCount', { count: ctx.response.data.pipelines.length })
            : undefined
        }
      >
        {t('crm.toolListPipelines')}
      </Label>
    </BaseTool>
  ),
});

const findPipelineEntriesHandler = createToolRenderer({
  name: 'FindPipelineEntries',
  render: (ctx) => {
    const groups = () => ctx.response?.data.pipelines ?? [];
    const target = () =>
      groups().length === 1
        ? ` ${t('crm.toolInPipeline', { name: groups()[0]?.pipelineName ?? '' })}`
        : '';
    return (
      <BaseTool
        icon={Kanban}
        renderContext={ctx.renderContext}
        type="call"
        response={
          ctx.response ? (
            <PipelineEntriesToolResponse
              entries={groups().flatMap((group) => group.entries)}
              empty={t('crm.noMatchingEntries')}
            />
          ) : undefined
        }
      >
        <Label
          status={
            ctx.response
              ? t('crm.entryCount', { count: ctx.response.data.matched })
              : undefined
          }
        >
          {`${t('crm.toolFindEntries')}${target()}${
            ctx.tool.data.search
              ? ` ${t('crm.toolMatching', { search: ctx.tool.data.search })}`
              : ''
          }`}
        </Label>
      </BaseTool>
    );
  },
});

const addToPipelineHandler = createToolRenderer({
  name: 'AddToPipeline',
  render: (ctx) => {
    const added = () => ctx.response?.data.added ?? [];
    return (
      <BaseTool
        icon={Kanban}
        renderContext={ctx.renderContext}
        type="call"
        response={
          ctx.response ? (
            <PipelineEntriesToolResponse
              entries={added()}
              empty={t('crm.nothingAdded')}
              noted={{
                entries: ctx.response.data.alreadyPresent ?? [],
                note: t('crm.alreadyInPipeline'),
              }}
            />
          ) : undefined
        }
      >
        <Label
          status={
            ctx.response
              ? t('crm.entriesAdded', { count: added().length })
              : undefined
          }
        >
          {ctx.response
            ? t('crm.toolAddedToPipeline', {
                names:
                  added()
                    .map((entry) => recordName(entry.record))
                    .join(', ') || t('crm.nothing'),
              })
            : t('crm.toolAddRecords', {
                count: ctx.tool.data.entries.length,
              })}
        </Label>
      </BaseTool>
    );
  },
});

const updatePipelineEntriesHandler = createToolRenderer({
  name: 'UpdatePipelineEntries',
  render: (ctx) => (
    <BaseTool
      icon={Kanban}
      renderContext={ctx.renderContext}
      type="call"
      response={
        ctx.response ? (
          <UpdatedEntriesToolResponse updated={ctx.response.data.updated} />
        ) : undefined
      }
    >
      <Label
        status={
          ctx.response
            ? t('crm.entryCount', { count: ctx.response.data.updated.length })
            : undefined
        }
      >
        {ctx.response ? t('crm.updatedEntries') : t('crm.updateEntries')}
      </Label>
    </BaseTool>
  ),
});

const removeFromPipelineHandler = createToolRenderer({
  name: 'RemoveFromPipeline',
  render: (ctx) => (
    <BaseTool
      icon={Kanban}
      renderContext={ctx.renderContext}
      type="call"
      response={
        ctx.response ? (
          <PipelineEntriesToolResponse
            entries={ctx.response.data.removed}
            empty={t('crm.nothingRemoved')}
          />
        ) : undefined
      }
    >
      <Label
        status={
          ctx.response
            ? t('crm.entriesRemoved', {
                count: ctx.response.data.removed.length,
              })
            : undefined
        }
      >
        {ctx.response ? t('crm.removedFromPipeline') : t('crm.removeFromPipeline')}
      </Label>
    </BaseTool>
  ),
});

const createPipelineHandler = createToolRenderer({
  name: 'CreatePipeline',
  handleResponse: refreshPipelines,
  render: (ctx) => (
    <BaseTool
      icon={Kanban}
      renderContext={ctx.renderContext}
      type="call"
      response={
        ctx.response ? (
          <PipelinesToolResponse pipelines={[ctx.response.data.pipeline]} />
        ) : undefined
      }
    >
      <Label>
        {ctx.response
          ? t('crm.createdPipeline', { name: ctx.tool.data.name })
          : t('crm.createPipelineNamed', { name: ctx.tool.data.name })}
      </Label>
    </BaseTool>
  ),
});

const editPipelineHandler = createToolRenderer({
  name: 'EditPipeline',
  handleResponse: refreshPipelines,
  render: (ctx) => (
    <BaseTool
      icon={Kanban}
      renderContext={ctx.renderContext}
      type="call"
      response={
        ctx.response ? (
          <PipelinesToolResponse pipelines={[ctx.response.data.pipeline]} />
        ) : undefined
      }
    >
      <Label>
        {ctx.response
          ? t('crm.updatedPipeline', { name: ctx.response.data.pipeline.name })
          : t('crm.editPipeline')}
      </Label>
    </BaseTool>
  ),
});

const importCompaniesCsvHandler = createToolRenderer({
  name: 'ImportCompaniesCsv',
  handleResponse: refreshImported,
  render: (ctx) => (
    <BaseTool
      icon={FileCsv}
      renderContext={ctx.renderContext}
      type="call"
      response={
        ctx.response ? <Summary text={ctx.response.data.summary} /> : undefined
      }
    >
      <Label
        status={
          ctx.response
            ? t('crm.companiesCreated', { count: ctx.response.data.created })
            : undefined
        }
      >
        {ctx.response
          ? t('crm.importedCompaniesCsv')
          : t('crm.importCompaniesCsv')}
      </Label>
    </BaseTool>
  ),
});

const importPipelineCsvHandler = createToolRenderer({
  name: 'ImportPipelineCsv',
  handleResponse: refreshImported,
  render: (ctx) => (
    <BaseTool
      icon={FileCsv}
      renderContext={ctx.renderContext}
      type="call"
      response={
        ctx.response ? <Summary text={ctx.response.data.summary} /> : undefined
      }
    >
      <Label
        status={
          ctx.response
            ? t('crm.entriesAdded', { count: ctx.response.data.added })
            : undefined
        }
      >
        {ctx.response
          ? t('crm.importedCsvInto', { name: ctx.response.data.pipelineName })
          : t('crm.importCsvIntoPipeline')}
      </Label>
    </BaseTool>
  ),
});

const exportPipelineCsvHandler = createToolRenderer({
  name: 'ExportPipelineCsv',
  render: (ctx) => (
    <BaseTool
      icon={FileCsv}
      renderContext={ctx.renderContext}
      type="call"
      response={
        ctx.response ? <Summary text={ctx.response.data.summary} /> : undefined
      }
    >
      <Label
        status={
          ctx.response
            ? t('crm.entryCount', { count: ctx.response.data.rows })
            : undefined
        }
      >
        {ctx.response
          ? t('crm.exportedCsv', { name: ctx.response.data.fileName })
          : t('crm.exportPipelineCsv')}
      </Label>
    </BaseTool>
  ),
});

export const pipelineToolHandlers = {
  ListPipelines: listPipelinesHandler,
  FindPipelineEntries: findPipelineEntriesHandler,
  AddToPipeline: addToPipelineHandler,
  UpdatePipelineEntries: updatePipelineEntriesHandler,
  RemoveFromPipeline: removeFromPipelineHandler,
  CreatePipeline: createPipelineHandler,
  EditPipeline: editPipelineHandler,
  ImportCompaniesCsv: importCompaniesCsvHandler,
  ImportPipelineCsv: importPipelineCsvHandler,
  ExportPipelineCsv: exportPipelineCsvHandler,
};
