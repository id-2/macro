import { match, P } from 'ts-pattern';

/** Base for every error the SDK throws. */
export class RoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoxError';
  }
}

/** Longest server explanation copied into an error message. */
const MAX_DETAIL_LENGTH = 500;

/** The server's explanation in an error body: its text, `message` or `error`. */
function errorDetail(data: unknown): string {
  const detail = match(data)
    .with(P.string, (text) => text)
    .with({ message: P.string }, ({ message }) => message)
    .with({ error: P.string }, ({ error }) => error)
    .otherwise(() => '')
    .trim();
  return detail.length > MAX_DETAIL_LENGTH
    ? `${detail.slice(0, MAX_DETAIL_LENGTH)}…`
    : detail;
}

/**
 * A non-2xx HTTP response (Rox API, or a raw fetch like presigned downloads).
 * The message includes the server's explanation, such as a validation error,
 * and `data` holds the parsed error body.
 */
export class RoxApiError extends RoxError {
  constructor(
    readonly status: number,
    readonly data: unknown,
  ) {
    const detail = errorDetail(data);
    super(
      detail
        ? `Rox API error ${status}: ${detail}`
        : `Rox API error ${status}`,
    );
    this.name = 'RoxApiError';
  }
}

/**
 * A 403: the caller lacks the access the request needs. Most often the user
 * can view the item but not edit it.
 *
 * Agents: tell the user they can only view the item and offer to ask its owner
 * for edit access. Request it only with the user's go-ahead, by calling
 * `access.request('edit')` on the item (for example
 * `macro.initiatives.byId(id).access.request('edit')`); never request access
 * on your own. The request grants nothing: report that it is pending and who
 * reviews it (`access.state()` returns the `owner`), and do not claim the
 * write succeeded. Check `access.state()` later and retry the write only once
 * `accessLevel` allows it.
 *
 * The server does not say which item refused the write. A write that touches
 * two items, such as setting a task's Project (or another property that
 * references an item), needs edit access to both: read `access.state()` on
 * each and request access on the one whose `accessLevel` is below `edit`.
 */
export class RoxForbiddenError extends RoxApiError {
  constructor(data: unknown) {
    super(403, data);
    this.name = 'RoxForbiddenError';
  }
}

/** The API error class for an HTTP status. */
function apiError(status: number, data: unknown): RoxApiError {
  return status === 403
    ? new RoxForbiddenError(data)
    : new RoxApiError(status, data);
}

/** The API succeeded but the addressed entity doesn't exist in the result. */
export class RoxNotFoundError extends RoxError {
  constructor(message: string) {
    super(message);
    this.name = 'RoxNotFoundError';
  }
}

/**
 * Turn a hey-api `{ data, error, response? }` result into either the success
 * payload or a thrown RoxApiError (RoxForbiddenError for a 403).
 */
export function unwrap<TData, TError>(res: {
  data?: TData;
  error?: TError;
  response?: Response;
}): TData {
  if (res.error !== undefined)
    throw apiError(res.response?.status ?? 0, res.error);
  return res.data as TData;
}
