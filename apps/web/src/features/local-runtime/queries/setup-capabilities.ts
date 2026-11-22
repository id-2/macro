import { SERVER_HOSTS } from '@core/constant/servers';
import { fireAndForget } from '@core/util/fireAndForget';
import { getMacroApiToken } from '@service-auth/fetch';
import {
  type RoxdStatus,
  roxdDetectAgents,
  roxdStart,
  roxdStatus,
  onRoxdStatus,
} from '@rox/tauri/roxd';
import {
  fetchAgentsList,
  useCreateAgentMutation,
} from '@queries/agents/agents';
import { agentModelsQueryOptions } from '@queries/agents/models';
import { queryClient } from '@queries/client';
import { patchHarness } from '@queries/harnesses/harnesses';
import type { SetupCapabilities } from '../core/setup';

/**
 * Connecting covers pairing, which the app approves on its own, plus a first
 * adapter install; past this the daemon is stuck, not slow.
 */
const CONNECT_TIMEOUT_MS = 3 * 60 * 1000;

/** Resolve once the daemon runs, reporting each phase on the way. */
async function waitForRunning(
  onPhase: (phase: RoxdStatus['phase']) => void
): Promise<RoxdStatus> {
  // A promise settles once; later status events are no-ops.
  let resolveRunning: (status: RoxdStatus) => void = () => {};
  let rejectRunning: (error: Error) => void = () => {};
  const running = new Promise<RoxdStatus>((resolve, reject) => {
    resolveRunning = resolve;
    rejectRunning = reject;
  });
  const handle = (status: RoxdStatus) => {
    onPhase(status.phase);
    if (status.phase === 'running' && status.harnessId) {
      resolveRunning(status);
    } else if (status.phase === 'error') {
      rejectRunning(
        new Error(
          status.lastError ?? 'Этот компьютер перестал запускать агентов.'
        )
      );
    }
  };

  const unlisten = await onRoxdStatus(handle);
  const timer = setTimeout(
    () =>
      rejectRunning(
        new Error('Подключение этого компьютера заняло слишком много времени.')
      ),
    CONNECT_TIMEOUT_MS
  );
  try {
    // Listen first, then read: an event between the two is in the snapshot.
    handle(await roxdStatus());
    return await running;
  } finally {
    clearTimeout(timer);
    fireAndForget(unlisten(), 'local-runtime-setup');
  }
}

/**
 * The deployment this bundle is signed in to, in the form the daemon needs.
 * Both sides must name the same services: the app approves the pairing code
 * through its own session, and the daemon claims it here.
 */
export function localRuntimeDeployment() {
  const apiUrl = SERVER_HOSTS['agent-harness'];
  const storageUrl = SERVER_HOSTS['document-storage-service'];
  // Pairing links open the web app on the same deployment.
  const webUrl = `${new URL(apiUrl).origin}/app`;
  return { apiUrl, storageUrl, webUrl };
}

/** The production capabilities: the Tauri bridge and the agent queries. */
export function useSetupCapabilities(): SetupCapabilities {
  const createAgent = useCreateAgentMutation();
  return {
    detectAgents: roxdDetectAgents,
    startDaemon: async (options) => {
      // The daemon confirms its own pairing code with this session, so the
      // setup flow does not depend on the web page confirming it later.
      // Without one it falls back to the app-wide pairing approver.
      let approvalToken: string | undefined;
      try {
        approvalToken = await getMacroApiToken();
      } catch {
        approvalToken = undefined;
      }
      return await roxdStart({
        ...options,
        ...localRuntimeDeployment(),
        approvalToken,
      });
    },
    waitForRunning,
    allowPermissionBypass: async (harnessId) => {
      await patchHarness({ harnessId, allowPermissionBypass: true });
    },
    listAgents: async () =>
      (await fetchAgentsList()).map((agent) => ({
        botId: agent.bot.id,
        name: agent.bot.name,
        handle: agent.bot.handle,
        harnessId: agent.harness_id ?? null,
      })),
    // A catalog that was empty a moment ago is no answer for a runtime that
    // just came online, so always ask again.
    loadModels: async (harnessId) =>
      await queryClient.fetchQuery({
        ...agentModelsQueryOptions({ harness: 'roxd', harnessId }),
        staleTime: 0,
      }),
    createAgent: async (agent) => {
      const created = await createAgent.mutateAsync({
        name: agent.name,
        handle: agent.handle,
        description: agent.description,
        harness: 'roxd',
        harnessId: agent.harnessId,
        defaultModel: agent.defaultModel,
        instructions: '',
        channelIds: [],
        channelScope: 'all',
        mcp: { scope: 'owner_connections' },
        autoAcceptPermissions: agent.autoAcceptPermissions,
        isCoding: true,
      });
      return {
        botId: created.bot.id,
        name: created.bot.name,
        handle: created.bot.handle,
      };
    },
    sleep: async (ms) =>
      await new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
