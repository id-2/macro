import { DOCS_BASE } from '@app/constants/docs-links';
import type { ListView } from '@app/constants/list-views';
import {
  type CreatableName,
  useCreatableEnabled,
  useCreateAction,
} from '@app/features/command/Launcher';
import { openNewChannelModal } from '@channel/CreateChannelModal';
import { useAddInboxFlow, useEmailLinksStatus } from '@core/email-link';
import { TOKENS } from '@core/hotkey/tokens';
import { fireAndForget } from '@core/util/fireAndForget';
import EmptyStateAiGraphic from '@design/empty-state-ai.svg';
import EmptyStateCallsGraphic from '@design/empty-state-calls.svg';
import EmptyStateChannelsGraphic from '@design/empty-state-channels.svg';
import EmptyStateDocGraphic from '@design/empty-state-doc.svg';
import EmptyStateEmailGraphic from '@design/empty-state-email.svg';
import EmptyStateFolderGraphic from '@design/empty-state-folder.svg';
import EmptyStateInboxTrayGraphic from '@design/empty-state-inbox-tray.svg';
import EmptyStateInboxZeroGraphic from '@design/empty-state-inbox-zero.svg';
import EmptyStateNoFilterMatchGraphic from '@design/empty-state-no-filter-match.svg';
import EmptyStateNoSearchMatchGraphic from '@design/empty-state-no-search-match.svg';
import EmptyStateRoutinesGraphic from '@design/empty-state-routines.svg';
import EmptyStateTasksGraphic from '@design/empty-state-tasks.svg';
import PlusIcon from '@icon/system/regular/plus.svg';
import { EmptyStatePanel, FilteredHiddenBanner } from '@ui';
import { getNormalizedKeyString } from '@ui/components/Hotkey';
import { type Component, type JSXElement, Match, Show, Switch } from 'solid-js';
import { FolderDropZone } from './FolderDropZone';
import { useSoupView } from './soup-view-context';

type FallbackContent = {
  title: string;
  graphic?: Component<{ class?: string }>;
  description?: JSXElement;
  create?: { label: string; blockName: CreatableName };
  documentationUrl?: string;
};

/** Whether a failed request has no trustworthy local result to render. */
export function shouldShowLoadError(options: {
  hasData: boolean;
  forceEmptyState: boolean;
}): boolean {
  return !options.hasData && !options.forceEmptyState;
}

const FALLBACK_CONTENT: Partial<Record<ListView, FallbackContent>> = {
  documents: {
    title: 'Нет документов',
    graphic: EmptyStateDocGraphic,
    description:
      'Пишите, совместно редактируйте и делитесь документами прямо в Rox. Создавайте заметки, спецификации и любой длинный текст рядом с перепиской.',
    create: { label: 'Новый документ', blockName: 'md' },
    documentationUrl: `${DOCS_BASE}/product/docs`,
  },
  channels: {
    title: 'Нет каналов',
    graphic: EmptyStateChannelsGraphic,
    description:
      'Каналы — общие пространства для разговоров команды по теме, проекту или составу. Создайте канал, чтобы начать работу с командой.',
    create: { label: 'Новый канал', blockName: 'channel' },
    documentationUrl: `${DOCS_BASE}/product/channels`,
  },
  calls: {
    title: 'Нет звонков',
    graphic: EmptyStateCallsGraphic,
    description: (
      <>
        Здесь записи, расшифровки и краткие итоги звонков Rox.
        <br />
        Звонки доступны агентам.
      </>
    ),
    documentationUrl: `${DOCS_BASE}/product/calls`,
  },
};

export function EmptyState(props: {
  content?: JSXElement;
  listView?: ListView;
  search?: boolean;
  hasRefinementsFromBase?: boolean;
  hasHiddenItems?: boolean;
  onClearFilters?: () => void;
}) {
  const runCreateAction = useCreateAction();
  const emailActive = useEmailLinksStatus();
  const startAddInbox = useAddInboxFlow();
  const soup = useSoupView();
  const isCreatableEnabled = useCreatableEnabled();

  const commandMenuKey = () =>
    getNormalizedKeyString({ token: TOKENS.global.commandMenu });

  const onConnectEmail = () => {
    fireAndForget(startAddInbox(), 'add-inbox');
  };

  return (
    <Switch>
      <Match when={props.search}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateNoSearchMatchGraphic}
          title={
            soup.searchText().trim().length > 0
              ? `Ничего не найдено по запросу «${soup.searchText()}»`
              : 'Нет результатов'
          }
          description="Ищите по сообщениям, документам, задачам и другому. Попробуйте другой запрос или ослабьте фильтры."
          documentationUrl={`${DOCS_BASE}/product/search`}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={props.hasRefinementsFromBase}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateNoFilterMatchGraphic}
          title="Нет элементов по этим фильтрам"
          description="Измените или сбросьте фильтры, чтобы увидеть больше результатов."
        >
          {props.onClearFilters && (
            <FilteredHiddenBanner
              hasHiddenItems={false}
              onClearFilters={props.onClearFilters}
            />
          )}
        </EmptyStatePanel>
      </Match>

      <Match when={props.content}>{props.content}</Match>

      {/* The Reminders tab is not an email surface, so it sits above the
          connect-email gate — its empty copy is the same with or without a
          linked inbox. */}

      <Match when={props.listView === 'home' && !emailActive()}>
        <EmptyStatePanel
          graphic={EmptyStateInboxTrayGraphic}
          title="Входящие пусты"
          description="Перенесите входящие в Rox, чтобы отделять важное от остального, отвечать быстрее и работать с письмами вместе с агентами."
          primaryAction={{
            label: 'Подключить почту',
            onClick: onConnectEmail,
          }}
          documentationUrl={`${DOCS_BASE}/product/home`}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={props.listView === 'mail' && !emailActive()}>
        <EmptyStatePanel
          graphic={EmptyStateEmailGraphic}
          title="Подключите почту"
          description="Перенесите входящие в Rox, чтобы отделять важное от остального, отвечать быстрее и работать с письмами вместе с агентами."
          primaryAction={{
            label: 'Подключить почту',
            onClick: onConnectEmail,
          }}
          documentationUrl={`${DOCS_BASE}/product/email`}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={props.listView === 'home' && emailActive()}>
        {(() => {
          // Each inbox tab filters to a different slice, so the empty copy
          // should match: Signal is the important stuff, Noise is explicitly
          // the low-priority stuff, and All spans everything.
          const tab = soup.activeTab();
          const { title, description } =
            tab === 'noise'
              ? {
                  title: 'Нет шума',
                  description: (
                    <>
                      Сюда попадают маловажные элементы: рассылки и уведомления.
                      <br />
                      Сейчас разбирать нечего.
                    </>
                  ),
                }
              : tab === 'all'
                ? {
                    title: 'Входящие пусты',
                    description:
                      'Вы всё разобрали. Новые элементы появятся здесь по мере поступления.',
                  }
                : {
                    title: 'Входящие пусты',
                    description:
                      'Вы всё разобрали. Важные элементы появятся здесь по мере поступления.',
                  };
          return (
            <EmptyStatePanel
              graphic={EmptyStateInboxTrayGraphic}
              title={title}
              description={description}
              documentationUrl={`${DOCS_BASE}/product/home`}
              documentationLabel="Документация"
            />
          );
        })()}
      </Match>

      <Match when={props.listView === 'mail' && emailActive()}>
        <EmptyStatePanel
          graphic={EmptyStateInboxTrayGraphic}
          title="Входящие пусты"
          description="Вы всё разобрали. Новые письма появятся здесь по мере поступления."
          documentationUrl={`${DOCS_BASE}/product/email`}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={props.listView === 'tasks'}>
        <EmptyStatePanel
          graphic={EmptyStateTasksGraphic}
          title="Нечего делать"
          description="Здесь появятся задачи, которые вы создадите или которые вам назначат."
          primaryAction={{
            label: 'Новая задача',
            icon: PlusIcon,
            onClick: () => runCreateAction('task'),
          }}
          documentationUrl={`${DOCS_BASE}/product/tasks`}
          documentationLabel="Документация"
        />
      </Match>

      <Match
        when={props.listView === 'agents' && soup.activeTab() === 'routines'}
      >
        <EmptyStatePanel
          graphic={EmptyStateRoutinesGraphic}
          title="Нет рутин"
          description="Рутины работают в фоне и берут на себя повторяющиеся дела: разбирают сообщения, обновляют задачи и отправляют напоминания."
          primaryAction={{
            label: 'Новая рутина',
            icon: PlusIcon,
            onClick: () => runCreateAction('routine'),
          }}
          documentationUrl={`${DOCS_BASE}/product/agents`}
          documentationLabel="Документация"
        />
      </Match>

      <Match
        when={props.listView === 'agents' && soup.activeTab() === 'skills'}
      >
        <EmptyStatePanel
          graphic={EmptyStateAiGraphic}
          title="Навыков пока нет"
          description="Навыки — документы Markdown с указаниями, которым следует ИИ. Упомяните навык через / в любом поле ввода ИИ."
          primaryAction={{
            label: 'Новый навык',
            icon: PlusIcon,
            onClick: () => runCreateAction('skill'),
          }}
          documentationUrl={`${DOCS_BASE}/product/agents`}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={props.listView === 'agents'}>
        <EmptyStatePanel
          graphic={EmptyStateAiGraphic}
          title="Начните с агентов"
          description="Создайте агента или используйте Rox в любимом чате с ИИ или редакторе кода через MCP."
          primaryAction={{
            label: 'Новый агент',
            icon: PlusIcon,
            onClick: () => runCreateAction('agent'),
          }}
          documentationUrl={`${DOCS_BASE}/product/agents`}
          documentationLabel="Документация"
        />
      </Match>

      <Match
        when={
          props.listView === 'folders' ||
          // The Files split (the `documents` list view) surfaces folders under
          // its own Folders tab, so honor that tab here too — otherwise it
          // would fall through to the generic "No documents" fallback.
          (props.listView === 'documents' && soup.activeTab() === 'folders')
        }
      >
        <EmptyStatePanel
          graphic={EmptyStateFolderGraphic}
          title="Нет папок"
          description="Папки собирают переписки, документы и задачи в проекты. Создайте папку или перетащите файлы ниже, чтобы начать."
          primaryAction={{
            label: 'Новая папка',
            icon: PlusIcon,
            onClick: () => runCreateAction('project'),
          }}
          documentationUrl={`${DOCS_BASE}/product/drive`}
          documentationLabel="Документация"
        >
          <FolderDropZone />
        </EmptyStatePanel>
      </Match>

      <Match when={props.listView === 'search'}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateNoSearchMatchGraphic}
          title="Нет элементов"
          description={
            <>
              Ищите по сообщениям, документам, задачам и другому.
              {/* The rail opens Search directly, so point to the command menu here. */}
              <Show when={commandMenuKey()}>
                {(key) => (
                  <>
                    <br />
                    Нажмите{' '}
                    <kbd class="rounded border border-edge-muted bg-inset px-1 font-sans text-xs text-ink">
                      {key()}
                    </kbd>
                    , чтобы перейти к чему угодно или выполнить команду.
                  </>
                )}
              </Show>
            </>
          }
          documentationUrl={`${DOCS_BASE}/product/search`}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={true}>
        {(() => {
          const fallback = (props.listView &&
            FALLBACK_CONTENT[props.listView]) ?? {
            title: 'Нет элементов',
          };
          // A gated creatable is not offered here either. Nothing else stops
          // this button: a view can be reachable while the thing it creates is
          // flagged off, and `runCreateAction` would then decline the click.
          const createAction = () => {
            const create = fallback.create;
            if (!create || !isCreatableEnabled(create.blockName)) {
              return undefined;
            }
            return {
              label: create.label,
              icon: PlusIcon,
              onClick: () => {
                if (props.listView === 'channels') {
                  openNewChannelModal();
                  return;
                }
                runCreateAction(create.blockName);
              },
            };
          };
          return (
            <EmptyStatePanel
              graphic={fallback.graphic ?? EmptyStateInboxZeroGraphic}
              title={fallback.title}
              description={fallback.description}
              primaryAction={createAction()}
              documentationUrl={fallback.documentationUrl}
              documentationLabel="Документация"
            />
          );
        })()}
      </Match>
    </Switch>
  );
}
