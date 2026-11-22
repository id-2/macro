import { throwOnErr } from '@core/util/result';
import { getWebOrigin } from '@core/util/webOrigin';
import { authServiceClient } from '@service-auth/client';
import { queryOptions, useMutation, useQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import { queryClient } from '../client';
import { queryReadyGate } from '../gate';
import { authKeys } from './keys';

/** OAuth transport stays in the auth client, shared query orchestration here. */
export function useInitOutlookLink() {
  return useMutation(() => ({
    mutationFn: (params: {
      originalUrl: string;
      calendar: boolean;
      reconnectLinkId?: string;
    }) => authServiceClient.initOutlookLink(params.originalUrl, params),
  }));
}

/**
 * Where a Microsoft administrator lands after approving Rox. Always the web
 * app: the link is copied for someone else, often on another device, so a
 * desktop deep link or native callback would not reach them.
 */
const adminConsentReturnUrl = () => `${getWebOrigin()}/app/inbox-link-callback`;

/** Per user: Outlook follows the server's `enable-outlook` flag. */
const emailConnectionProvidersQuery = () =>
  queryOptions({
    queryKey: authKeys.emailConnectionProviders.queryKey,
    // Availability only: no `original_url`, because the answer is booleans.
    // That hint exists for the admin-consent URL below, and sending it on
    // every read made the read depend on the browser's origin being an
    // allowed return URL — a 400 on a deployment served from any other host.
    queryFn: () =>
      throwOnErr(() => authServiceClient.emailConnectionProviders()),
    staleTime: 0,
  });

/** Fetch on opening the chooser, without suspending unrelated application UI. */
export function fetchEmailConnectionProviders() {
  return queryClient.fetchQuery(emailConnectionProvidersQuery());
}

/**
 * Where a Microsoft 365 administrator approves Rox for the whole directory,
 * read only when that flow actually needs the link.
 */
export async function fetchOutlookAdminConsentUrl(): Promise<
  string | undefined
> {
  const providers = await throwOnErr(() =>
    authServiceClient.emailConnectionProviders(adminConsentReturnUrl())
  );
  return providers.outlook_admin_consent_url ?? undefined;
}

/**
 * Whether to offer a new Outlook connection. False until the server says
 * this user may start one, so Outlook never shows while loading or after a
 * failed read. `enabled` defers the read for surfaces mounted before they open.
 */
export function useOutlookAvailable(
  enabled: Accessor<boolean> = () => true
): Accessor<boolean> {
  const query = useQuery(() => ({
    ...emailConnectionProvidersQuery(),
    enabled: enabled(),
  }));
  // Gate the read: a pending query's data suspends the caller's boundary.
  return () => queryReadyGate(query) && query.data.outlook;
}

/**
 * Whether this deployment can start a GitHub link at all: its sign-in service
 * has the `github` identity provider. A local stack started without a real
 * GitHub OAuth app has none, and the link-status read there could only ever
 * answer "not linked", so callers skip it. False until the server says yes.
 */
export function useGithubLinkAvailable(
  enabled: Accessor<boolean> = () => true
): Accessor<boolean> {
  const query = useQuery(() => ({
    ...emailConnectionProvidersQuery(),
    enabled: enabled(),
  }));
  return () => queryReadyGate(query) && query.data.github;
}
