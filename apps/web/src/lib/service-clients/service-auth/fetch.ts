import { LOCAL_ONLY } from '@core/constant/featureFlags';
import { fireAndForget } from '@core/util/fireAndForget';
import type { ObjectLike, ResultError } from '@core/util/result';
import {
  type BaseFetchErrorCode,
  type ErrorResponseHandler,
  type SafeFetchInit,
  safeFetch,
  type TextResponse,
} from '@core/util/safeFetch';
import { Telemetry } from '@rox-one/observability';
import { err, ok, type Result } from 'neverthrow';
import { authServiceClient, getExpiresAt } from './client';

function isExpired(token: string) {
  const expiresAt = getExpiresAt(token);
  return expiresAt <= 0 || Date.now() >= expiresAt;
}

let roxApiTokenPromise: Promise<string> | null = null;
let tokenGeneration = 0;

/** Login/account replacement must not reuse the previous viewer's bearer token. */
export function resetMacroApiToken() {
  tokenGeneration++;
  roxApiTokenPromise = null;
}
function assertTokenGeneration(generation: number) {
  if (generation !== tokenGeneration)
    throw new DOMException('Authentication session changed', 'AbortError');
}
async function readMacroApiToken(generation: number) {
  const result = await authServiceClient.roxApiToken();
  assertTokenGeneration(generation);
  if (result.isErr()) throw result.error;
  return result.value.rox_api_token;
}
async function releaseFailedToken(promise: Promise<string>) {
  try {
    await promise;
  } catch {
    if (roxApiTokenPromise === promise) roxApiTokenPromise = null;
  }
}
function requestMacroApiToken() {
  const promise = readMacroApiToken(tokenGeneration);
  roxApiTokenPromise = promise;
  fireAndForget(releaseFailedToken(promise), 'auth-token');
  return promise;
}

export async function getMacroApiToken(): Promise<string> {
  const parent = Telemetry.captureContext();
  const generation = tokenGeneration;
  if (LOCAL_ONLY) {
    const apiToken = import.meta.env.__LOCAL_JWT__;
    if (apiToken) {
      return apiToken;
    }
  }

  const cachedPromise = roxApiTokenPromise;
  if (!cachedPromise) {
    return parent.run(requestMacroApiToken);
  }

  const apiToken = await cachedPromise;
  assertTokenGeneration(generation);
  if (!isExpired(apiToken)) {
    return apiToken;
  }

  // Another caller may already have replaced the expired entry while this
  // caller was suspended awaiting it. Reuse that replacement instead of
  // issuing a duplicate request.
  if (roxApiTokenPromise !== cachedPromise) {
    return parent.run(getMacroApiToken);
  }

  return parent.run(requestMacroApiToken);
}

type TextContentType = `text/${string}`;
type AcceptHeader<T extends ObjectLike | TextContentType> =
  | HeadersInit
  | (T extends TextContentType
      ? {
          Accept: T;
        }
      : {
          Accept: 'application/json';
        });
type SafeFetchT<T extends ObjectLike | TextContentType> =
  T extends TextContentType ? TextResponse : ObjectLike;
type fetchWithAuthOptions<
  T extends ObjectLike | TextContentType,
  CustomErrorCode extends string,
> = SafeFetchInit & {
  errorResponseHandler?: (
    response: Response
  ) => Promise<ResultError<BaseFetchErrorCode | CustomErrorCode>>;
  headers?: AcceptHeader<T>;
};
export async function fetchWithAuth<
  T extends ObjectLike | TextContentType = {},
  CustomErrorCode extends string = never,
>(
  input: RequestInfo,
  init?: fetchWithAuthOptions<T, CustomErrorCode>
): Promise<Result<T, ResultError<BaseFetchErrorCode | CustomErrorCode>[]>> {
  const generation = tokenGeneration;
  init?.signal?.throwIfAborted();
  const parentSpan = init?.trace?.parentSpan ?? Telemetry.captureContext();
  const apiToken = await parentSpan.run(getMacroApiToken);
  init?.signal?.throwIfAborted();
  assertTokenGeneration(generation);
  if (!apiToken) {
    return err([
      { code: 'UNAUTHORIZED', message: 'No access and/or refresh token found' },
    ]);
  }

  const safeFetchInit = {
    ...init,
    trace: { ...init?.trace, parentSpan },
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${apiToken}`,
    },
  };

  const safeFetchErrorHandler: ErrorResponseHandler<CustomErrorCode> = async (
    response
  ) => {
    if (init?.errorResponseHandler) {
      return await init.errorResponseHandler(response);
    }

    switch (response.status) {
      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        };
      case 401:
        return {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized access',
        };
      case 403:
        return {
          code: 'FORBIDDEN',
          message: 'Forbidden',
        };
      case 409:
        return {
          code: 'CONFLICT',
          message: 'Resource conflict',
        };
      case 410:
        return {
          code: 'GONE',
          message: 'Resource deleted',
        };
      case 500:
        return {
          code: 'SERVER_ERROR',
          message: 'Internal server error',
        };
      default:
        return {
          code: 'HTTP_ERROR',
          message: `HTTP error! status: ${response.status}`,
        };
    }
  };

  // TODO: move safeFetch code to here
  const result = await safeFetch<SafeFetchT<T>, CustomErrorCode>(
    input,
    safeFetchInit,
    safeFetchErrorHandler
  );

  assertTokenGeneration(generation);
  if (result.isErr()) {
    return err(result.error);
  }

  return ok(result.value as T);
}
