/**
 * @vitest-environment jsdom
 */

import { setInterfaceLanguage } from '@app/lib/i18n';
import { Model } from '@core/component/AI/constant/model';
import { displayName } from '@core/constant/brand';
import { useAgentModelsQueries } from '@queries/agents/models';
import { useRunnableHarnessesQuery } from '@queries/harnesses/harnesses';
import type { LoadAgentModelsResponse } from '@service-agent-harness/generated/schemas';
import type { Harness } from '@service-storage/client';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/solid-query';
import { Suspense } from 'solid-js';
import { createStore } from 'solid-js/store';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agents } from './Agents';
import {
  agentSettingsRequest,
  requestAgentDetail,
  requestCreateAgent,
} from './agentSettingsState';
import {
  chooseModelOption,
  chooseSelectOption,
  modelOptions,
  selectOptions,
} from './tests/select-helpers';

const agentsPageProps = {
  onCursor: vi.fn(),
  onSetUpRuntime: vi.fn(),
  onManageRuntimes: vi.fn(),
};

// The real Lexical surface has its own Markdown round-trip suite.
vi.mock('./computers/views/agent-computer-entry', () => ({
  RunOnComputerRow: () => null,
  ComputerWhereItRuns: (props: { harnessId: string; checked: boolean }) => (
    <div
      data-testid="computer-where-it-runs"
      data-harness-id={props.harnessId}
      data-checked={String(props.checked)}
    />
  ),
}));

vi.mock('./components/instructions-editor', () => ({
  AgentInstructionsEditor: (props: {
    markdown: string;
    disabled?: boolean;
    onChange: (markdown: string) => void;
  }) => (
    <textarea
      aria-label="Instructions"
      disabled={props.disabled}
      value={props.markdown}
      onInput={(event) => props.onChange(event.currentTarget.value)}
    />
  ),
}));

// Covered by its own suite; it owns a live query.
vi.mock('./components/coding-preferences-setting', () => ({
  CodingPreferencesSetting: () => null,
}));
vi.mock('./components/auto-archive-setting', () => ({
  AutoArchiveSetting: () => null,
}));

const [searchParams, updateSearchParams] = createStore<{
  createAgent?: string;
}>({});
const setSearchParams = vi.fn((next: { createAgent?: string }) =>
  updateSearchParams(next)
);

vi.mock('@solidjs/router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@solidjs/router')>()),
  useSearchParams: () => [searchParams, setSearchParams],
}));

const cursorMocks = vi.hoisted(() => ({
  status: {
    isSuccess: true,
    isError: false,
    data: {
      registered: false,
      updatedAt: null as string | null,
    },
  },
}));

const agentMocks = vi.hoisted(() => ({
  query: {
    isSuccess: true,
    isPending: false,
    data: [] as unknown[],
    isError: false,
  },
  create: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
  toastSuccess: vi.fn(),
  toastFailure: vi.fn(),
  currentUserId: 'macro|user@example.com',
  currentTeam: { team: { id: 'team-1' } } as { team: { id: string } } | null,
  isTeamOwner: false,
  isTeamAdmin: false,
}));

const avatarMocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@queries/agents/avatar', () => ({
  useUploadAgentAvatarMutation: () => ({ mutateAsync: avatarMocks.upload }),
}));

const apiKeyMocks = vi.hoisted(() => ({
  query: {
    isSuccess: true,
    data: undefined as
      | {
          key?: { provider: string; updatedAt: string } | null;
          planAllows: boolean;
        }
      | undefined,
  },
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@queries/agents/agent-api-key', () => ({
  useAgentApiKeyQuery: () => apiKeyMocks.query,
  saveAgentApiKey: apiKeyMocks.save,
  removeAgentApiKey: apiKeyMocks.remove,
}));

vi.mock('@queries/auth/cursor-api-key', () => ({
  useCursorApiKeyStatusQuery: () => cursorMocks.status,
}));

const modelMocks = vi.hoisted(() => ({
  queries: {} as Record<
    string,
    {
      data?: {
        status: 'available' | 'unsupported';
        currentModel?: string | null;
        models: { id: string; name: string; description?: string | null }[];
      };
      isPending: boolean;
      isError: boolean;
      isSuccess: boolean;
      refetch: ReturnType<typeof vi.fn>;
    }
  >,
}));

function modelTargetKey(target: {
  harness: string;
  harnessId?: string;
}): string {
  return `${target.harness}:${target.harnessId ?? ''}`;
}

function successfulModels(
  models: { id: string; name: string; description?: string }[],
  currentModel = models[0]?.id
) {
  return {
    data: {
      status: 'available' as const,
      currentModel,
      models,
    },
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}

vi.mock('@queries/agents/models', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@queries/agents/models')>();
  return {
    ...actual,
    useAgentModelsQueries: vi.fn(
      (targets: () => { harness: string; harnessId?: string }[]) =>
        targets().map(
          (target) =>
            modelMocks.queries[modelTargetKey(target)] ?? {
              isPending: true,
              isError: false,
              isSuccess: false,
              refetch: vi.fn(),
            }
        )
    ),
  };
});

const harnessMocks = vi.hoisted(() => ({
  query: {
    isSuccess: true,
    isPending: false,
    data: [] as unknown[],
  },
}));

vi.mock('@queries/harnesses/harnesses', () => ({
  useRunnableHarnessesQuery: vi.fn(() => harnessMocks.query),
}));

vi.mock('@queries/agents/agents', () => ({
  useAgentsQuery: () => agentMocks.query,
  useCreateAgentMutation: () => ({
    mutateAsync: agentMocks.create,
    isPending: false,
  }),
  useDeleteAgentMutation: () => ({
    mutateAsync: agentMocks.delete,
    isPending: false,
  }),
  useUpdateAgentMutation: () => ({
    mutateAsync: agentMocks.update,
    isPending: false,
  }),
}));

vi.mock('@queries/team/teams', () => ({
  useCurrentTeamQuery: () => ({
    data: agentMocks.currentTeam,
    isSuccess: true,
  }),
  useIsTeamOwner: () => () => agentMocks.isTeamOwner,
  useIsTeamAdmin: () => () => agentMocks.isTeamAdmin,
}));

vi.mock('@core/context/user', () => ({
  useUserId: () => () => agentMocks.currentUserId,
}));

vi.mock('@core/component/Toast/Toast', () => ({
  toast: {
    success: agentMocks.toastSuccess,
    failure: agentMocks.toastFailure,
  },
}));

vi.mock('@core/context/channels', () => ({
  useChannelsContext: () => ({
    channels: () => [
      { id: 'channel-general', name: 'general', channel_type: 'private' },
      {
        id: 'channel-engineering',
        name: 'engineering',
        channel_type: 'team',
      },
    ],
  }),
}));

const pipedreamMocks = vi.hoisted(() => ({
  connected: [] as string[],
  connect: vi.fn(),
  catalog: [
    {
      app_slug: 'linear',
      display_name: 'Linear',
      description: 'Issue tracking',
      icon_url: null,
    },
    {
      app_slug: 'notion',
      display_name: 'Notion',
      description: 'Docs and wikis',
      icon_url: null,
    },
  ],
}));

vi.mock('@queries/pipedream-connectors', () => ({
  usePipedreamConnectedSlugs: () => ({
    slugs: () => new Set(pipedreamMocks.connected),
    ready: () => true,
  }),
  usePipedreamCatalogIconsQuery: () => ({
    isPending: false,
    data: new Map(),
  }),
  usePipedreamCatalogQuery: (search: () => string) => ({
    get data() {
      const term = search().trim().toLowerCase();
      return {
        pages: [
          {
            servers: pipedreamMocks.catalog.filter((entry) =>
              entry.display_name.toLowerCase().includes(term)
            ),
            next_cursor: null,
          },
        ],
        pageParams: [undefined],
      };
    },
    isFetching: false,
    isSuccess: true,
    isFetchingNextPage: false,
    hasNextPage: false,
    isError: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  connectPipedreamApp: pipedreamMocks.connect,
}));

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn());
  // The settings pages render Russian; pin it so the browser's language
  // cannot decide what these assertions see.
  setInterfaceLanguage('ru');
});

beforeEach(() => {
  avatarMocks.upload.mockReset();
  apiKeyMocks.query.data = undefined;
  apiKeyMocks.save.mockReset();
  apiKeyMocks.remove.mockReset();
  avatarMocks.upload.mockResolvedValue('https://static.example/avatar.png');
  updateSearchParams({ createAgent: undefined });
  setSearchParams.mockClear();
  cursorMocks.status.data = {
    registered: false,
    updatedAt: null,
  };
  agentMocks.query.data = [];
  agentMocks.query.isError = false;
  agentMocks.create.mockResolvedValue({ bot: { id: 'created-agent' } });
  agentMocks.delete.mockResolvedValue(undefined);
  agentMocks.update.mockResolvedValue(undefined);
  agentMocks.currentUserId = 'macro|user@example.com';
  agentMocks.currentTeam = { team: { id: 'team-1' } };
  agentMocks.isTeamOwner = false;
  agentMocks.isTeamAdmin = false;
  harnessMocks.query.data = [];
  pipedreamMocks.connected = [];
  pipedreamMocks.connect.mockReset();
  pipedreamMocks.connect.mockImplementation(
    async (args: { appSlug: string }) => {
      pipedreamMocks.connected = [...pipedreamMocks.connected, args.appSlug];
      return 'connected';
    }
  );
  modelMocks.queries = {
    'in-memory:': successfulModels([
      { id: Model.sonnet55, name: 'Claude Sonnet 4.5' },
      { id: Model.opus55, name: 'Claude Opus 4.5' },
    ]),
  };
});

const ROXD_HARNESS = {
  allow_permission_bypass: false,
  id: '3f1c9d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f',
  kind: 'roxd',
  name: 'Dev box',
  owner: { type: 'user', user_id: 'macro|user@example.com' },
  created_by: 'macro|user@example.com',
  created_at: '2026-08-27T12:00:00Z',
  updated_at: '2026-08-27T12:00:00Z',
  connected: true,
  last_connected_at: '2026-08-27T12:34:00Z',
  access: 'owner',
  shared_team_ids: [],
} satisfies Harness;

const MACROD_HARNESS = {
  ...ROXD_HARNESS,
  id: '7c2e4f6a-1b3d-4e5f-8a9b-0c1d2e3f4a5b',
  kind: 'macrod',
} satisfies Harness;

describe('Agents', () => {
  it('opens the new-agent form from a link and clears the action on cancel', () => {
    updateSearchParams({ createAgent: 'true' });
    render(() => <Agents {...agentsPageProps} />);
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(setSearchParams).toHaveBeenCalledWith(
      { createAgent: undefined },
      { replace: true }
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['success', 'error'] as const)(
    'keeps settings visible while Cursor models load and after %s',
    async (outcome) => {
      cursorMocks.status.data.registered = true;
      let resolveModels!: (models: LoadAgentModelsResponse) => void;
      let rejectModels!: (error: Error) => void;
      const response = new Promise<LoadAgentModelsResponse>(
        (resolve, reject) => {
          resolveModels = resolve;
          rejectModels = reject;
        }
      );
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      // The agent list asks first, for no runtimes: no agent is on `default`.
      vi.mocked(useAgentModelsQueries).mockImplementationOnce(() => []);
      vi.mocked(useAgentModelsQueries).mockImplementationOnce((targets) =>
        targets().map((target) =>
          useQuery(() => ({
            queryKey: ['pending-models', target.harness],
            queryFn: () =>
              target.harness === 'cursor'
                ? response
                : Promise.resolve(successfulModels([]).data),
          }))
        )
      );
      const view = render(() => (
        <QueryClientProvider client={client}>
          <Suspense fallback={<p>Settings suspended</p>}>
            <Agents {...agentsPageProps} />
          </Suspense>
        </QueryClientProvider>
      ));
      fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
      fireEvent.click(screen.getByRole('radio', { name: 'В Cursor' }));
      expect(screen.queryByText('Settings suspended')).toBeNull();
      expect(screen.getByText('Загрузка моделей…')).toBeTruthy();
      expect(
        (screen.getByLabelText('Модель по умолчанию') as HTMLButtonElement).disabled
      ).toBe(true);

      if (outcome === 'error') {
        rejectModels(new Error('Cursor is unavailable'));
        await waitFor(() =>
          expect(
            screen.getByText(/Не удалось загрузить модели для Cursor/)
          ).toBeTruthy()
        );
        expect(screen.queryByText('Settings suspended')).toBeNull();
        expect(
          screen.getByRole('button', { name: 'Повторить загрузку моделей для Cursor' })
        ).toBeTruthy();
      } else {
        resolveModels({
          status: 'available',
          currentModel: 'loaded-model',
          models: [
            {
              id: 'loaded-model',
              name: 'Loaded Model',
              group: 'Cursor',
            },
          ],
        });
        await waitFor(() =>
          expect(screen.getByText('Loaded Model')).toBeTruthy()
        );
        expect(screen.queryByText('Settings suspended')).toBeNull();
        expect(
          (screen.getByLabelText('Модель по умолчанию') as HTMLButtonElement).disabled
        ).toBe(false);
      }
      view.unmount();
      client.clear();
    }
  );

  it('lists the built-in global Rox agent as a team agent', () => {
    render(() => <Agents {...agentsPageProps} />);

    const list = screen.getByRole('region', { name: 'Ваши агенты' });

    expect(within(list).getByText(displayName)).toBeTruthy();
    expect(
      within(list)
        .getAllByText(/^@/)
        .map((tag) => tag.textContent)
    ).toEqual(['@rox']);
    expect(within(list).getByText('Команда')).toBeTruthy();
    expect(
      within(list).getByText(`В ${displayName} · Rox R1 Max · Все каналы`)
    ).toBeTruthy();
    expect(
      within(list).queryByRole('button', { name: `Delete ${displayName}` })
    ).toBeNull();
    expect(
      within(list).queryByRole('button', { name: `Edit ${displayName}` })
    ).toBeNull();
  });

  it('shows loading and error states in the agent list', () => {
    agentMocks.query.isPending = true;
    agentMocks.query.isSuccess = false;
    try {
      const view = render(() => <Agents {...agentsPageProps} />);
      expect(
        within(screen.getByRole('region', { name: 'Ваши агенты' })).getByText(
          'Загрузка агентов…'
        )
      ).toBeTruthy();
      view.unmount();

      agentMocks.query.isPending = false;
      agentMocks.query.isError = true;
      render(() => <Agents {...agentsPageProps} />);
      expect(
        within(screen.getByRole('region', { name: 'Ваши агенты' })).getByText(
          'Не удалось загрузить агентов. Обновите страницу.'
        )
      ).toBeTruthy();
    } finally {
      agentMocks.query.isPending = false;
      agentMocks.query.isSuccess = true;
    }
  });

  it('offers Cursor and own-agent setup above the list', () => {
    const onCursor = vi.fn();
    const onSetUpRuntime = vi.fn();
    const onManageRuntimes = vi.fn();
    const view = render(() => (
      <Agents
        onCursor={onCursor}
        onSetUpRuntime={onSetUpRuntime}
        onManageRuntimes={onManageRuntimes}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Подключить Cursor' }));
    expect(onCursor).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole('button', { name: 'Настроить своего агента' })
    );
    expect(onSetUpRuntime).toHaveBeenCalledOnce();
    view.unmount();

    cursorMocks.status.data.registered = true;
    harnessMocks.query.data = [ROXD_HARNESS];
    render(() => (
      <Agents
        onCursor={onCursor}
        onSetUpRuntime={onSetUpRuntime}
        onManageRuntimes={onManageRuntimes}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Управлять Cursor' }));
    expect(onCursor).toHaveBeenCalledTimes(2);
    fireEvent.click(
      screen.getByRole('button', { name: 'Управлять машинами' })
    );
    expect(onManageRuntimes).toHaveBeenCalledOnce();
  });

  it('describes the Cursor and own-agent cards in Russian', () => {
    render(() => <Agents {...agentsPageProps} />);

    expect(screen.getByText('Подключить Cursor')).toBeTruthy();
    expect(
      screen.getByText('Запускайте агентов в Rox на своей подписке Cursor.')
    ).toBeTruthy();
    expect(screen.getByText('Свой агент')).toBeTruthy();
    expect(
      screen.getByText(
        'Подключите Claude Code, Codex или другого локального агента через roxd.'
      )
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Настроить своего агента' })
    ).toBeTruthy();
  });

  it('groups server agents into team and private sections', () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          description: 'Finds and fixes bugs.',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'all',
        channel_ids: [],
      },
      {
        bot: {
          id: 'agent-2',
          kind: 'owned',
          owner: { type: 'team', team_id: 'team-1' },
          name: 'Release helper',
          handle: 'release-helper',
          description: 'Coordinates releases.',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Keep releases moving.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'selected',
        channel_ids: ['channel-engineering'],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);

    const list = screen.getByRole('region', { name: 'Ваши агенты' });

    // Rox first, then team agents, then private agents.
    expect(
      within(list)
        .getAllByText(/^@/)
        .map((tag) => tag.textContent)
    ).toEqual(['@rox', '@release-helper', '@bug-fixer']);
    expect(within(list).queryByText('Coordinates releases.')).toBeNull();
    expect(within(list).queryByText('Finds and fixes bugs.')).toBeNull();

    const releaseRow = within(list).getByText('Release helper').parentElement
      ?.parentElement as HTMLElement;
    expect(within(releaseRow).getByText('Команда')).toBeTruthy();
    expect(
      within(releaseRow).getByText(
        `В ${displayName} · Sonnet 5.5 · #engineering`
      )
    ).toBeTruthy();

    const bugFixerRow = within(list).getByText('Bug fixer').parentElement
      ?.parentElement as HTMLElement;
    expect(within(bugFixerRow).getByText('Личный')).toBeTruthy();
    expect(
      within(bugFixerRow).getByText(
        `В ${displayName} · Sonnet 5.5 · Все каналы`
      )
    ).toBeTruthy();
  });

  it('says where each listed agent runs', () => {
    cursorMocks.status.data.registered = true;
    harnessMocks.query.data = [ROXD_HARNESS];
    const owner = { type: 'user', user_id: 'macro|user@example.com' };
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-cursor',
          kind: 'owned',
          owner,
          name: 'Cursor helper',
          handle: 'cursor-helper',
          has_agent: true,
        },
        instructions: '',
        harness: 'cursor',
        default_model: 'cursor-small',
        channel_scope: 'all',
        channel_ids: [],
      },
      {
        bot: {
          id: 'agent-roxd',
          kind: 'owned',
          owner,
          name: 'Harness helper',
          handle: 'harness-helper',
          has_agent: true,
        },
        instructions: '',
        harness: 'roxd',
        harness_id: ROXD_HARNESS.id,
        default_model: 'codex',
        channel_scope: 'all',
        channel_ids: [],
      },
      {
        bot: {
          id: 'agent-gone',
          kind: 'owned',
          owner,
          name: 'Orphaned helper',
          handle: 'orphaned-helper',
          has_agent: true,
        },
        instructions: '',
        harness: 'roxd',
        harness_id: 'removed-harness',
        default_model: 'codex',
        channel_scope: 'all',
        channel_ids: [],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);
    const list = screen.getByRole('region', { name: 'Ваши агенты' });

    expect(
      within(list).getByText('В Cursor · cursor-small · Все каналы')
    ).toBeTruthy();
    expect(
      within(list).getByText('На вашем компьютере · Dev box · codex · Все каналы')
    ).toBeTruthy();
    expect(
      within(list).getByText('Отключённый компьютер · codex · Все каналы')
    ).toBeTruthy();
  });

  it("names the model a machine's default choice runs", () => {
    harnessMocks.query.data = [MACROD_HARNESS];
    modelMocks.queries[`roxd:${MACROD_HARNESS.id}`] = successfulModels([
      { id: 'default', name: 'Default (recommended)', description: 'Opus 4.8' },
      { id: 'sonnet', name: 'Sonnet', description: 'Sonnet 4.6' },
    ]);
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-default',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Default helper',
          handle: 'default-helper',
          has_agent: true,
        },
        instructions: '',
        harness: 'macrod',
        harness_id: MACROD_HARNESS.id,
        default_model: 'default',
        channel_scope: 'all',
        channel_ids: [],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);
    const list = screen.getByRole('region', { name: 'Ваши агенты' });

    expect(
      within(list).getByText(
        'На вашем компьютере · Dev box · Opus 4.8 (default) · Все каналы'
      )
    ).toBeTruthy();
  });

  it('does not list a coworker private agent in Settings', () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-shared',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|coworker@example.com' },
          name: 'Shared Reviewer',
          handle: 'shared-reviewer',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Review pull requests.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'selected',
        channel_ids: ['channel-engineering'],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);

    expect(screen.queryByText('Shared Reviewer')).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Ваши агенты' }))
        .getAllByText(/^@/)
        .map((tag) => tag.textContent)
    ).toEqual(['@rox']);
  });

  it("does not list another team's mentionable agent in Settings", () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-other-team',
          kind: 'owned',
          owner: { type: 'team', team_id: 'team-other' },
          name: 'Other Team Helper',
          handle: 'other-team-helper',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Help the other team.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'selected',
        channel_ids: ['channel-engineering'],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);

    expect(screen.queryByText('Other Team Helper')).toBeNull();
  });

  it('uploads a team agent avatar before saving and retains it when reopened', async () => {
    const originalAvatar = 'https://static.example/original.png';
    const uploadedAvatar = 'https://static.example/avatar.png';
    const existing = {
      bot: {
        id: 'agent-1',
        kind: 'owned',
        owner: { type: 'team', team_id: 'team-1' },
        name: 'Grungus',
        handle: 'grungus',
        has_agent: true,
        avatar_url: originalAvatar,
      },
      instructions: 'Help the team.',
      harness: 'in-memory',
      default_model: Model.sonnet55,
      channel_scope: 'all',
      channel_ids: [],
    };
    agentMocks.query.data = [existing];
    let finishUpload!: (url: string) => void;
    avatarMocks.upload.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finishUpload = resolve;
        })
    );
    agentMocks.update.mockImplementation(
      async (params: { avatarUrl: string }) => {
        existing.bot.avatar_url = params.avatarUrl;
      }
    );
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Grungus' }));
    const form = screen.getByRole('region', { name: 'Изменить агента' });
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(form.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    expect(avatarMocks.upload).toHaveBeenCalledWith(file);
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toHaveProperty(
      'disabled',
      true
    );
    expect(screen.getByRole('button', { name: 'Загрузка…' })).toHaveProperty(
      'disabled',
      true
    );
    expect(
      screen.getByRole('img', { name: 'Аватар: Grungus' }).getAttribute('src')
    ).toBe(originalAvatar);

    finishUpload(uploadedAvatar);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Сохранить изменения' })
      ).toHaveProperty('disabled', false)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    await waitFor(() =>
      expect(agentMocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: uploadedAvatar, teamId: 'team-1' })
      )
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Изменить Grungus' })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Grungus' }));
    expect(
      screen.getByRole('img', { name: 'Аватар: Grungus' }).getAttribute('src')
    ).toBe(uploadedAvatar);
  });

  it('reports avatar upload failures and allows retrying without losing the form', async () => {
    avatarMocks.upload.mockRejectedValueOnce(
      new Error('Failed to upload file')
    );
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
    fireEvent.input(screen.getByLabelText('Имя'), {
      target: { value: 'Grungus' },
    });
    const input = screen
      .getByRole('region', { name: 'Новый агент' })
      .querySelector('input[type="file"]')!;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(agentMocks.toastFailure).toHaveBeenCalledWith(
        'Failed to upload file'
      )
    );
    expect(screen.getByLabelText('Имя')).toHaveProperty('value', 'Grungus');
    expect(screen.getByRole('button', { name: 'Загрузить' })).toHaveProperty(
      'disabled',
      false
    );
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: 'Аватар: Grungus' }).getAttribute('src')
      ).toBe('https://static.example/avatar.png')
    );
  });

  it('edits and persists an existing agent through the agents API', async () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          description: 'Finds and fixes bugs.',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'selected',
        channel_ids: ['channel-engineering'],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Bug fixer' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(screen.getByRole('heading', { name: 'Изменить агента' })).toBeTruthy();
    expect(within(dialog).getByLabelText('Имя')).toHaveProperty(
      'value',
      'Bug fixer'
    );
    expect(within(dialog).getByLabelText('Тег')).toHaveProperty(
      'value',
      'bug-fixer'
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
    expect(within(dialog).getByLabelText('Конкретные каналы')).toHaveProperty(
      'checked',
      true
    );

    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Bug resolver' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Сохранить изменения' })
    );

    await waitFor(() => {
      expect(agentMocks.update).toHaveBeenCalledWith({
        agentId: 'agent-1',
        autoAcceptPermissions: true,
        isCoding: false,
        avatarUrl: undefined,
        channelIds: ['channel-engineering'],
        channelScope: 'selected',
        defaultModel: Model.sonnet55,
        description: 'Finds and fixes bugs.',
        handle: 'bug-fixer',
        harness: 'in-memory',
        name: 'Bug resolver',
        instructions: 'Fix the root cause.',
        mcp: { scope: 'owner_connections' },
        teamId: undefined,
      });
      expect(agentMocks.toastSuccess).toHaveBeenCalledWith('Агент обновлён');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it("opens an agent's editor when asked to from its user card", () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'all',
        channel_ids: [],
      },
    ];
    requestAgentDetail('agent-1');

    render(() => <Agents {...agentsPageProps} />);

    expect(screen.getByRole('heading', { name: 'Изменить агента' })).toBeTruthy();
    expect(agentSettingsRequest()).toBeUndefined();
  });

  it('lets team members edit without deleting or privatizing another creator agent', () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'team', team_id: 'team-1' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          description: 'Finds and fixes bugs.',
          created_by: 'macro|creator@example.com',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'all',
        channel_ids: [],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);

    expect(screen.getByRole('button', { name: 'Изменить Bug fixer' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Удалить Bug fixer' })
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Изменить Bug fixer' }));
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(within(dialog).getByLabelText('Команда')).toHaveProperty(
      'checked',
      true
    );
    expect(within(dialog).getByLabelText('Личный')).toHaveProperty(
      'disabled',
      true
    );
    expect(
      within(dialog).getByText('Сделать его личным может только создатель агента.')
    ).toBeTruthy();
    expect(
      within(dialog).queryByRole('button', { name: 'Удалить агента' })
    ).toBeNull();
  });

  it('lets the creator privatize and admins delete a team agent from its editor', async () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'team', team_id: 'team-1' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          description: 'Finds and fixes bugs.',
          created_by: 'macro|user@example.com',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'all',
        channel_ids: [],
      },
    ];

    const view = render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Bug fixer' }));
    expect(
      within(
        screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ })
      ).getByLabelText('Личный')
    ).toHaveProperty('disabled', false);
    view.unmount();

    agentMocks.currentUserId = 'macro|team-owner@example.com';
    agentMocks.isTeamOwner = true;
    const ownerView = render(() => <Agents {...agentsPageProps} />);
    expect(
      screen.getByRole('button', { name: 'Удалить Bug fixer' })
    ).toBeTruthy();
    ownerView.unmount();

    agentMocks.isTeamOwner = false;
    agentMocks.isTeamAdmin = true;
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Bug fixer' }));
    const editor = screen.getByRole('region', { name: 'Изменить агента' });
    fireEvent.click(
      within(editor).getByRole('button', { name: 'Удалить агента' })
    );
    expect(agentMocks.delete).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Отмена',
      })
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: 'Изменить агента' })).toBeTruthy();

    fireEvent.click(
      within(editor).getByRole('button', { name: 'Удалить агента' })
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Удалить агента',
      })
    );
    await waitFor(() => {
      expect(agentMocks.delete).toHaveBeenCalledWith({
        agentId: 'agent-1',
        channelIds: [],
      });
      expect(screen.queryByRole('region', { name: 'Изменить агента' })).toBeNull();
    });
  });

  it('confirms before deleting a created agent', async () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          description: 'Finds and fixes bugs.',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'selected',
        channel_ids: ['channel-engineering'],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить Bug fixer' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Удалить Bug fixer?')).toBeTruthy();
    expect(agentMocks.delete).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Удалить агента' })
    );

    await waitFor(() => {
      expect(agentMocks.delete).toHaveBeenCalledWith({
        agentId: 'agent-1',
        channelIds: ['channel-engineering'],
      });
      expect(agentMocks.toastSuccess).toHaveBeenCalledWith('Агент удалён');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('offers agent configuration without description and only connected harnesses', () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(
      screen.getByText('Назовите его, объясните, что делать, и выберите, где он работает.')
    ).toBeTruthy();

    expect(
      within(dialog).getByRole('button', { name: 'Загрузить аватар' })
    ).toBeTruthy();
    const avatarInput = dialog.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(avatarInput, {
      target: {
        files: [
          new File(['avatar'], 'agent-avatar.png', { type: 'image/png' }),
        ],
      },
    });
    expect(within(dialog).queryByText('agent-avatar.png')).toBeNull();
    expect(
      within(dialog).getByText('Необязательно · лучше квадратные изображения')
    ).toBeTruthy();
    expect(within(dialog).getByLabelText('Имя')).toBeTruthy();
    expect(within(dialog).getByLabelText('Тег')).toBeTruthy();
    expect(within(dialog).queryByLabelText('Описание')).toBeNull();
    expect(within(dialog).getByLabelText('Instructions')).toBeTruthy();
    expect(
      within(dialog).getByRole('radio', { name: `В ${displayName}` })
    ).toHaveProperty('checked', true);
    expect(
      within(dialog).getByRole('radio', { name: 'В Cursor' })
    ).toHaveProperty('disabled', true);
    expect(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    ).toHaveProperty('disabled', true);
    expect(within(dialog).queryByLabelText('Компьютер')).toBeNull();
    expect(within(dialog).getAllByLabelText('Модель по умолчанию')).toHaveLength(1);
    expect(within(dialog).getByText('Кто может пользоваться')).toBeTruthy();
    expect(within(dialog).getByRole('group', { name: 'Доступ' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
    expect(
      within(dialog).getByRole('group', { name: 'Каналы' })
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByLabelText('Конкретные каналы'));
    const channelSearch =
      within(dialog).getByPlaceholderText('Search channels…');
    fireEvent.input(channelSearch, { target: { value: 'gen' } });
    expect(screen.getByRole('option', { name: 'general' })).toBeTruthy();
  });

  it('offers Connect Cursor instead of an unconnected Cursor option', () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: 'Новый агент' });
    const cursor = within(dialog).getByRole('radio', { name: 'В Cursor' });
    expect(cursor).toHaveProperty('disabled', true);
    expect(
      within(dialog).getByRole('button', { name: 'Подключить Cursor' })
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('radio', { name: `В ${displayName}` })
    ).toHaveProperty('checked', true);
  });

  it('offers harness setup instead of an unpaired harness option', () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: 'Новый агент' });
    const ownHarness = within(dialog).getByRole('radio', {
      name: 'На вашем компьютере',
    });
    expect(ownHarness).toHaveProperty('disabled', true);
    expect(
      within(dialog).getByRole('button', { name: 'Настроить свой компьютер' })
    ).toBeTruthy();
    expect(within(dialog).queryByLabelText('Компьютер')).toBeNull();
  });

  it('keeps mention, permission, and channel choices collapsed under advanced settings', () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: 'Новый агент' });
    const toggle = within(dialog).getByRole('button', { name: 'Показать' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      within(dialog).getByText(
        'Чат-агент · Все каналы · Ваши подключённые приложения'
      )
    ).toBeTruthy();
    expect(within(dialog).queryByLabelText('Чат-агент')).toBeNull();
    expect(
      within(dialog).queryByRole('group', { name: 'Каналы' })
    ).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Скрыть');
    expect(
      within(dialog).getByRole('group', { name: 'Ответ на упоминание' })
    ).toBeTruthy();
    expect(within(dialog).getByLabelText('Чат-агент')).toHaveProperty(
      'checked',
      true
    );
    expect(
      within(dialog).getByRole('group', { name: 'Каналы' })
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByLabelText('Конкретные каналы'));
    expect(
      within(dialog).getByText('Чат-агент · 0 каналов · Ваши подключённые приложения')
    ).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(dialog).queryByLabelText('Чат-агент')).toBeNull();
  });

  it('explains why team sharing is disabled without a team', () => {
    agentMocks.currentTeam = null;

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    const teamOption = within(dialog).getByLabelText('Команда');
    expect(teamOption).toHaveProperty('disabled', true);
    expect(
      teamOption.closest('label')?.classList.contains('cursor-not-allowed')
    ).toBe(true);
    // The choice's text and radio dim; trailing actions stay legible.
    expect(teamOption.classList.contains('opacity-50')).toBe(true);
    expect(
      within(dialog).getByText(
        'Для командных агентов нужен владелец команды. Создайте команду или вступите в неё в настройках команды, чтобы включить этот вариант.'
      )
    ).toBeTruthy();
  });

  it('persists creation through the agents API', async () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Bug fixer' },
    });
    fireEvent.input(within(dialog).getByLabelText('Instructions'), {
      target: { value: 'Fix the **root cause** and add tests.' },
    });
    fireEvent.click(within(dialog).getByLabelText('Команда'));
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );

    await waitFor(() => {
      expect(agentMocks.create).toHaveBeenCalledWith({
        autoAcceptPermissions: true,
        avatarUrl: undefined,
        isCoding: false,
        channelIds: [],
        channelScope: 'all',
        defaultModel: Model.sonnet55,
        handle: 'bug-fixer',
        harness: 'in-memory',
        name: 'Bug fixer',
        instructions: 'Fix the **root cause** and add tests.',
        mcp: { scope: 'owner_connections' },
        teamId: 'team-1',
      });
      expect(agentMocks.toastSuccess).toHaveBeenCalledWith('Агент создан');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it("saves a new agent's API key after the agent, for its model's provider", async () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Bug fixer' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить ключ' }));
    fireEvent.input(within(dialog).getByLabelText('Ключ API Anthropic'), {
      target: { value: 'sk-ant-api03-abc' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );

    await waitFor(() => {
      expect(apiKeyMocks.save).toHaveBeenCalledWith(
        'created-agent',
        'sk-ant-api03-abc'
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('offers an optional API key without asking for one', async () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(within(dialog).queryByLabelText('Ключ API Anthropic')).toBeNull();
    expect(
      within(dialog).getByText(
        `Работает за счёт использования ${displayName}, пока вы не добавите свой.`
      )
    ).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить ключ' }));
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Отменить ключ API' })
    );
    expect(within(dialog).queryByLabelText('Ключ API Anthropic')).toBeNull();

    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Bug fixer' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(apiKeyMocks.save).not.toHaveBeenCalled();
    expect(apiKeyMocks.remove).not.toHaveBeenCalled();
  });

  it("removes an agent's saved API key, and locks the field on a free plan", async () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'all',
        channel_ids: [],
      },
    ];
    apiKeyMocks.query.data = {
      key: { provider: 'anthropic', updatedAt: '2026-10-20T12:00:00Z' },
      planAllows: true,
    };

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Bug fixer' }));
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    const field = within(dialog).getByLabelText(
      'Ключ API Anthropic'
    ) as HTMLInputElement;
    expect(field.placeholder).toBe('sk-ant-••••••••••••');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Убрать' }));
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Сохранить изменения' })
    );
    await waitFor(() => {
      expect(apiKeyMocks.remove).toHaveBeenCalledWith('agent-1');
    });
  });

  it('locks the API key field when the plan does not include agent keys', () => {
    apiKeyMocks.query.data = { key: null, planAllows: false };
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: Model.sonnet55,
        channel_scope: 'all',
        channel_ids: [],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Bug fixer' }));
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });

    expect(within(dialog).queryByLabelText('Ключ API Anthropic')).toBeNull();
    expect(
      within(dialog).queryByRole('button', { name: 'Добавить ключ' })
    ).toBeNull();
    expect(
      within(dialog).getByText(
        'Ключи API агента входят в тарифы Premium и Max.'
      )
    ).toBeTruthy();
  });

  it('offers Cursor and saves the model chosen from its dropdown', async () => {
    cursorMocks.status.data = {
      registered: true,
      updatedAt: '2026-08-27T12:00:00Z',
    };
    modelMocks.queries['cursor:'] = successfulModels([
      { id: 'cursor-small', name: 'Cursor Small' },
      { id: 'cursor-large', name: 'Cursor Large' },
    ]);

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    const cursor = within(dialog).getByRole('radio', { name: 'В Cursor' });
    expect(cursor).toHaveProperty('disabled', false);
    expect(
      within(dialog).queryByRole('button', { name: 'Подключить Cursor' })
    ).toBeNull();
    expect(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    ).toHaveProperty('disabled', true);

    fireEvent.click(cursor);
    expect(cursor).toHaveProperty('checked', true);

    const defaultModel = within(dialog).getByLabelText('Модель по умолчанию');
    expect(modelOptions(defaultModel).getAllByRole('menuitem')).toHaveLength(2);
    expect(defaultModel.textContent).toBe('Cursor Small');
    chooseModelOption(defaultModel, 'Cursor Large');
    expect(defaultModel.textContent).toBe('Cursor Large');
    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Coding agent' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );
    await waitFor(() =>
      expect(agentMocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          harness: 'cursor',
          defaultModel: 'cursor-large',
        })
      )
    );
  });

  it('opens the create form on a requested Rox computer', () => {
    const computer = {
      ...ROXD_HARNESS,
      id: 'computer-harness',
      name: 'Agent Box',
      computer_id: 'computer-1',
    };
    harnessMocks.query.data = [ROXD_HARNESS, computer];
    requestCreateAgent('computer-harness');

    render(() => <Agents {...agentsPageProps} />);

    const dialog = screen.getByRole('region', { name: 'Новый агент' });
    const where = within(dialog).getByTestId('computer-where-it-runs');
    expect(where.dataset.harnessId).toBe('computer-harness');
    expect(where.dataset.checked).toBe('true');
    expect(
      within(dialog).getByRole('radio', { name: `В ${displayName}` })
    ).toHaveProperty('checked', false);
    expect(agentSettingsRequest()).toBeUndefined();
  });

  it('offers registered roxd harnesses in the harness picker', () => {
    harnessMocks.query.data = [ROXD_HARNESS];

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(
      within(dialog).getByRole('radio', { name: `В ${displayName}` })
    ).toHaveProperty('checked', true);
    expect(
      within(dialog).getByRole('radio', { name: 'В Cursor' })
    ).toHaveProperty('disabled', true);
    const ownHarness = within(dialog).getByRole('radio', {
      name: 'На вашем компьютере',
    });
    expect(ownHarness).toHaveProperty('disabled', false);
    expect(
      within(dialog).queryByRole('button', { name: 'Настроить свой компьютер' })
    ).toBeNull();

    fireEvent.click(ownHarness);
    const harness = within(dialog).getByLabelText('Компьютер');
    expect(harness).toHaveProperty('textContent', 'Dev box');
    expect(selectOptions(harness).getAllByRole('option')).toHaveLength(1);
    expect(
      selectOptions(harness).getByRole('option', { name: 'Dev box' })
    ).toBeTruthy();
  });

  it('preserves the selected harness and submission when the harness list refetches', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const queryKey = ['refreshed-harnesses'];
    const fetchHarnesses = vi.fn(
      async (): Promise<Harness[]> => [{ ...ROXD_HARNESS }]
    );
    vi.mocked(useRunnableHarnessesQuery).mockImplementationOnce(() =>
      useQuery(() => ({
        queryKey,
        queryFn: fetchHarnesses,
        initialData: [ROXD_HARNESS],
      }))
    );
    modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels([
      { id: 'codex-model', name: 'Codex model' },
    ]);
    const view = render(() => (
      <QueryClientProvider client={client}>
        <Suspense>
          <Agents {...agentsPageProps} />
        </Suspense>
      </QueryClientProvider>
    ));
    await waitFor(() => expect(fetchHarnesses).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    );
    const harness = within(dialog).getByLabelText('Компьютер');
    expect(
      selectOptions(harness).getByRole('option', { name: 'Dev box' })
    ).toBeTruthy();
    chooseSelectOption(harness, 'Dev box');
    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Coding agent' },
    });

    for (let refresh = 0; refresh < 2; refresh++) {
      await client.refetchQueries({ queryKey });
      expect(harness).toHaveProperty('textContent', 'Dev box');
      expect(within(dialog).getByLabelText('Модель по умолчанию')).toHaveProperty(
        'textContent',
        'Codex model'
      );
    }
    expect(fetchHarnesses).toHaveBeenCalledTimes(3);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );
    await waitFor(() =>
      expect(agentMocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          harness: 'roxd',
          harnessId: ROXD_HARNESS.id,
          defaultModel: 'codex-model',
        })
      )
    );
    view.unmount();
    client.clear();
  });

  it('keeps loading, error, and unsupported states independent per harness', () => {
    cursorMocks.status.data = {
      registered: true,
      updatedAt: '2026-08-27T12:00:00Z',
    };
    const loadingHarness = {
      ...ROXD_HARNESS,
      id: '4f1c9d2e-8a4b-4c5d-9e6f-1a2b3c4d5e70',
      name: 'Loading box',
    };
    harnessMocks.query.data = [ROXD_HARNESS, loadingHarness];
    const retry = vi.fn();
    modelMocks.queries['cursor:'] = {
      isPending: false,
      isError: true,
      isSuccess: false,
      refetch: retry,
    };
    modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = {
      data: { status: 'unsupported', models: [] },
      isPending: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    };
    modelMocks.queries[`roxd:${loadingHarness.id}`] = {
      isPending: true,
      isError: false,
      isSuccess: false,
      refetch: vi.fn(),
    };

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(within(dialog).getByText('Sonnet 5.5')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('radio', { name: 'В Cursor' }));
    expect(
      within(dialog).getByText(/Не удалось загрузить модели для Cursor/)
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Повторить загрузку моделей для Cursor' })
    );
    expect(retry).toHaveBeenCalledOnce();

    // The first paired harness is picked when the option is chosen.
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    );
    const harness = within(dialog).getByLabelText('Компьютер');
    expect(harness).toHaveProperty('textContent', 'Dev box');
    expect(
      within(dialog).getByText(
        'Этот компьютер не поддерживает выбор модели.'
      )
    ).toBeTruthy();

    chooseSelectOption(harness, 'Loading box');
    expect(within(dialog).getByText('Загрузка моделей…')).toBeTruthy();
  });

  it('uses the discovered model selector for roxd harnesses', () => {
    harnessMocks.query.data = [ROXD_HARNESS];
    modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels(
      [
        { id: 'claude-code', name: 'Claude Code' },
        { id: 'codex', name: 'Codex' },
      ],
      'codex'
    );

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    );

    const defaultModel = within(dialog).getByLabelText('Модель по умолчанию');
    expect(defaultModel.tagName).toBe('BUTTON');
    expect(defaultModel).toHaveProperty('textContent', 'Codex');
    expect(modelOptions(defaultModel).getAllByRole('menuitem')).toHaveLength(2);
  });

  it('falls back to the first advertised model when current is absent', () => {
    harnessMocks.query.data = [ROXD_HARNESS];
    modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels(
      [
        { id: 'claude-code', name: 'Claude Code' },
        { id: 'codex', name: 'Codex' },
      ],
      'retired-model'
    );

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    );

    expect(within(dialog).getByLabelText('Модель по умолчанию')).toHaveProperty(
      'textContent',
      'Claude Code'
    );
  });

  it('shows the current model when an available catalog has no options', () => {
    harnessMocks.query.data = [ROXD_HARNESS];
    modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels(
      [],
      'provider-default'
    );

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    );

    const defaultModel = within(dialog).getByLabelText('Модель по умолчанию');
    expect(defaultModel).toHaveProperty(
      'textContent',
      'provider-default (недоступен)'
    );
    expect(
      modelOptions(defaultModel).getByRole('menuitem', {
        name: 'provider-default (недоступен)',
      })
    ).toBeTruthy();
  });

  it('submits roxd agents with the roxd slug and harness id', async () => {
    harnessMocks.query.data = [ROXD_HARNESS];
    modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels(
      [{ id: 'claude-code', name: 'Claude Code' }],
      'claude-code'
    );

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Bug fixer' },
    });
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );

    await waitFor(() => {
      expect(agentMocks.create).toHaveBeenCalledWith({
        autoAcceptPermissions: false,
        avatarUrl: undefined,
        isCoding: true,
        channelIds: [],
        channelScope: 'all',
        defaultModel: 'claude-code',
        handle: 'bug-fixer',
        harness: 'roxd',
        harnessId: ROXD_HARNESS.id,
        name: 'Bug fixer',
        instructions: '',
        mcp: { scope: 'owner_connections' },
        teamId: undefined,
      });
    });
  });

  it('seeds the coding choice from the runtime and lets the user override it', async () => {
    harnessMocks.query.data = [ROXD_HARNESS];
    modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels(
      [{ id: 'claude-code', name: 'Claude Code' }],
      'claude-code'
    );

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Chatty' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
    // Rox's in-memory runtime chats; a roxd harness codes.
    expect(within(dialog).getByLabelText('Чат-агент')).toHaveProperty(
      'checked',
      true
    );
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    );
    expect(within(dialog).getByLabelText('Агент для кода')).toHaveProperty(
      'checked',
      true
    );
    fireEvent.click(within(dialog).getByLabelText('Чат-агент'));
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );

    await waitFor(() => {
      expect(agentMocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ harness: 'roxd', isCoding: false })
      );
    });
  });

  it('preserves and labels a saved model missing from the fresh catalog', () => {
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'in-memory',
        default_model: 'retired-model',
        channel_scope: 'all',
        channel_ids: [],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Bug fixer' }));

    const defaultModel = within(
      screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ })
    ).getByLabelText('Модель по умолчанию');
    expect(defaultModel).toHaveProperty(
      'textContent',
      'retired-model (сохранён, недоступен)'
    );
    fireEvent.keyDown(defaultModel, { key: 'Enter' });
    fireEvent.input(screen.getByRole('textbox', { name: 'Поиск моделей' }), {
      target: { value: 'retired' },
    });
    expect(
      screen.getByRole('menuitem', {
        name: /^retired-model \(сохранён, недоступен\)/,
      })
    ).toBeTruthy();
  });

  it('preselects the bound roxd harness when editing', () => {
    harnessMocks.query.data = [ROXD_HARNESS];
    modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels([
      { id: 'default', name: 'Harness default' },
    ]);
    agentMocks.query.data = [
      {
        bot: {
          id: 'agent-1',
          kind: 'owned',
          owner: { type: 'user', user_id: 'macro|user@example.com' },
          name: 'Bug fixer',
          handle: 'bug-fixer',
          description: 'Finds and fixes bugs.',
          has_agent: true,
          created_at: '2026-08-27T12:00:00Z',
          updated_at: '2026-08-27T12:00:00Z',
        },
        instructions: 'Fix the root cause.',
        harness: 'roxd',
        harness_id: ROXD_HARNESS.id,
        default_model: 'default',
        channel_scope: 'all',
        channel_ids: [],
      },
    ];

    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Bug fixer' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(
      within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
    ).toHaveProperty('checked', true);
    expect(within(dialog).getByLabelText('Компьютер')).toHaveProperty(
      'textContent',
      'Dev box'
    );
    const defaultModel = within(dialog).getByLabelText('Модель по умолчанию');
    expect(defaultModel.tagName).toBe('BUTTON');
    expect(defaultModel).toHaveProperty('textContent', 'Harness default');
  });

  const linearAgent = {
    bot: {
      id: 'agent-mcp',
      kind: 'owned',
      owner: { type: 'team', team_id: 'team-1' },
      name: 'Triage bot',
      handle: 'triage-bot',
      has_agent: true,
      created_by: 'macro|user@example.com',
      created_at: '2026-08-27T12:00:00Z',
      updated_at: '2026-08-27T12:00:00Z',
    },
    instructions: '',
    harness: 'in-memory',
    default_model: Model.sonnet55,
    channel_scope: 'all',
    channel_ids: [],
    mcp: {
      scope: 'selected',
      servers: [
        { app_slug: 'linear', server_name: 'Linear' },
        { app_slug: 'notion', server_name: 'Notion' },
      ],
    },
  };

  it('defaults new agents to the owner connections policy', () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(
      within(dialog).getByText(
        'Чат-агент · Все каналы · Ваши подключённые приложения'
      )
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
    expect(
      within(dialog).getByLabelText('Использовать мои подключённые приложения')
    ).toHaveProperty('checked', true);
    expect(within(dialog).queryByLabelText('Search connectors')).toBeNull();
  });

  it('picks apps from the whole catalog, shows the viewer connection state, and persists them', async () => {
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Triage bot' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
    fireEvent.click(within(dialog).getByLabelText('Конкретные приложения'));

    // An explicit selection with nothing in it is not something to save.
    expect(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    ).toHaveProperty('disabled', true);

    within(dialog).getByLabelText('Search connectors').focus();
    fireEvent.input(within(dialog).getByLabelText('Search connectors'), {
      target: { value: 'lin' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Linear/ })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('option', { name: /Linear/ }));

    // The pick is listed as not connected for this viewer, with a way in.
    await waitFor(() => {
      expect(within(dialog).getByText('Linear')).toBeTruthy();
    });
    expect(within(dialog).getByLabelText('Not connected')).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Connect' })
    ).toBeTruthy();
    // ...and no longer offered by the search.
    fireEvent.input(within(dialog).getByLabelText('Search connectors'), {
      target: { value: 'lin' },
    });
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Linear/ })).toBeNull();
    });

    // Unconnected picks never block saving: the agent's author chooses the
    // apps, each person connects their own.
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );
    await waitFor(() => {
      expect(agentMocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mcp: {
            scope: 'selected',
            servers: [{ app_slug: 'linear', server_name: 'Linear' }],
          },
        })
      );
    });
  });

  it('connects a picked app in place and flips its indicator without saving', async () => {
    agentMocks.update.mockClear();
    agentMocks.query.data = [linearAgent];
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить Triage bot' }));

    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    expect(
      within(dialog).getByText('Чат-агент · Все каналы · Выбрано 2 приложения')
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
    expect(within(dialog).getByLabelText('Конкретные приложения')).toHaveProperty(
      'checked',
      true
    );
    expect(within(dialog).getAllByLabelText('Not connected')).toHaveLength(2);
    // Team agents say out loud that connections are per person.
    expect(within(dialog).getByText(/Подключения личные/)).toBeTruthy();

    // Linear is listed first; its row carries the first Connect action.
    fireEvent.click(
      within(dialog).getAllByRole('button', {
        name: 'Connect',
      })[0] as HTMLElement
    );

    await waitFor(() => {
      expect(pipedreamMocks.connect).toHaveBeenCalledWith(
        expect.objectContaining({ appSlug: 'linear', serverName: 'Linear' })
      );
    });
    expect(agentMocks.update).not.toHaveBeenCalled();

    // Removing one pick keeps the other.
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Remove Notion' })
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Сохранить изменения' })
    );
    await waitFor(() => {
      expect(agentMocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          mcp: {
            scope: 'selected',
            servers: [{ app_slug: 'linear', server_name: 'Linear' }],
          },
        })
      );
    });
  });
});

it('requires prompts unless the harness operator permits bypass', async () => {
  harnessMocks.query.data = [ROXD_HARNESS];
  modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels([
    { id: 'claude-code', name: 'Claude Code' },
  ]);
  render(() => <Agents {...agentsPageProps} />);
  fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
  const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
  fireEvent.click(
    within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
  expect(within(dialog).getByLabelText('Всегда спрашивать')).toHaveProperty(
    'checked',
    true
  );
  expect(within(dialog).queryByLabelText('Всегда пропускать')).toBeNull();
});

it('offers bypass only after harness consent and resets the choice on harness change', async () => {
  harnessMocks.query.data = [
    { ...ROXD_HARNESS, allow_permission_bypass: true },
    { ...ROXD_HARNESS, id: 'prompt-only', name: 'Prompt only' },
  ];
  modelMocks.queries[`roxd:${ROXD_HARNESS.id}`] = successfulModels([
    { id: 'claude-code', name: 'Claude Code' },
  ]);
  render(() => <Agents {...agentsPageProps} />);
  fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
  const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
  fireEvent.click(
    within(dialog).getByRole('radio', { name: 'На вашем компьютере' })
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
  expect(within(dialog).getByLabelText('Всегда спрашивать')).toHaveProperty(
    'checked',
    true
  );
  fireEvent.click(within(dialog).getByLabelText('Всегда пропускать'));
  expect(within(dialog).getByLabelText('Всегда пропускать')).toHaveProperty(
    'checked',
    true
  );
  chooseSelectOption(within(dialog).getByLabelText('Компьютер'), 'Prompt only');
  expect(within(dialog).getByLabelText('Всегда спрашивать')).toHaveProperty(
    'checked',
    true
  );
  expect(within(dialog).queryByLabelText('Всегда пропускать')).toBeNull();
});

it.each(['in-memory', 'cursor'])(
  'hides permission choices and saves bypass for built-in %s',
  async (harness) => {
    cursorMocks.status.data.registered = true;
    modelMocks.queries[`${harness}:`] = successfulModels([
      { id: 'provider-default', name: 'Provider default' },
    ]);
    agentMocks.create.mockClear();
    render(() => <Agents {...agentsPageProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить агента' }));
    const dialog = screen.getByRole('region', { name: /^(Новый агент|Изменить агента)$/ });
    fireEvent.input(within(dialog).getByLabelText('Имя'), {
      target: { value: 'Built-in agent' },
    });
    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: {
          'in-memory': `В ${displayName}`,
          cursor: 'В Cursor',
        }[harness]!,
      })
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Показать' }));
    expect(within(dialog).getByLabelText('Чат-агент')).toBeTruthy();
    expect(within(dialog).queryByText('Запросы разрешений')).toBeNull();
    expect(within(dialog).queryByLabelText('Всегда спрашивать')).toBeNull();
    expect(within(dialog).queryByLabelText('Всегда пропускать')).toBeNull();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать агента' })
    );
    await waitFor(() => {
      expect(agentMocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ harness, autoAcceptPermissions: true })
      );
    });
  }
);
