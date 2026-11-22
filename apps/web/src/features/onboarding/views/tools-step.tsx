import { t } from '@app/lib/i18n';
import { canonicalPipedreamSlug } from '@core/pipedream/slugs';
import { fireAndForget } from '@core/util/fireAndForget';
import SearchIcon from '@icon/system/regular/magnifying-glass.svg';
import { createEffect, createSignal, For, Show } from 'solid-js';
import { ContinueButton } from '../components/controls';
import { ToolTile } from '../components/tool-tile';
import { type Tool, useOnboardingContext } from '../context/onboarding-context';
import {
  readPendingConnectors,
  savePendingConnectors,
} from '../primitives/flow-storage';
import { orderOnboardingTools } from '../primitives/tools';

/** Uses the same searchable, paginated catalog and hosted connection flow as Settings. */
export function ToolsStep(props: { onContinue: () => void }) {
  const context = useOnboardingContext();
  const catalog = context.createToolCatalog();
  const connected = context.createConnectedTools({ poll: true });
  const entries = () => orderOnboardingTools(catalog.entries());
  const [busy, setBusy] = createSignal<string>();
  // Hosted OAuth finishes out of band, so a connection counts once polling
  // reports a tool this step started connecting. Kept in session storage
  // because GitHub's web OAuth reloads the page before its link lands.
  const [pending, setPending] = createSignal(readPendingConnectors());
  createEffect(() => savePendingConnectors(pending()));
  createEffect(() => {
    const landed = [...pending()].filter((slug) =>
      ['connected', 'account-linked'].includes(connected.state(slug))
    );
    if (landed.length === 0) return;
    for (const slug of landed)
      context.track('onboarding_v4_connector_connected', { connector: slug });
    setPending((set) => new Set([...set].filter((s) => !landed.includes(s))));
  });

  const connect = async (tool: Tool) => {
    if (
      busy() ||
      !['available', 'disabled'].includes(connected.state(tool.slug))
    )
      return;
    setBusy(tool.slug);
    setPending((set) => new Set(set).add(canonicalPipedreamSlug(tool.slug)));
    try {
      await context.connectTool(tool);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div class="flex flex-col gap-7">
      <label class="flex items-center gap-3 rounded-full border border-edge bg-input px-5 py-4 shadow-sm focus-within:ring-1 focus-within:ring-ink/30">
        <SearchIcon aria-hidden="true" class="size-5 shrink-0 text-ink/35" />
        <input
          type="search"
          aria-label={t('onboarding.searchIntegrations')}
          placeholder={t('onboarding.searchIntegrations')}
          value={catalog.search()}
          onInput={(event) => catalog.setSearch(event.currentTarget.value)}
          class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-placeholder"
        />
      </label>
      <div role="region" aria-label={t('onboarding.availableIntegrations')} class="px-1 py-1">
        <div class="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4">
          <For each={entries()}>
            {(tool) => (
              <ToolTile
                tool={tool}
                busy={busy() === tool.slug}
                disabled={
                  busy() !== undefined ||
                  ['loading', 'error'].includes(connected.state(tool.slug))
                }
                state={connected.state(tool.slug)}
                onConnect={() => fireAndForget(connect(tool), 'onboarding')}
              />
            )}
          </For>
        </div>
        <Show
          when={entries().some(
            (tool) => connected.state(tool.slug) === 'error'
          )}
        >
          <p role="alert" class="py-4 text-center text-sm text-ink-muted">
            {t('onboarding.connectionsCheckFailed')}{' '}
            <button type="button" class="underline" onClick={connected.retry}>
              {t('onboarding.retryConnectionStatus')}
            </button>
          </p>
        </Show>
        <Show
          when={
            entries().some((tool) => tool.slug === 'github') &&
            connected.state('github') === 'account-linked'
          }
        >
          <p class="py-4 text-center text-sm text-ink-muted">
            {t('onboarding.githubLinked')}{' '}
            <button
              type="button"
              class="underline"
              onClick={context.configureGithubRepositories}
            >
              {t('onboarding.configureGithubRepositories')}
            </button>
          </p>
        </Show>
        <Show when={catalog.failed()}>
          <p role="alert" class="py-6 text-center text-sm text-ink-muted">
            {t('onboarding.integrationsLoadFailed')}{' '}
            <button type="button" class="underline" onClick={catalog.retry}>
              {t('onboarding.retry')}
            </button>
          </p>
        </Show>
        <Show when={catalog.fetching()}>
          <p role="status" class="py-6 text-center text-sm text-ink-muted">
            {t('onboarding.loadingIntegrations')}
          </p>
        </Show>
        <Show
          when={
            !catalog.fetching() &&
            !catalog.failed() &&
            entries().length === 0 &&
            !catalog.hasMore()
          }
        >
          <p class="py-6 text-center text-sm text-ink-muted">
            No integrations match “{catalog.search()}”. Try another name.
          </p>
        </Show>
        <Show when={catalog.hasMore()}>
          <button
            type="button"
            disabled={catalog.fetching()}
            onClick={catalog.loadMore}
            class="mx-auto block rounded-full border border-edge px-4 py-2 text-sm text-ink-muted disabled:opacity-40"
          >
            Load more
          </button>
        </Show>
      </div>
      <div class="sticky bottom-0 z-10 bg-surface pb-[var(--safe-bottom,0px)]">
        <ContinueButton
          disabled={busy() !== undefined}
          onClick={props.onContinue}
        />
      </div>
    </div>
  );
}
