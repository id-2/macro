import { Model } from '@core/component/AI/constant/model';
import { thrownResultErrorHasCode } from '@core/util/result';
import { modelLabel } from '@core/component/AI/constant/model-label';
import {
  type AgentModelTarget,
  useAgentModelsQuery,
} from '@queries/agents/models';
import { providerCredentialRejectedMessage } from '@queries/agents/probe-errors';
import { ModelHarnessDto } from '@service-agent-harness/generated/schemas/modelHarnessDto';
import type { Accessor } from 'solid-js';
import type { RosterAgent } from '../core/roster';

/**
 * Disabled-query placeholder. `useQuery` still wants a target for its key;
 * this one is never fetched and does not collide with a live catalog.
 */
const IDLE_MODEL_TARGET: AgentModelTarget = {
  harness: 'in-memory',
  harnessId: 'composer-idle',
};

/** Map a roster entry to the same discovery target used by agent settings. */
export function composerModelTarget(
  agent: Pick<RosterAgent, 'harness' | 'harnessId'> | undefined
): AgentModelTarget | undefined {
  if (!agent) return;
  const requested =
    agent.harness === 'macro-inmem' ? 'in-memory' : agent.harness;
  const harness = Object.values(ModelHarnessDto).find(
    (value) => value === requested
  );
  if (!harness) return;
  if (harness === 'roxd') {
    return agent.harnessId
      ? { harness, harnessId: agent.harnessId }
      : undefined;
  }
  return { harness };
}

/** A refused sign-in is not a missing catalog. */
function catalogAuthError(error: unknown): boolean {
  return (
    thrownResultErrorHasCode(error, 'UNAUTHORIZED') ||
    thrownResultErrorHasCode(error, 'FORBIDDEN') ||
    providerCredentialRejectedMessage(error) !== undefined
  );
}

/** Keep discovery scoped to the selected, connected runtime. */
export function createComposerModels(agent: Accessor<RosterAgent | undefined>) {
  const target = (): AgentModelTarget | undefined => {
    const selected = agent();
    const next = composerModelTarget(selected);
    return next && selected?.runtime.connected ? next : undefined;
  };
  // `useQueries` exposes `data` as a Solid resource, so reading it suspends
  // on every update — including after success. The composer lives under
  // <Suspense>; that suspend detaches the editor and closes an open mention
  // menu. `useQuery` only suspends while `data` is still undefined, and the
  // isSuccess gate below skips that read.
  const query = useAgentModelsQuery(
    () => target() ?? IDLE_MODEL_TARGET,
    () => target() !== undefined
  );
  const data = () => (target() && query.isSuccess ? query.data : undefined);
  const models = () => {
    const listed = data()?.models ?? [];
    const harness = agent()?.harness;
    const inMemory = harness === 'macro-inmem' || harness === 'in-memory';
    if (
      !inMemory ||
      catalogAuthError(query.error) ||
      listed.some((option) => option.id === Model.roxR1Max)
    ) {
      return listed;
    }
    return [
      {
        id: Model.roxR1Max,
        name: modelLabel(Model.roxR1Max),
        supportsImages: false,
      },
      ...listed,
    ];
  };
  const currentModel = () => {
    const current = data()?.currentModel ?? undefined;
    const harness = agent()?.harness;
    const inMemory = harness === 'macro-inmem' || harness === 'in-memory';
    if (!inMemory || catalogAuthError(query.error)) return current;
    return !current || current === Model.gemini38Flash
      ? Model.roxR1Max
      : current;
  };
  return {
    models,
    currentModel,
    /** Discovery is in flight. Other runtimes have no choices yet; Rox is already selectable. */
    pending: () => target() !== undefined && query.isPending,
    message: () => {
      if (!agent()?.runtime.connected)
        return 'Connect the machine to load models.';
      if (!target()) return 'This machine does not provide model discovery.';
      if (query.isError)
        return (
          providerCredentialRejectedMessage(query.error) ??
          'Could not load models from this machine.'
        );
      if (query.isPending) return 'Loading models…';
      if (data()?.status === 'unsupported') {
        return 'This machine does not provide model discovery.';
      }
      return 'This machine returned no models.';
    },
  };
}
