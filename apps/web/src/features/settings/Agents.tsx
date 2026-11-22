import { displayName } from '@core/constant/brand';
import { useOpenAgentDm } from '@app/features/agent-dms/open-agent-dm';
import {
  type AgentKind,
  isCoderHarness,
} from '@app/features/agents-view/core/agent-kind';
import { AGENTS_TOUR } from '@app/features/agents-view/tour';
import { t } from '@app/lib/i18n';
import { ModelCatalogPicker } from '@core/component/AI/component/input/ModelCatalogPicker';
import { MODEL_PRETTYNAME, Model } from '@core/component/AI/constant/model';
import {
  catalogModelLabel,
  modelLabel,
} from '@core/component/AI/constant/model-label';
import { toast } from '@core/component/Toast/Toast';
import { ENABLE_AGENT_DMS } from '@core/constant/featureFlags';
import {
  MACRO_AGENT_BOT_ID,
  MACRO_AGENT_NAME,
} from '@core/constant/macroAgent';
import { MACRO_NEW_BOT_ID } from '@core/constant/macroNew';
import { useChannelsContext } from '@core/context/channels';
import { useUserId } from '@core/context/user';
import { fireAndForget } from '@core/util/fireAndForget';
import { thrownResultErrorHasCode } from '@core/util/result';
import { RoxMark } from '@core/component/RoxMark';
import ArrowLeftIcon from '@icon/system/regular/arrow-left.svg';
import ChatIcon from '@icon/system/regular/chat-circle.svg';
import PencilIcon from '@icon/system/regular/pencil-simple.svg';
import PlusIcon from '@icon/system/regular/plus.svg';
import AgentIcon from '@icon/system/regular/sparkle.svg';
import TerminalIcon from '@icon/system/regular/terminal-window.svg';
import TrashIcon from '@icon/system/regular/trash.svg';
import UploadIcon from '@icon/system/regular/upload-simple.svg';
import CursorIcon from '@icon/wide-cursor-ide.svg';
import {
  removeAgentApiKey,
  saveAgentApiKey,
  useAgentApiKeyQuery,
} from '@queries/agents/agent-api-key';
import {
  type AgentWithHarnessId,
  type CreateAgentParams,
  useAgentsQuery,
  useCreateAgentMutation,
  useDeleteAgentMutation,
  useUpdateAgentMutation,
} from '@queries/agents/agents';
import { useUploadAgentAvatarMutation } from '@queries/agents/avatar';
import {
  type AgentModelTarget,
  buildAgentModelTargets,
  useAgentModelsQueries,
} from '@queries/agents/models';
import { providerCredentialRejectedMessage } from '@queries/agents/probe-errors';
import { useCursorApiKeyStatusQuery } from '@queries/auth/cursor-api-key';
import { useRunnableHarnessesQuery } from '@queries/harnesses/harnesses';
import { usePipedreamConnectedSlugs } from '@queries/pipedream-connectors';
import {
  useCurrentTeamQuery,
  useIsTeamAdmin,
  useIsTeamOwner,
} from '@queries/team/teams';
import type { AgentModelDto } from '@service-agent-harness/generated/schemas/agentModelDto';
import type { AgentMcpServer } from '@service-storage/generated/schemas/agentMcpServer';
import type { AgentMcpServers } from '@service-storage/generated/schemas/agentMcpServers';
import { useSearchParams } from '@solidjs/router';
import { ApiKeyInput, Avatar, Button, Dialog, Panel } from '@ui';
import { tourTarget } from '@ui/components/Tour';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  on,
  Show,
  Switch,
  untrack,
} from 'solid-js';
import { botAssignableChannelOptions } from '../channel/Bots/botChannelOptions';
import { canDeleteBot, canManageAgent } from '../channel/Bots/botPermissions';
import { ChannelMultiSelect } from '../channel/Bots/ChannelMultiSelect';
import {
  agentSettingsRequest,
  consumeAgentSettingsRequest,
} from './agentSettingsState';
import { CursorConnectPage } from './CursorConnectPage';
import { AgentSetupStrips } from './components/agent-setup-strips';
import { AutoArchiveSetting } from './components/auto-archive-setting';
import { CodingPreferencesSetting } from './components/coding-preferences-setting';
import { AgentInstructionsEditor } from './components/instructions-editor';
import { SettingsSelect } from './components/settings-select';
import { WhereItRunsOption } from './components/where-it-runs-option';
import {
  ComputerWhereItRuns,
  RunOnComputerRow,
} from './computers/views/agent-computer-entry';
import {
  type ApiKeyProvider,
  apiKeyProviderName,
  apiKeyProviderOf,
} from './core/agent-api-key';
import { PipedreamAppPicker } from './PipedreamAppPicker';
import {
  ChoiceRow,
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SettingsSurface,
} from './primitives';
import { RuntimePairingPage } from './RuntimePairingPage';

type AgentShare = 'Private' | 'Team';
type ChannelMode = 'all' | 'selected';

type AgentSummary = {
  id: string;
  name: string;
  tag: string;
  avatarUrl?: string;
  instructions: string;
  /** "In Rox", "In Cursor", … for the row's subtitle. */
  whereItRuns: string;
  defaultModel: string;
  channelSummary: string;
  share: AgentShare;
  persistedAgent?: AgentWithHarnessId;
  editable?: boolean;
};

type ConnectedHarness = {
  id: string;
  name: string;
  kind: 'builtin' | 'roxd';
  allowPermissionBypass: boolean;
  target: AgentModelTarget;
  connected?: boolean;
  /** A team's Rox computer rather than a machine someone paired. */
  computer?: boolean;
};

type ChannelOption = ReturnType<typeof botAssignableChannelOptions>[number];

/** The model id a runtime lists for its own default choice (Claude Code's). */
const DEFAULT_HARNESS_MODEL = 'default';
/**
 * The in-Rox catalog is a probe of agent-harness. When that probe is missing
 * (the service is down, or it returns no models) the row still offers the
 * house model. An auth failure is not a missing catalog.
 */
const ROX_HOUSE_CATALOG = {
  status: 'available' as const,
  currentModel: Model.roxR1Max,
  models: [
    {
      id: Model.roxR1Max,
      name: modelLabel(Model.roxR1Max),
    },
  ],
};

function catalogRequestIsAuthError(error: unknown): boolean {
  return (
    thrownResultErrorHasCode(error, 'UNAUTHORIZED') ||
    thrownResultErrorHasCode(error, 'FORBIDDEN') ||
    providerCredentialRejectedMessage(error) !== undefined
  );
}

const IN_MEMORY_HARNESS: ConnectedHarness = {
  id: 'in-memory',
  name: `Агент ${displayName}`,
  kind: 'builtin',
  allowPermissionBypass: true,
  target: { harness: 'in-memory' },
};

const MACRO_AGENT: AgentSummary = {
  id: MACRO_AGENT_BOT_ID,
  name: MACRO_AGENT_NAME,
  tag: 'rox',
  instructions: '',
  whereItRuns: `В ${MACRO_AGENT_NAME}`,
  defaultModel: MODEL_PRETTYNAME[Model.roxR1Max],
  channelSummary: 'Все каналы',
  share: 'Team',
};

/** Settings page for viewing and creating persistent agents. */
export function Agents(props: {
  createKind?: AgentKind;
  onCloseCreate?: () => void;
  onCursor: () => void;
  onSetUpRuntime: () => void;
  onManageRuntimes: () => void;
}) {
  const agentDm = ENABLE_AGENT_DMS ? useOpenAgentDm() : undefined;
  const messageAgent = (id: string) =>
    agentDm?.open(id === MACRO_AGENT_BOT_ID ? MACRO_NEW_BOT_ID : id);
  const agentList = tourTarget(AGENTS_TOUR.agentList);
  // A create request already waiting opens the form on first render, so the
  // list never flashes before it.
  const pendingCreate = untrack(agentSettingsRequest);
  const [creating, setCreating] = createSignal(
    pendingCreate?.type === 'create'
  );
  // A machine chosen elsewhere, such as a Rox computer just set up.
  const [createHarnessId, setCreateHarnessId] = createSignal(
    pendingCreate?.type === 'create' ? pendingCreate.harnessId : undefined
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const creatingFromLink = () => searchParams.createAgent === 'true';
  const closeCreateAgent = () => {
    setCreating(false);
    setCreateHarnessId(undefined);
    setEditingAgent(undefined);
    setDeletingAgent(undefined);
    props.onCloseCreate?.();
    if (creatingFromLink()) {
      setSearchParams({ createAgent: undefined }, { replace: true });
    }
  };
  const [editingAgent, setEditingAgent] = createSignal<AgentWithHarnessId>();
  const [deletingAgent, setDeletingAgent] = createSignal<AgentWithHarnessId>();
  const channelsContext = useChannelsContext();
  const currentUserId = useUserId();
  const agentsQuery = useAgentsQuery();
  const createAgentMutation = useCreateAgentMutation();
  const deleteAgentMutation = useDeleteAgentMutation();
  const updateAgentMutation = useUpdateAgentMutation();
  const currentTeamQuery = useCurrentTeamQuery();
  const isTeamOwner = useIsTeamOwner();
  const isTeamAdmin = useIsTeamAdmin();
  const cursorStatus = useCursorApiKeyStatusQuery();
  const cursorConnected = () =>
    cursorStatus.isSuccess ? cursorStatus.data.registered : false;
  const harnessesQuery = useRunnableHarnessesQuery();
  const connectedHarnesses = (): readonly ConnectedHarness[] => {
    const harnesses = harnessesQuery.isSuccess ? harnessesQuery.data : [];
    return buildAgentModelTargets(cursorConnected(), harnesses).map(
      (target) => {
        if (target.harness === 'in-memory') return IN_MEMORY_HARNESS;
        if (target.harness === 'cursor') {
          return {
            id: 'cursor',
            name: 'Cursor',
            kind: 'builtin',
            allowPermissionBypass: true,
            target,
          };
        }

        const harness = harnesses.find(
          (candidate) => candidate.id === target.harnessId
        );
        if (harness?.computer_id) {
          // A computer away is turned off; its agents start once it is on.
          return {
            id: harness.id,
            name: [
              harness.name,
              harness.connected ? undefined : t('computers.stopped'),
            ]
              .filter(Boolean)
              .join(' · '),
            kind: 'roxd',
            allowPermissionBypass: harness.allow_permission_bypass ?? false,
            target,
            connected: harness.connected,
            computer: true,
          };
        }
        return {
          id: target.harnessId ?? '',
          // Offline runtimes stay selectable: binding an agent to a machine
          // that is turned off is normal, and the label says what to expect.
          name: [
            harness?.name ?? 'roxd',
            harness?.shared_team_ids.length ? 'Компьютер команды' : undefined,
            harness && !harness.connected ? 'Не в сети' : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
          kind: 'roxd',
          allowPermissionBypass: harness?.allow_permission_bypass ?? false,
          target,
          connected: harness?.connected,
        };
      }
    );
  };
  const channelOptions = createMemo(() =>
    botAssignableChannelOptions(channelsContext.channels())
  );
  const currentTeamId = () =>
    currentTeamQuery.isSuccess ? currentTeamQuery.data?.team.id : undefined;
  const canShareWithTeam = () => currentTeamId() !== undefined;
  const isAgentCreator = (agent: AgentWithHarnessId) =>
    agent.bot.created_by === currentUserId();
  const canMakePrivate = (agent: AgentWithHarnessId) =>
    agent.bot.owner?.type !== 'team' || isAgentCreator(agent);
  const canDeleteAgent = (agent: AgentWithHarnessId) =>
    canDeleteBot(
      agent.bot,
      currentUserId(),
      currentTeamId(),
      isTeamOwner(),
      isTeamAdmin()
    );
  const managedAgents = () =>
    (agentsQuery.isSuccess ? agentsQuery.data : []).filter((agent) =>
      canManageAgent(agent.bot, currentUserId(), currentTeamId())
    );
  // Only a runtime's own catalog says which model its `default` resolves to,
  // so load the catalogs of runtimes that have an agent on `default`.
  const defaultModelHarnesses = createMemo(() =>
    connectedHarnesses().filter((harness) =>
      managedAgents().some(
        (agent) =>
          agent.default_model === DEFAULT_HARNESS_MODEL &&
          (agent.harness_id ?? agent.harness) === harness.id
      )
    )
  );
  const defaultModelQueries = useAgentModelsQueries(() =>
    defaultModelHarnesses().map((harness) => harness.target)
  );
  const catalogFor = (harnessId: string) => {
    const index = defaultModelHarnesses().findIndex(
      (harness) => harness.id === harnessId
    );
    const query = index >= 0 ? defaultModelQueries[index] : undefined;
    return query?.isSuccess && query.data.status === 'available'
      ? query.data.models
      : [];
  };
  const agents = createMemo(() =>
    managedAgents().map((agent) =>
      summarizeAgent(agent, connectedHarnesses(), channelOptions(), catalogFor)
    )
  );
  const teamAgents = createMemo(() => [
    {
      ...MACRO_AGENT,
      whereItRuns: t('agentControls.inRox', { name: displayName }),
    },
    ...agents().filter((agent) => agent.share === 'Team'),
  ]);
  const privateAgents = createMemo(() =>
    agents().filter((agent) => agent.share === 'Private')
  );

  createEffect(
    on(agentSettingsRequest, (request) => {
      if (request?.type !== 'create') return;
      setEditingAgent(undefined);
      setCreateHarnessId(request.harnessId);
      setCreating(true);
      consumeAgentSettingsRequest(request.id);
    })
  );

  // Opened from an agent's user card: wait for the list, then show that
  // agent's editor if it is one the viewer manages.
  createEffect(
    on([agentSettingsRequest, () => agentsQuery.isPending], ([request]) => {
      if (request?.type !== 'edit' || agentsQuery.isPending) return;
      const agent = agents().find(
        (candidate) => candidate.id === request.agentId
      );
      if (agent?.editable && agent.persistedAgent) {
        setCreating(false);
        setEditingAgent(agent.persistedAgent);
      }
      consumeAgentSettingsRequest(request.id);
    })
  );

  const createAgent = async (agent: CreateAgentParams) => {
    try {
      const created = await createAgentMutation.mutateAsync(agent);
      toast.success('Агент создан');
      return created.bot.id;
    } catch {
      toast.failure('Не удалось создать агента');
      return undefined;
    }
  };

  const updateAgent = async (agent: CreateAgentParams) => {
    const current = editingAgent();
    if (!current) return undefined;

    try {
      await updateAgentMutation.mutateAsync({
        ...agent,
        agentId: current.bot.id,
        ...(current.bot.description
          ? { description: current.bot.description }
          : {}),
      });
      toast.success('Агент обновлён');
      return current.bot.id;
    } catch {
      toast.failure('Не удалось обновить агента');
      return undefined;
    }
  };

  const deleteAgent = async () => {
    const current = deletingAgent();
    if (!current) return;

    try {
      await deleteAgentMutation.mutateAsync({
        agentId: current.bot.id,
        channelIds: current.channel_ids,
      });
      setDeletingAgent(undefined);
      if (editingAgent()?.bot.id === current.bot.id) setEditingAgent(undefined);
      toast.success('Агент удалён');
    } catch {
      toast.failure('Не удалось удалить агента');
    }
  };

  return (
    <>
      <Show
        when={
          !creating() &&
          !creatingFromLink() &&
          !props.createKind &&
          !editingAgent()
        }
      >
        <SettingsPage
          title="Агенты"
          description="Свои помощники со своим именем, инструкциями, моделью и местом работы."
        >
          <AgentSetupStrips
            onCursor={props.onCursor}
            onSetUpRuntime={props.onSetUpRuntime}
            onManageRuntimes={props.onManageRuntimes}
          />
          <section ref={agentList} aria-label="Ваши агенты">
            <SettingsSurface class="flex flex-col gap-2 p-5 touch:p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 flex-col gap-0.5">
                  <h2 class="text-base font-medium text-ink">Ваши агенты</h2>
                  <p class="text-sm leading-relaxed text-ink/60">
                    Общие для команды или только для вас.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCreating(true)}
                >
                  <PlusIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
                  Добавить агента
                </Button>
              </div>
              <SettingsCard>
                <For each={[...teamAgents(), ...privateAgents()]}>
                  {(agent) => (
                    <AgentRow
                      agent={agent}
                      onMessage={
                        agentDm
                          ? () =>
                              fireAndForget(
                                messageAgent(agent.id),
                                'agent-settings'
                              )
                          : undefined
                      }
                      messagePending={agentDm?.pending()}
                      onEdit={
                        agent.editable && agent.persistedAgent
                          ? () => setEditingAgent(agent.persistedAgent)
                          : undefined
                      }
                      onDelete={
                        agent.persistedAgent &&
                        canDeleteAgent(agent.persistedAgent)
                          ? () => setDeletingAgent(agent.persistedAgent)
                          : undefined
                      }
                    />
                  )}
                </For>
                <RunOnComputerRow />
                <Show when={agentsQuery.isPending}>
                  <p class="px-6 py-4 text-sm text-ink-muted">
                    Загрузка агентов…
                  </p>
                </Show>
                <Show when={agentsQuery.isError}>
                  <p class="px-6 py-4 text-xs text-negative">
                    Не удалось загрузить агентов. Обновите страницу.
                  </p>
                </Show>
              </SettingsCard>
            </SettingsSurface>
          </section>

          <CodingPreferencesSetting />
          <AutoArchiveSetting />
        </SettingsPage>
      </Show>

      <Show keyed when={props.createKind ?? (creating() || creatingFromLink())}>
        <AgentEditorPage
          initialKind={props.createKind}
          initialHarnessId={createHarnessId()}
          connectedHarnesses={connectedHarnesses()}
          currentTeamId={currentTeamId()}
          canShareWithTeam={canShareWithTeam()}
          canMakePrivate
          pending={createAgentMutation.isPending}
          onClose={closeCreateAgent}
          onSave={createAgent}
        />
      </Show>
      <Show when={!props.createKind && editingAgent()} keyed>
        {(agent) => (
          <AgentEditorPage
            agent={agent}
            connectedHarnesses={connectedHarnesses()}
            currentTeamId={currentTeamId()}
            canShareWithTeam={canShareWithTeam()}
            canMakePrivate={canMakePrivate(agent)}
            pending={updateAgentMutation.isPending}
            onClose={() => setEditingAgent(undefined)}
            onSave={updateAgent}
            onDelete={
              canDeleteAgent(agent) ? () => setDeletingAgent(agent) : undefined
            }
          />
        )}
      </Show>
      <Show when={!props.createKind && deletingAgent()} keyed>
        {(agent) => (
          <AgentDeleteDialog
            agentName={agent.bot.name}
            pending={deleteAgentMutation.isPending}
            onClose={() => setDeletingAgent(undefined)}
            onConfirm={() => fireAndForget(deleteAgent(), 'agent-settings')}
          />
        )}
      </Show>
    </>
  );
}

function summarizeAgent(
  agent: AgentWithHarnessId,
  harnesses: readonly ConnectedHarness[],
  channels: readonly ChannelOption[],
  catalogFor: (harnessId: string) => readonly AgentModelDto[]
): AgentSummary {
  const harnessKey = agent.harness_id ?? agent.harness;
  const harness = harnesses.find((option) => option.id === harnessKey);
  const selectedChannelNames = channels
    .filter((channel) => agent.channel_ids.includes(channel.id))
    .map((channel) => `#${channel.name}`);
  const channelSummary =
    agent.channel_scope === 'all'
      ? 'Все каналы'
      : selectedChannelNames.length > 0
        ? selectedChannelNames.join(', ')
        : ruSelectedChannels(agent.channel_ids.length);

  return {
    id: agent.bot.id,
    name: agent.bot.name,
    tag: agent.bot.handle,
    avatarUrl: agent.bot.avatar_url ?? undefined,
    instructions: agent.instructions,
    whereItRuns: whereItRunsLabel(harnessKey, harness),
    defaultModel:
      agent.default_model === DEFAULT_HARNESS_MODEL
        ? catalogModelLabel(agent.default_model, catalogFor(harnessKey))
        : (MODEL_PRETTYNAME[agent.default_model as Model] ??
          agent.default_model),
    channelSummary,
    share: agent.bot.owner?.type === 'team' ? 'Team' : 'Private',
    persistedAgent: agent,
    editable: true,
  };
}

function whereItRunsLabel(id: string, harness?: ConnectedHarness): string {
  if (id === 'in-memory') return t('agentControls.inRox', { name: displayName });
  if (id === 'cursor') return t('agentControls.inCursor');
  // Any other id is a registered roxd harness uuid; if it is not in the
  // connected list any more, the harness has been removed.
  if (harness?.computer)
    return `${t('computers.onComputer')} · ${harness.name}`;
  return harness
    ? `${t('agentControls.onYourMachine')} · ${harness.name}`
    : 'Отключённый компьютер';
}

function AgentRow(props: {
  agent: AgentSummary;
  onEdit?: () => void;
  onDelete?: () => void;
  onMessage?: () => void;
  messagePending?: boolean;
}) {
  return (
    <div class="flex items-center gap-4 px-6 py-4 mobile:items-start touch:px-4">
      <AgentAvatar agent={props.agent} />
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span class="truncate text-sm font-medium text-ink">
            {props.agent.name}
          </span>
          <span class="truncate text-xs text-ink-extra-muted">
            @{props.agent.tag}
          </span>
          <span class="shrink-0 rounded-full border border-edge-muted px-2 py-0.5 text-xxs font-medium uppercase text-ink-extra-muted">
            {props.agent.share === 'Team' ? 'Команда' : 'Личный'}
          </span>
        </div>
        <p class="mt-0.5 text-xs text-ink-extra-muted">
          {props.agent.whereItRuns} · {props.agent.defaultModel} ·{' '}
          {props.agent.channelSummary}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Show when={props.onMessage}>
          {(onMessage) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={props.messagePending}
              aria-label={`Написать ${props.agent.name}`}
              onClick={onMessage()}
            >
              <ChatIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
              Написать
            </Button>
          )}
        </Show>
        <Show when={props.onEdit}>
          {(onEdit) => (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Изменить ${props.agent.name}`}
              onClick={onEdit()}
            >
              <PencilIcon class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
            </Button>
          )}
        </Show>
        <Show when={props.onDelete}>
          {(onDelete) => (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="text-negative"
              aria-label={`Удалить ${props.agent.name}`}
              onClick={onDelete()}
            >
              <TrashIcon class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
            </Button>
          )}
        </Show>
      </div>
    </div>
  );
}

function AgentAvatar(props: { agent: AgentSummary }) {
  return (
    <Avatar size="lg" class="bg-surface text-accent ring ring-edge-muted">
      <Show
        when={props.agent.avatarUrl}
        fallback={
          <Avatar.Fallback>
            <Show
              when={props.agent.id === MACRO_AGENT_BOT_ID}
              fallback={<AgentIcon class="size-5" />}
            >
              <RoxMark class="absolute inset-0 size-full" cover />
            </Show>
          </Avatar.Fallback>
        }
      >
        {(avatarUrl) => (
          <Avatar.Image src={avatarUrl()} alt={`Аватар: ${props.agent.name}`} />
        )}
      </Show>
    </Avatar>
  );
}

function AgentDeleteDialog(props: {
  agentName: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !props.pending && props.onClose()}
      position="center"
      visibleScrim
      class="w-[min(480px,calc(100vw-16px))]"
    >
      <Panel depth={2} class="rounded-xl text-ink">
        <Panel.Header class="px-5 py-3">
          <Dialog.Title class="text-sm font-semibold">
            Удалить {props.agentName}?
          </Dialog.Title>
        </Panel.Header>
        <Panel.Body class="p-5">
          <Dialog.Description class="text-sm leading-5 text-ink-muted">
            Агент будет убран из всех каналов, а его настройки удалены навсегда.
            Это нельзя отменить.
          </Dialog.Description>
        </Panel.Body>
        <Panel.Footer class="justify-end gap-2 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={props.pending}
            onClick={props.onClose}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={props.pending}
            onClick={props.onConfirm}
          >
            <TrashIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
            {props.pending ? 'Удаление…' : 'Удалить агента'}
          </Button>
        </Panel.Footer>
      </Panel>
    </Dialog>
  );
}

function AgentEditorPage(props: {
  initialKind?: AgentKind;
  /** The machine a new agent starts on under Where it runs. */
  initialHarnessId?: string;
  agent?: AgentWithHarnessId;
  connectedHarnesses: readonly ConnectedHarness[];
  currentTeamId?: string;
  canShareWithTeam: boolean;
  canMakePrivate: boolean;
  pending: boolean;
  onClose: () => void;
  /** Saves the agent, resolving to its id, or `undefined` when it failed. */
  onSave: (agent: CreateAgentParams) => Promise<string | undefined>;
  onDelete?: () => void;
}) {
  const [name, setName] = createSignal(props.agent?.bot.name ?? '');
  const [tag, setTag] = createSignal(props.agent?.bot.handle ?? '');
  const [tagEdited, setTagEdited] = createSignal(props.agent !== undefined);
  const [avatarUrl, setAvatarUrl] = createSignal<string | undefined>(
    props.agent?.bot.avatar_url ?? undefined
  );
  const uploadAvatar = useUploadAgentAvatarMutation();
  const [uploadingAvatar, setUploadingAvatar] = createSignal(false);
  const busy = () => props.pending || uploadingAvatar();
  const [instructions, setInstructions] = createSignal(
    props.agent?.instructions ?? ''
  );
  const [harnessId, setHarnessId] = createSignal(
    props.agent?.harness_id ??
      props.agent?.harness ??
      props.initialHarnessId ??
      (props.initialKind === 'coder'
        ? props.connectedHarnesses.find((harness) =>
            isCoderHarness(harness.kind === 'roxd' ? 'roxd' : harness.id)
          )?.id
        : undefined) ??
      props.connectedHarnesses[0]?.id ??
      ''
  );
  const modelQueries = useAgentModelsQueries(() =>
    props.connectedHarnesses.map((harness) => harness.target)
  );
  const selectedHarness = () =>
    props.connectedHarnesses.find((harness) => harness.id === harnessId());
  const modelQueryForHarness = (id: string) => {
    const index = props.connectedHarnesses.findIndex(
      (harness) => harness.id === id
    );
    return index >= 0 ? modelQueries[index] : undefined;
  };
  // A missing in-Rox catalog is not an auth failure, so the known house
  // model stays selectable instead of an empty error and Retry.
  const inMemoryHouseCatalog = (id: string) => {
    if (id !== IN_MEMORY_HARNESS.id) return;
    const query = modelQueryForHarness(id);
    if (!query || query.isPending) return;
    if (query.isError) {
      return catalogRequestIsAuthError(query.error)
        ? undefined
        : ROX_HOUSE_CATALOG;
    }
    if (!query.isSuccess) return;
    const data = query.data;
    if (data.status === 'available' && data.models.length > 0) return;
    return ROX_HOUSE_CATALOG;
  };
  const modelDataForHarness = (id: string) => {
    const query = modelQueryForHarness(id);
    return (
      inMemoryHouseCatalog(id) ?? (query?.isSuccess ? query.data : undefined)
    );
  };
  const preferredModelId = (id: string) => {
    const data = modelDataForHarness(id);
    if (data?.status === 'unsupported') return DEFAULT_HARNESS_MODEL;
    if (data?.status !== 'available') return '';
    const current = data.currentModel;
    if (
      current &&
      (data.models.length === 0 ||
        data.models.some((model) => model.id === current))
    ) {
      return current;
    }
    return data.models[0]?.id ?? '';
  };
  const [defaultModelId, setDefaultModelId] = createSignal(
    props.agent?.default_model ?? ''
  );
  const selectedDefaultModelId = () =>
    defaultModelId() || preferredModelId(harnessId());
  const selectedModelQuery = () => modelQueryForHarness(harnessId());
  const selectedModelData = () => modelDataForHarness(harnessId());
  const selectedModelOptions = () => {
    const data = selectedModelData();
    if (data?.status !== 'available') return [];

    const selected = selectedDefaultModelId();
    const savedModel =
      props.agent?.default_model === selected &&
      (props.agent.harness_id ?? props.agent.harness) === harnessId();
    if (
      selected.length === 0 ||
      data.models.some((model) => model.id === selected)
    ) {
      return data.models;
    }
    return [
      ...data.models,
      {
        id: selected,
        name: `${selected} (${savedModel ? 'сохранён, ' : ''}недоступен)`,
        description: undefined,
        group: undefined,
      },
    ];
  };
  const selectedCatalogOptions = () =>
    selectedModelOptions().map((model) => ({
      id: model.id,
      // The built-in runtime reports slugs as names; other runtimes name
      // their own models.
      label:
        harnessId() === IN_MEMORY_HARNESS.id ||
        model.id === DEFAULT_HARNESS_MODEL
          ? modelLabel(model.id, model.name, model.description)
          : model.name,
      description: model.description ?? undefined,
      group: model.group ?? undefined,
    }));
  const [channelMode, setChannelMode] = createSignal<ChannelMode>(
    props.agent?.channel_scope ?? 'all'
  );
  const [selectedChannelIds, setSelectedChannelIds] = createSignal<string[]>(
    props.agent?.channel_ids ?? []
  );
  const [share, setShare] = createSignal<AgentShare>(
    props.agent?.bot.owner?.type === 'team' ? 'Team' : 'Private'
  );
  const connections = usePipedreamConnectedSlugs();
  const [mcp, setMcp] = createSignal<AgentMcpServers>(
    props.agent?.mcp ?? { scope: 'owner_connections' }
  );
  const selectedMcpServers = (): AgentMcpServer[] => {
    const current = mcp();
    return current.scope === 'selected' ? current.servers : [];
  };
  // Picks survive a round trip through "Use my connected apps", so toggling
  // the radio to compare does not throw the list away.
  let rememberedMcpServers: AgentMcpServer[] = selectedMcpServers();
  const setMcpScope = (scope: AgentMcpServers['scope']) => {
    if (scope === 'selected') {
      setMcp({ scope: 'selected', servers: rememberedMcpServers });
    } else {
      rememberedMcpServers = selectedMcpServers();
      setMcp({ scope: 'owner_connections' });
    }
  };
  const setSelectedMcpServers = (servers: AgentMcpServer[]) => {
    rememberedMcpServers = servers;
    setMcp({ scope: 'selected', servers });
  };
  // A Rox computer is the team's own sandbox, so its agents bypass
  // permission prompts unless someone chooses otherwise.
  const [autoAcceptPick, setAutoAcceptChoice] = createSignal<boolean>();
  const autoAcceptChoice = () =>
    autoAcceptPick() ??
    (props.agent
      ? props.agent.auto_accept_permissions === true
      : selectedHarness()?.computer === true);
  const allowPermissionBypass = () =>
    selectedHarness()?.allowPermissionBypass === true;
  const autoAcceptPermissions = () =>
    selectedHarness()?.kind === 'builtin' ||
    (allowPermissionBypass() && autoAcceptChoice());
  // The saved choice, or none: an agent that never chose follows its
  // harness, so a fresh form and a re-picked runtime both start from there.
  const [codingChoice, setCodingChoice] = createSignal<boolean | undefined>(
    props.agent?.is_coding ??
      (props.initialKind ? props.initialKind === 'coder' : undefined)
  );
  const harnessCodes = () => {
    const harness = selectedHarness();
    return isCoderHarness(harness?.kind === 'roxd' ? 'roxd' : harness?.id);
  };
  const isCoding = () => codingChoice() ?? harnessCodes();
  let avatarInputRef: HTMLInputElement | undefined;
  let pageContentRef: HTMLDivElement | undefined;

  const [setup, setSetup] = createSignal<'cursor' | 'pairing'>();
  const [advancedOpen, setAdvancedOpen] = createSignal(false);
  const cursorHarness = () =>
    props.connectedHarnesses.find((harness) => harness.id === 'cursor');
  const roxdHarnesses = () =>
    props.connectedHarnesses.filter(
      (harness) => harness.kind === 'roxd' && !harness.computer
    );
  const computerHarnesses = () =>
    props.connectedHarnesses.filter((harness) => harness.computer);
  // Back from a setup guide, land on what was just set up.
  const finishSetup = () => {
    const finished = setup();
    setSetup(undefined);
    const ready = finished === 'cursor' ? cursorHarness() : roxdHarnesses()[0];
    if (ready) handleHarnessChange(ready.id);
  };
  const advancedSummary = () =>
    [
      isCoding() ? 'Агент для кода' : 'Чат-агент',
      channelMode() === 'all'
        ? 'Все каналы'
        : ruCount(
            selectedChannelIds().length,
            'канал',
            'канала',
            'каналов'
          ),
      mcp().scope === 'owner_connections'
        ? 'Ваши подключённые приложения'
        : `Выбрано ${ruCount(selectedMcpServers().length, 'приложение', 'приложения', 'приложений')}`,
    ].join(' · ');
  const modelPicker = () => (
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-xs font-medium text-ink-muted">
        {t('agentControls.model')}
      </span>
      <Show
        when={selectedModelQuery()}
        fallback={
          <p class="settings-input text-ink-muted">
            Список моделей недоступен
          </p>
        }
        keyed
      >
        {(query) => (
          <Show
            when={!query.isPending}
            fallback={
              <ModelCatalogPicker
                value={null}
                options={[]}
                placeholder="Загрузка моделей…"
                onSelect={setDefaultModelId}
                ariaLabel="Модель по умолчанию"
                triggerClass="w-full justify-between"
                pending
              />
            }
          >
            <Show
              when={
                !query.isError ||
                inMemoryHouseCatalog(harnessId()) !== undefined
              }
              fallback={
                <Show
                  when={
                    !computerHarnesses().some(
                      (harness) => harness.id === harnessId()
                    )
                  }
                  fallback={
                    // A status line, not a field: it wraps on a phone
                    // instead of spilling out of an input's fixed height.
                    <p class="flex min-h-9 not-touch:min-h-8 items-center text-sm text-ink-muted">
                      {t('computers.modelsWhenOn')}
                    </p>
                  }
                >
                  <div class="flex items-center gap-2">
                    <p class="min-w-0 flex-1 text-xs text-negative">
                      Не удалось загрузить модели для{' '}
                      {selectedHarness()?.name ?? 'этого компьютера'}.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label={`Повторить загрузку моделей для ${selectedHarness()?.name ?? 'этого компьютера'}`}
                      onClick={() =>
                        fireAndForget(query.refetch(), 'agent-settings')
                      }
                    >
                      {t('common.retry')}
                    </Button>
                  </div>
                </Show>
              }
            >
              <Show
                when={selectedModelData()?.status === 'available'}
                fallback={
                  <p class="settings-input text-ink-muted">
                    Этот компьютер не поддерживает выбор модели.
                  </p>
                }
              >
                <Show
                  when={selectedModelOptions().length > 0}
                  fallback={
                    <p class="settings-input text-ink-muted">
                      Этот компьютер не вернул ни одной модели.
                    </p>
                  }
                >
                  <ModelCatalogPicker
                    value={selectedDefaultModelId()}
                    options={selectedCatalogOptions()}
                    onSelect={setDefaultModelId}
                    ariaLabel="Модель по умолчанию"
                    triggerClass="w-full justify-between"
                    contentClass="overflow-hidden"
                    placement="bottom-start"
                  />
                </Show>
              </Show>
            </Show>
          </Show>
        )}
      </Show>
    </div>
  );
  const modelField = () => <div class="max-w-[280px]">{modelPicker()}</div>;

  // An agent that runs in Rox on an Anthropic or OpenAI model can run on
  // its own API key instead of Rox usage. The key is write-only: a saved
  // one shows masked, and is replaced by typing a new one.
  const apiKey = useAgentApiKeyQuery(() => props.agent?.bot.id);
  const [apiKeyDraft, setApiKeyDraft] = createSignal('');
  const [removingApiKey, setRemovingApiKey] = createSignal(false);
  const keyProvider = () =>
    harnessId() === IN_MEMORY_HARNESS.id
      ? apiKeyProviderOf(selectedDefaultModelId())
      : undefined;
  // A new agent has no id yet, so its query stays disabled; read the data
  // only once it has loaded, or the editor would suspend on it.
  const apiKeyData = () => (apiKey.isSuccess ? apiKey.data : undefined);
  const savedApiKey = () =>
    removingApiKey() ? undefined : (apiKeyData()?.key ?? undefined);
  const apiKeyLocked = () => apiKeyData()?.planAllows === false;
  const apiKeyHelp = (provider: ApiKeyProvider) => {
    const saved = savedApiKey();
    if (apiKeyLocked())
      return saved
        ? 'Ключи API агента входят в тарифы Premium и Max. Пока вы не перейдёте на них, агент работает за счёт использования Rox.'
        : 'Ключи API агента входят в тарифы Premium и Max.';
    if (saved && saved.provider !== provider.id)
      return `Сохранённый ключ ${apiKeyProviderName(saved.provider)} не используется с этой моделью.`;
    return `Списывает использование этого агента с вашего счёта ${provider.name}, а не с Rox. Оставьте пустым, чтобы работать на Rox.`;
  };
  // Optional, so it stays a one-line offer until asked for or already set.
  const [apiKeyOpen, setApiKeyOpen] = createSignal(false);
  const apiKeyShown = () =>
    apiKeyOpen() || savedApiKey() !== undefined || apiKeyDraft().length > 0;
  const apiKeyField = () => (
    <Show when={keyProvider()}>
      {(provider) => (
        <Show
          when={apiKeyShown()}
          fallback={
            <div class="flex max-w-[420px] items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs font-medium text-ink-muted">
                  Ключ API {provider().name}{' '}
                  <span class="whitespace-nowrap font-normal text-ink-extra-muted">
                    · Необязательно
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-ink-extra-muted">
                  {apiKeyLocked()
                    ? apiKeyHelp(provider())
                    : `Работает за счёт использования ${displayName}, пока вы не добавите свой.`}
                </p>
              </div>
              <Show when={!apiKeyLocked()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="shrink-0 text-ink"
                  disabled={busy()}
                  onClick={() => setApiKeyOpen(true)}
                >
                  Добавить ключ
                </Button>
              </Show>
            </div>
          }
        >
          <div class="flex max-w-[420px] flex-col gap-1.5">
            <span class="text-xs font-medium text-ink-muted">
              Ключ API {provider().name}{' '}
              <span class="whitespace-nowrap font-normal text-ink-extra-muted">
                · Необязательно
              </span>
            </span>
            <div class="flex min-w-0 items-center gap-2">
              <ApiKeyInput
                aria-label={`Ключ API ${provider().name}`}
                class="flex-1"
                prefix={provider().prefix}
                saved={savedApiKey()?.provider === provider().id}
                disabled={busy() || apiKeyLocked()}
                value={apiKeyDraft()}
                onValueChange={setApiKeyDraft}
              />
              <Show
                when={savedApiKey()}
                fallback={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Отменить ключ API"
                    disabled={busy()}
                    onClick={() => {
                      setApiKeyDraft('');
                      setApiKeyOpen(false);
                    }}
                  >
                    Отмена
                  </Button>
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy()}
                  onClick={() => {
                    setApiKeyDraft('');
                    setApiKeyOpen(true);
                    setRemovingApiKey(true);
                  }}
                >
                  Убрать
                </Button>
              </Show>
            </div>
            <p class="text-xs text-ink-extra-muted">{apiKeyHelp(provider())}</p>
          </div>
        </Show>
      )}
    </Show>
  );
  // Saved after the agent, which a new agent needs an id from first.
  const saveApiKey = async (agentId: string) => {
    const draft = apiKeyDraft().trim();
    try {
      if (draft.length > 0 && keyProvider()) {
        await saveAgentApiKey(agentId, draft);
      } else if (removingApiKey()) {
        await removeAgentApiKey(agentId);
      }
    } catch (error) {
      toast.failure(
        `Агент сохранён, но ключ API — нет: ${
          error instanceof Error && error.message
            ? error.message
            : 'что-то пошло не так'
        }`
      );
    }
  };

  const close = () => {
    if (!busy()) props.onClose();
  };

  const handleNameInput = (value: string) => {
    setName(value);
    if (!tagEdited()) setTag(slugAgentTag(value));
  };

  const handleHarnessChange = (id: string) => {
    setHarnessId(id);
    setDefaultModelId(preferredModelId(id));
    setAutoAcceptChoice(false);
    setCodingChoice(undefined);
  };

  const handleAvatarInput = async (file: File | undefined) => {
    if (!file || busy()) return;
    setUploadingAvatar(true);
    try {
      setAvatarUrl(await uploadAvatar.mutateAsync(file));
    } catch (error) {
      toast.failure(
        error instanceof Error ? error.message : 'Не удалось загрузить аватар'
      );
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef) avatarInputRef.value = '';
    }
  };

  const canCreate = () =>
    !busy() &&
    name().trim().length > 0 &&
    tag().trim().length > 0 &&
    selectedHarness() !== undefined &&
    selectedDefaultModelId().length > 0 &&
    (channelMode() === 'all' || selectedChannelIds().length > 0) &&
    (mcp().scope === 'owner_connections' || selectedMcpServers().length > 0) &&
    (share() === 'Private' ? props.canMakePrivate : props.canShareWithTeam);

  const selectedTeamId = () => {
    if (share() === 'Private') return undefined;
    const currentOwner = props.agent?.bot.owner;
    return currentOwner?.type === 'team'
      ? currentOwner.team_id
      : props.currentTeamId;
  };

  const submit = async () => {
    if (!canCreate()) return;

    const harness = selectedHarness();
    const saved = await props.onSave({
      avatarUrl: avatarUrl(),
      channelIds: channelMode() === 'all' ? [] : selectedChannelIds(),
      channelScope: channelMode(),
      defaultModel: selectedDefaultModelId(),
      handle: slugAgentTag(tag()),
      // Registered roxd harnesses send the 'roxd' slug plus their uuid;
      // built-ins keep sending their own slug with no harness id.
      harness: harness?.kind === 'roxd' ? 'roxd' : (harness?.id ?? ''),
      harnessId: harness?.kind === 'roxd' ? harness.id : undefined,
      name: name().trim(),
      instructions: instructions().trim(),
      // Always sent, flag or no flag, so an editor without the Connections
      // section never wipes a selection somebody else made.
      mcp: mcp(),
      teamId: selectedTeamId(),
      autoAcceptPermissions: autoAcceptPermissions(),
      isCoding: isCoding(),
    });
    if (!saved) return;
    await saveApiKey(saved);
    close();
  };

  return (
    <Switch>
      <Match when={setup() === 'cursor'}>
        <CursorConnectPage onClose={finishSetup} />
      </Match>
      <Match when={setup() === 'pairing'}>
        <RuntimePairingPage onClose={finishSetup} />
      </Match>
      <Match when={!setup()}>
        <SettingsPage
          title={props.agent ? 'Изменить агента' : t('agentControls.newAgent')}
          showTitleInSheet
          description={t('agentControls.nameIt')}
          actions={
            <Button variant="ghost" size="sm" onClick={close} disabled={busy()}>
              <ArrowLeftIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />{' '}
              {t('common.back')}
            </Button>
          }
        >
          <section
            aria-label={props.agent ? 'Изменить агента' : t('agentControls.newAgent')}
            class="@container"
            ref={pageContentRef}
          >
            <form
              id="agent-form"
              class="flex flex-col gap-6"
              onSubmit={(event) => {
                event.preventDefault();
                fireAndForget(submit(), 'agent-settings');
              }}
            >
              <AgentFormSection
                title={t('settingsNav.profile')}
                description="Как этот агент выглядит в каналах и упоминаниях."
              >
                <div class="flex items-center gap-3 border-b border-edge-muted pb-4">
                  <button
                    type="button"
                    aria-label="Загрузить аватар"
                    disabled={busy()}
                    class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    onClick={() => avatarInputRef?.click()}
                  >
                    <AgentAvatar
                      agent={{
                        id: 'draft',
                        name: name() || 'Агент',
                        tag: tag(),
                        avatarUrl: avatarUrl(),
                        instructions: '',
                        whereItRuns: '',
                        defaultModel: '',
                        channelSummary: '',
                        share: share(),
                      }}
                    />
                  </button>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-ink">Аватар</div>
                    <div class="mt-0.5 text-xs text-ink-muted">
                      Необязательно · лучше квадратные изображения
                    </div>
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    class="hidden"
                    disabled={busy()}
                    onChange={(event) =>
                      fireAndForget(
                        handleAvatarInput(event.currentTarget.files?.[0]),
                        'agent-settings'
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy()}
                    onClick={() => avatarInputRef?.click()}
                  >
                    <UploadIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />
                    {uploadingAvatar() ? 'Загрузка…' : t('teamAgents.upload')}
                  </Button>
                </div>

                <div class="mt-4 grid grid-cols-1 gap-3 @min-[440px]:grid-cols-2">
                  <label class="flex flex-col gap-1.5">
                    <span class="text-xs font-medium text-ink">Имя</span>
                    <input
                      autofocus
                      class="settings-input w-full"
                      placeholder="Исправитель ошибок"
                      value={name()}
                      onInput={(event) =>
                        handleNameInput(event.currentTarget.value)
                      }
                    />
                  </label>
                  <label for="agent-tag" class="flex flex-col gap-1.5">
                    <span class="text-xs font-medium text-ink">Тег</span>
                    <div class="flex items-center rounded-lg border border-edge-muted px-2 focus-within:border-accent">
                      <span class="text-sm text-ink-extra-muted">@</span>
                      <input
                        id="agent-tag"
                        aria-label="Тег"
                        class="min-w-0 flex-1 bg-transparent px-1.5 py-2 text-sm text-ink outline-none"
                        placeholder="bug-fixer"
                        value={tag()}
                        onInput={(event) => {
                          setTagEdited(true);
                          setTag(slugAgentTag(event.currentTarget.value));
                        }}
                      />
                    </div>
                  </label>
                </div>
              </AgentFormSection>

              <AgentFormSection
                title={t('agentControls.instructions')}
                description="Инструкции, которые агент получает в начале каждого разговора."
              >
                <AgentInstructionsEditor
                  markdown={instructions()}
                  onChange={setInstructions}
                  disabled={props.pending}
                  class="rounded-lg border border-edge-muted bg-input px-3 py-2.5 focus-within:border-accent"
                  placeholder="Опишите роль агента, как ему работать и каким должен быть хороший результат…"
                />
              </AgentFormSection>

              <AgentFormSection
                title={t('agentControls.whereItRuns')}
                description="Выберите, где этот агент выполняет работу."
              >
                {/* A fieldset is min-content wide by default; a long option would widen the phone form. */}
                <fieldset class="flex min-w-0 flex-col gap-2">
                  <legend class="sr-only">{t('agentControls.whereItRuns')}</legend>
                  <WhereItRunsOption
                    value="in-memory"
                    title={t('agentControls.inRox', { name: displayName })}
                    description={`Быстро и встроено. Использует инструменты ${displayName} и ваши подключённые приложения.`}
                    icon={<RoxMark />}
                    checked={harnessId() === IN_MEMORY_HARNESS.id}
                    onSelect={() => handleHarnessChange(IN_MEMORY_HARNESS.id)}
                  >
                    <div class="flex flex-col gap-3">
                      {modelField()}
                      {apiKeyField()}
                    </div>
                  </WhereItRunsOption>
                  <WhereItRunsOption
                    value="cursor"
                    title={t('agentControls.inCursor')}
                    description={
                      cursorHarness()
                        ? 'Работает как облачный агент Cursor по вашему тарифу Cursor.'
                        : 'Сначала подключите Cursor. Работает как облачный агент Cursor по вашему тарифу Cursor.'
                    }
                    icon={<CursorIcon />}
                    checked={harnessId() === 'cursor'}
                    disabled={!cursorHarness()}
                    action={
                      <Show when={!cursorHarness()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          class="text-ink"
                          aria-label="Подключить Cursor"
                          disabled={busy()}
                          onClick={() => setSetup('cursor')}
                        >
                          Подключить
                        </Button>
                      </Show>
                    }
                    onSelect={() => handleHarnessChange('cursor')}
                  >
                    {modelField()}
                  </WhereItRunsOption>
                  <WhereItRunsOption
                    value="harness"
                    title={t('agentControls.onYourMachine')}
                    description="Ваш агент на вашем компьютере. Локальные Claude Code, Codex или другая среда через roxd."
                    icon={<TerminalIcon />}
                    checked={roxdHarnesses().some(
                      (harness) => harness.id === harnessId()
                    )}
                    disabled={roxdHarnesses().length === 0}
                    action={
                      <Show when={roxdHarnesses().length === 0}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          class="text-ink"
                          aria-label="Настроить свой компьютер"
                          disabled={busy()}
                          onClick={() => setSetup('pairing')}
                        >
                          Настроить
                        </Button>
                      </Show>
                    }
                    onSelect={() => {
                      const first = roxdHarnesses()[0];
                      if (first) handleHarnessChange(first.id);
                    }}
                  >
                    <div class="grid grid-cols-1 gap-3 @min-[440px]:grid-cols-[repeat(2,minmax(0,280px))]">
                      <div class="flex min-w-0 flex-col gap-1.5">
                        <span class="text-xs font-medium text-ink-muted">
                          Компьютер
                        </span>
                        <SettingsSelect
                          label="Компьютер"
                          options={roxdHarnesses()}
                          value={harnessId()}
                          onChange={handleHarnessChange}
                        />
                      </div>
                      {modelPicker()}
                    </div>
                  </WhereItRunsOption>
                  <ComputerWhereItRuns
                    computers={computerHarnesses()}
                    harnessId={harnessId()}
                    checked={computerHarnesses().some(
                      (harness) => harness.id === harnessId()
                    )}
                    busy={busy()}
                    modelPicker={modelPicker()}
                    onSelect={handleHarnessChange}
                  />
                </fieldset>
                <Show when={!keyProvider() ? savedApiKey() : undefined}>
                  {(saved) => (
                    <div class="mt-3 flex items-center justify-between gap-3 text-xs text-ink-muted">
                      <span>
                        У этого агента сохранён ключ API{' '}
                        {apiKeyProviderName(saved().provider)}, который здесь не
                        используется.
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy()}
                        onClick={() => setRemovingApiKey(true)}
                      >
                        Убрать ключ
                      </Button>
                    </div>
                  )}
                </Show>
              </AgentFormSection>

              <AgentFormSection
                title="Кто может пользоваться"
                description="Личные агенты — ваши. Командные работают в общих каналах."
              >
                <fieldset class="grid grid-cols-1 gap-2 @min-[440px]:grid-cols-2">
                  <legend class="sr-only">Доступ</legend>
                  <ChoiceRow
                    name="agent-share"
                    value="private"
                    checked={share() === 'Private'}
                    title="Личный"
                    description={
                      props.canMakePrivate
                        ? 'Только вы можете пользоваться этим агентом и управлять им.'
                        : 'Сделать его личным может только создатель агента.'
                    }
                    disabled={!props.canMakePrivate}
                    onChange={() => setShare('Private')}
                  />
                  <ChoiceRow
                    name="agent-share"
                    value="team"
                    checked={share() === 'Team'}
                    title="Команда"
                    description={
                      props.canShareWithTeam
                        ? 'Команда может пользоваться этим агентом в общих каналах.'
                        : 'Создайте команду или вступите в неё, прежде чем делиться агентами.'
                    }
                    disabled={!props.canShareWithTeam}
                    onChange={() => setShare('Team')}
                  />
                </fieldset>
                <Show when={!props.canShareWithTeam}>
                  <p class="mt-3 border-t border-edge-muted pt-3 text-xs text-ink-extra-muted">
                    Для командных агентов нужен владелец команды. Создайте команду
                    или вступите в неё в настройках команды, чтобы включить этот вариант.
                  </p>
                </Show>
              </AgentFormSection>

              <AgentFormSection
                title="Дополнительно"
                description={advancedSummary()}
                expanded={advancedOpen()}
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-expanded={advancedOpen()}
                    aria-controls="agent-advanced"
                    onClick={() => setAdvancedOpen((open) => !open)}
                  >
                    {advancedOpen() ? 'Скрыть' : 'Показать'}
                  </Button>
                }
              >
                <Show when={advancedOpen()}>
                  <div id="agent-advanced" class="flex flex-col">
                    <fieldset class="grid gap-2">
                      <legend class="text-xs font-medium text-ink">
                        Ответ на упоминание
                      </legend>
                      <ChoiceRow
                        name="agent-coding"
                        value="coding"
                        title="Агент для кода"
                        description="Публикует карточку, которую можно открыть в живую сессию и смотреть, как агент работает в репозитории."
                        checked={isCoding()}
                        onChange={() => setCodingChoice(true)}
                      />
                      <ChoiceRow
                        name="agent-coding"
                        value="chat"
                        title="Чат-агент"
                        description="Отвечает в ветке, как человек, например @rox."
                        checked={!isCoding()}
                        onChange={() => setCodingChoice(false)}
                      />
                    </fieldset>
                    <Show when={selectedHarness()?.kind === 'roxd'}>
                      <fieldset class="mt-4 grid gap-2 border-t border-ink/[0.06] pt-4">
                        <legend class="text-xs font-medium text-ink">
                          Запросы разрешений
                        </legend>
                        <ChoiceRow
                          name="agent-permission-policy"
                          value="prompt"
                          title="Всегда спрашивать"
                          description="Редакторы сессии одобряют или отклоняют каждый запрос разрешения."
                          checked={!autoAcceptPermissions()}
                          onChange={() => setAutoAcceptChoice(false)}
                        />
                        <Show
                          when={allowPermissionBypass()}
                          fallback={
                            <p class="text-xs text-ink-muted">
                              Этот компьютер требует запросы разрешений. Включите
                              «Не спрашивать перед действием» в его параметрах
                              в настройках компьютеров.
                            </p>
                          }
                        >
                          <ChoiceRow
                            name="agent-permission-policy"
                            value="bypass"
                            title="Всегда пропускать"
                            suggested
                            description="Одобрять вызовы инструментов без вопроса."
                            checked={autoAcceptPermissions()}
                            onChange={() => setAutoAcceptChoice(true)}
                          />
                        </Show>
                      </fieldset>
                    </Show>

                    <AdvancedGroup
                      title="Подключения"
                      description="Какие подключённые приложения (инструменты MCP) может использовать этот агент."
                    >
                      <fieldset class="flex flex-col gap-2">
                        <legend class="sr-only">Подключения</legend>
                        <ChoiceRow
                          name="agent-mcp-mode"
                          value="owner_connections"
                          checked={mcp().scope === 'owner_connections'}
                          title="Использовать мои подключённые приложения"
                          description="Агент использует приложения, которые подключил запустивший его человек."
                          onChange={() => setMcpScope('owner_connections')}
                        />
                        <ChoiceRow
                          name="agent-mcp-mode"
                          value="selected"
                          checked={mcp().scope === 'selected'}
                          title="Конкретные приложения"
                          description="Выберите приложения из каталога. Каждый подключает свой аккаунт."
                          onChange={() => setMcpScope('selected')}
                        />
                      </fieldset>

                      <Show when={mcp().scope === 'selected'}>
                        <div class="mt-3 border-t border-edge-muted pt-3">
                          <PipedreamAppPicker
                            selected={selectedMcpServers()}
                            onChange={setSelectedMcpServers}
                            connectedSlugs={connections.slugs}
                            connectionsReady={connections.ready}
                            connectContainer={() => pageContentRef}
                          />
                        </div>
                      </Show>

                      <Show when={share() === 'Team'}>
                        <p class="mt-3 border-t border-edge-muted pt-3 text-xs text-ink-extra-muted">
                          Подключения личные. Участники, которые пользуются этим
                          агентом, подключают приложения в разделе «Агенты →
                          Подключения»; здесь показаны только ваши.
                        </p>
                      </Show>
                    </AdvancedGroup>

                    <AdvancedGroup
                      title="Каналы"
                      description="Выберите, доступен агент везде или только в отдельных каналах."
                    >
                      <fieldset class="flex flex-col gap-2">
                        <legend class="sr-only">Каналы</legend>
                        <ChoiceRow
                          name="agent-channel-mode"
                          value="all"
                          checked={channelMode() === 'all'}
                          title="Все каналы"
                          description="Агента можно упомянуть в любом канале, как @rox."
                          onChange={() => setChannelMode('all')}
                        />
                        <ChoiceRow
                          name="agent-channel-mode"
                          value="selected"
                          checked={channelMode() === 'selected'}
                          title="Конкретные каналы"
                          description="Этим агентом могут пользоваться только участники выбранных каналов."
                          onChange={() => setChannelMode('selected')}
                        />
                      </fieldset>

                      <Show when={channelMode() === 'selected'}>
                        <div class="mt-3 border-t border-edge-muted pt-3">
                          <ChannelMultiSelect
                            channelIds={selectedChannelIds()}
                            onChange={setSelectedChannelIds}
                          />
                        </div>
                      </Show>
                    </AdvancedGroup>
                  </div>
                </Show>
              </AgentFormSection>
            </form>
            <div class="mt-6 flex flex-wrap items-center gap-2 border-t border-edge-muted pt-4">
              <Show when={props.onDelete}>
                {(onDelete) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="text-negative"
                    disabled={busy()}
                    onClick={onDelete()}
                  >
                    <TrashIcon class="size-3 touch:size-6 shrink-0 pointer-events-none" />{' '}
                    Удалить агента
                  </Button>
                )}
              </Show>
              <div class="ml-auto flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={close}
                  disabled={busy()}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  form="agent-form"
                  variant="secondary"
                  size="sm"
                  disabled={!canCreate()}
                >
                  {props.pending
                    ? props.agent
                      ? 'Сохранение…'
                      : 'Создание…'
                    : props.agent
                      ? 'Сохранить изменения'
                      : 'Создать агента'}
                </Button>
              </div>
            </div>
          </section>
        </SettingsPage>
      </Match>
    </Switch>
  );
}

function AgentFormSection(props: {
  title: string;
  description: string;
  actions?: JSX.Element;
  expanded?: boolean;
  children: JSX.Element;
}) {
  return (
    <SettingsSection
      title={props.title}
      description={props.description}
      actions={props.actions}
      expanded={props.expanded}
    >
      <div class="pt-2">{props.children}</div>
    </SettingsSection>
  );
}

/** A titled group inside the Advanced section, split by a hairline. */
function AdvancedGroup(props: {
  title: string;
  description: string;
  children: JSX.Element;
}) {
  return (
    <section class="mt-4 border-t border-ink/[0.06] pt-4">
      <h3 class="text-xs font-medium text-ink">{props.title}</h3>
      <p class="mt-0.5 text-xs text-ink-muted">{props.description}</p>
      <div class="mt-2">{props.children}</div>
    </section>
  );
}

function ruCount(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;
  return `${count} ${word}`;
}

function ruSelectedChannels(count: number): string {
  const counted = ruCount(count, 'канал', 'канала', 'каналов');
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `Выбран ${counted}`;
  return `Выбрано ${counted}`;
}

function slugAgentTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
