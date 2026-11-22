import { useUserId } from '@core/context/user';
import { throwOnErr } from '@core/util/result';
import type { CacheHost } from '@graphql-cache/index';
import { subscribeToVisibleCacheChanges } from '@queries/subscribe-to-visible-cache-changes';
import type { VisibleCalendar } from '@service-calendar/generated/schemas/visibleCalendar';
import { emailClient } from '@service-email/client';
import { CalendarsDocument } from '@service-storage/graphql/generated/graphql';
import { getGraphqlSoupClient } from '@service-storage/graphql-soup';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/solid-query';
import { type Accessor, createEffect, onCleanup } from 'solid-js';
import { useGraphqlCalendarHost } from './graphql/flag';
import { mapVisibleCalendar } from './graphql/map';
import {
  calendarCacheAnswered,
  withinCacheHeadStart,
} from './graphql/readiness';
import { calendarKeys } from './keys';

export type { VisibleCalendar };

const CALENDAR_LIST_STALE_TIME = 5 * 60_000;

type VisibleCalendarsQueryKey =
  | ReturnType<typeof calendarKeys.visibleCalendars>['queryKey']
  | ReturnType<
      typeof calendarKeys.visibleCalendars
    >['_ctx']['graphql']['queryKey'];

/**
 * Calendars visible to the viewer across connected and delegated inboxes,
 * primaries and writable calendars first — the order pickers present them in.
 */
export function useVisibleCalendarsQuery(
  options?: Accessor<{ enabled?: boolean }>
) {
  const cacheHost = useGraphqlCalendarHost();
  const activeQueryClient = useQueryClient();
  const userId = useUserId();

  createEffect(() => {
    const host = cacheHost();
    if (!host) return;
    const queryKey = calendarKeys.visibleCalendars(userId())._ctx.graphql
      .queryKey;
    onCleanup(
      subscribeToVisibleCacheChanges(host, () =>
        activeQueryClient.invalidateQueries(
          { queryKey },
          { cancelRefetch: false }
        )
      )
    );
  });

  return useQuery<
    VisibleCalendar[],
    Error,
    VisibleCalendar[],
    VisibleCalendarsQueryKey
  >(() => {
    const host = cacheHost();
    const account = userId();
    const enabled = account !== undefined && options?.().enabled !== false;
    return host
      ? cachedVisibleCalendarsQueryOptions(host, account, enabled)
      : visibleCalendarsQueryOptions(account, enabled);
  });
}

// Cached options outlive the hook. The host is the app-level cache service,
// not component state, so the factory may close over it.
function cachedVisibleCalendarsQueryOptions(
  host: CacheHost,
  userId: string | undefined,
  enabled: boolean
) {
  return {
    queryKey: calendarKeys.visibleCalendars(userId)._ctx.graphql.queryKey,
    queryFn: () => readCalendarList(host),
    // A list restored from the device is stamped 0 and must be read once. Any
    // later answer expires: the records a list names can land after it was
    // read, and an expired answer is re-read from the local cache cheaply.
    staleTime: (query: { state: { dataUpdatedAt: number } }) =>
      query.state.dataUpdatedAt === 0 ? 0 : CALENDAR_LIST_STALE_TIME,
    networkMode: 'offlineFirst' as const,
    enabled,
    placeholderData: keepPreviousData,
    reconcile: 'id' as const,
  };
}

function visibleCalendarsQueryOptions(
  userId: string | undefined,
  enabled: boolean
) {
  return {
    queryKey: calendarKeys.visibleCalendars(userId).queryKey,
    queryFn: listCalendars,
    staleTime: CALENDAR_LIST_STALE_TIME,
    refetchInterval: outlookCalendarRefetchInterval,
    enabled,
    placeholderData: keepPreviousData,
    // Polls return new objects for unchanged calendars. Without reconciling,
    // an open calendar picker rebuilds its rows and loses keyboard focus.
    reconcile: 'id' as const,
  };
}

function outlookCalendarRefetchInterval(query: {
  state: { data: VisibleCalendar[] | undefined };
}): number | false {
  return query.state.data?.some((calendar) => calendar.provider === 'outlook')
    ? 30_000
    : false;
}

async function listCalendars() {
  return (await throwOnErr(() => emailClient.listCalendars())).calendars;
}

/**
 * Reads the list from the cache. A cache that has not answered a calendar read
 * gets a head start. An empty answer is not an answer — the records a list
 * names can arrive after the list itself — so the empty read, a read past the
 * head start, or a failed read ends at the service. A cache that answered is
 * still shown when the service cannot be reached.
 */
async function readCalendarList(host: CacheHost) {
  const cached = calendarCacheAnswered(host)
    ? await readCachedCalendarsOrNotReady()
    : await withinCacheHeadStart(readCachedCalendarsOrNotReady());
  if (cached !== 'not-ready' && cached.length > 0) return cached;
  try {
    return await listCalendars();
  } catch (error) {
    if (cached !== 'not-ready') return cached;
    throw error;
  }
}

/** The cache's list, or `not-ready` when its read fails or has no host yet. */
async function readCachedCalendarsOrNotReady() {
  try {
    return await readCachedCalendars();
  } catch {
    return 'not-ready' as const;
  }
}

/** Reads the calendar list from the cache, fetching it once when absent. */
async function readCachedCalendars() {
  const result = await getGraphqlSoupClient()
    .query(CalendarsDocument, {}, { requestPolicy: 'cache-first' })
    .toPromise();
  if (result.error) throw result.error;
  if (!result.data) throw new Error('Calendars returned no data');
  return result.data.user.calendars.map(mapVisibleCalendar);
}

function withCreatedCalendar(
  current: VisibleCalendar[] | undefined,
  created: VisibleCalendar
): VisibleCalendar[] {
  if (!current) return [created];
  return current.some((calendar) => calendar.id === created.id)
    ? current
    : [...current, created];
}

/** Creates a personal Rox calendar and keeps it in the lists the sidebar reads. */
export function useCreatePersonalCalendarMutation() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: ({ name, timeZone }: { name: string; timeZone: string }) =>
      throwOnErr(() => emailClient.createPersonalCalendar(name, timeZone)),
    onSuccess: async (created) => {
      const queryKey = calendarKeys.visibleCalendars._def;
      const keepCreated = (current: VisibleCalendar[] | undefined) =>
        withCreatedCalendar(current, created);
      queryClient.setQueriesData<VisibleCalendar[]>(
        { queryKey },
        keepCreated
      );
      // The cached calendar read serves a stored snapshot that predates the
      // new calendar, so the list comes from the service itself; the optimistic
      // patch covers a failed read.
      try {
        const calendars = await listCalendars();
        queryClient.setQueriesData<VisibleCalendar[]>(
          { queryKey },
          () => calendars
        );
      } catch {
        queryClient.setQueriesData<VisibleCalendar[]>(
          { queryKey },
          keepCreated
        );
      }
    },
  }));
}
