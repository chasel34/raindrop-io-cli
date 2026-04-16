import { type CliConfig } from "./config.js";
import { CliError } from "./errors.js";
import {
  type ApiBookmark,
  type ApiCollection,
  type ApiTag,
} from "./types/api.js";

export type ClientRuntime = {
  fetch: typeof fetch;
};

export async function getCurrentUser(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  runtime: ClientRuntime,
  command = "user me",
): Promise<Record<string, unknown>> {
  const payload = await requestJson<{
    user?: Record<string, unknown>;
  }>({
    command,
    config,
    path: "/user",
    runtime,
    token,
  });

  if (!payload.user || typeof payload.user !== "object") {
    throw new CliError({
      code: "api_error",
      command,
      message: "Unexpected Raindrop API response",
    });
  }

  return payload.user;
}

export async function listCollections(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  runtime: ClientRuntime,
): Promise<ApiCollection[]> {
  const [roots, children] = await Promise.all([
    requestJson<{ items?: ApiCollection[] }>({
      command: "collections list",
      config,
      path: "/collections",
      runtime,
      token,
    }),
    requestJson<{ items?: ApiCollection[] }>({
      command: "collections list",
      config,
      path: "/collections/childrens",
      runtime,
      token,
    }),
  ]);

  return [...(roots.items ?? []), ...(children.items ?? [])];
}

export async function createCollection(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  body: Record<string, unknown>,
  runtime: ClientRuntime,
): Promise<ApiCollection> {
  const payload = await requestJson<{ item?: ApiCollection }>({
    body,
    command: "collections create",
    config,
    method: "POST",
    path: "/collection",
    runtime,
    token,
  });

  if (!payload.item) {
    throw new CliError({
      code: "api_error",
      command: "collections create",
      message: "Unexpected Raindrop API response",
    });
  }

  return payload.item;
}

export async function updateCollection(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  id: number,
  body: Record<string, unknown>,
  runtime: ClientRuntime,
): Promise<ApiCollection> {
  const payload = await requestJson<{ item?: ApiCollection }>({
    body,
    command: "collections update",
    config,
    method: "PUT",
    path: `/collection/${id}`,
    runtime,
    token,
  });

  if (!payload.item) {
    throw new CliError({
      code: "api_error",
      command: "collections update",
      message: "Unexpected Raindrop API response",
    });
  }

  return payload.item;
}

export async function deleteCollection(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  id: number,
  runtime: ClientRuntime,
): Promise<void> {
  await requestJson<Record<string, unknown>>({
    command: "collections delete",
    config,
    method: "DELETE",
    path: `/collection/${id}`,
    runtime,
    token,
  });
}

export async function deleteCollections(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  ids: number[],
  runtime: ClientRuntime,
): Promise<{ modified: number | null }> {
  const payload = await requestJson<{ modified?: number }>({
    body: {
      ids,
    },
    command: "collections delete-many",
    config,
    method: "DELETE",
    path: "/collections",
    runtime,
    token,
  });

  return {
    modified: typeof payload.modified === "number" ? payload.modified : null,
  };
}

export async function listTags(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  collectionId: number | undefined,
  runtime: ClientRuntime,
): Promise<Array<{ count: number; title: string }>> {
  const path = collectionId === undefined ? "/tags" : `/tags/${collectionId}`;
  const payload = await requestJson<{ items?: ApiTag[] }>({
    command: "tags list",
    config,
    path,
    runtime,
    token,
  });

  return (payload.items ?? []).map((tag) => ({
    count: typeof tag.count === "number" ? tag.count : 0,
    title:
      typeof tag._id === "string"
        ? tag._id
        : typeof tag.title === "string"
          ? tag.title
          : "",
  }));
}

export async function listBookmarks(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  options: {
    collectionId: number;
    page: number;
    perPage: number;
    search?: string;
  },
  runtime: ClientRuntime,
): Promise<{
  hasMore: boolean;
  items: ApiBookmark[];
}> {
  const requestedPerPage = options.perPage;
  const startOffset = options.page * requestedPerPage;
  let currentApiPage = Math.floor(startOffset / 50);
  let offsetWithinPage = startOffset % 50;
  let remaining = requestedPerPage;
  let hasMore = false;
  const items: ApiBookmark[] = [];

  while (remaining > 0) {
    const payload = await requestJson<{ items?: ApiBookmark[] }>({
      command: options.search ? "bookmarks search" : "bookmarks list",
      config,
      path: `/raindrops/${options.collectionId}`,
      query: {
        page: String(currentApiPage),
        perpage: "50",
        ...(options.search ? { search: options.search } : {}),
      },
      runtime,
      token,
    });
    const pageItems = payload.items ?? [];
    const selectedItems = pageItems.slice(
      offsetWithinPage,
      offsetWithinPage + remaining,
    );

    items.push(...selectedItems);
    remaining -= selectedItems.length;

    if (pageItems.length > offsetWithinPage + selectedItems.length) {
      hasMore = true;
      break;
    }

    if (pageItems.length < 50) {
      hasMore = false;
      break;
    }

    if (remaining === 0) {
      hasMore = true;
      break;
    }

    currentApiPage += 1;
    offsetWithinPage = 0;
  }

  return {
    hasMore,
    items,
  };
}

export async function getBookmark(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  id: number,
  runtime: ClientRuntime,
): Promise<ApiBookmark> {
  const payload = await requestJson<{ item?: ApiBookmark }>({
    command: "bookmarks get",
    config,
    path: `/raindrop/${id}`,
    runtime,
    token,
  });

  if (!payload.item) {
    throw new CliError({
      code: "api_error",
      command: "bookmarks get",
      message: "Unexpected Raindrop API response",
    });
  }

  return payload.item;
}

export async function suggestBookmark(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  url: string,
  runtime: ClientRuntime,
): Promise<Record<string, unknown>> {
  const payload = await requestJson<{ item?: Record<string, unknown> }>({
    command: "bookmarks suggest",
    config,
    body: {
      link: url,
    },
    method: "POST",
    path: "/raindrop/suggest",
    runtime,
    token,
  });

  return payload.item ?? {};
}

export async function createBookmark(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  body: Record<string, unknown>,
  runtime: ClientRuntime,
): Promise<ApiBookmark> {
  const payload = await requestJson<{ item?: ApiBookmark }>({
    body,
    command: "bookmarks create",
    config,
    method: "POST",
    path: "/raindrop",
    runtime,
    token,
  });

  if (!payload.item) {
    throw new CliError({
      code: "api_error",
      command: "bookmarks create",
      message: "Unexpected Raindrop API response",
    });
  }

  return payload.item;
}

export async function updateBookmark(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  id: number,
  body: Record<string, unknown>,
  runtime: ClientRuntime,
): Promise<ApiBookmark> {
  const payload = await requestJson<{ item?: ApiBookmark }>({
    body,
    command: "bookmarks update",
    config,
    method: "PUT",
    path: `/raindrop/${id}`,
    runtime,
    token,
  });

  if (!payload.item) {
    throw new CliError({
      code: "api_error",
      command: "bookmarks update",
      message: "Unexpected Raindrop API response",
    });
  }

  return payload.item;
}

export async function deleteBookmark(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  id: number,
  runtime: ClientRuntime,
): Promise<void> {
  await requestJson<Record<string, unknown>>({
    command: "bookmarks delete",
    config,
    method: "DELETE",
    path: `/raindrop/${id}`,
    runtime,
    token,
  });
}

export async function updateBookmarks(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  collectionId: number,
  body: Record<string, unknown>,
  query: Record<string, string>,
  runtime: ClientRuntime,
): Promise<{ modified: number | null }> {
  const payload = await requestJson<{ modified?: number }>({
    body,
    command: "bookmarks update-many",
    config,
    method: "PUT",
    path: `/raindrops/${collectionId}`,
    query,
    runtime,
    token,
  });

  return {
    modified: typeof payload.modified === "number" ? payload.modified : null,
  };
}

export async function deleteBookmarks(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  collectionId: number,
  body: Record<string, unknown> | undefined,
  query: Record<string, string>,
  runtime: ClientRuntime,
): Promise<{ modified: number | null }> {
  const payload = await requestJson<{ modified?: number }>({
    body,
    command: "bookmarks delete-many",
    config,
    method: "DELETE",
    path: `/raindrops/${collectionId}`,
    query,
    runtime,
    token,
  });

  return {
    modified: typeof payload.modified === "number" ? payload.modified : null,
  };
}

export async function rawGet(
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">,
  token: string,
  path: string,
  runtime: ClientRuntime,
): Promise<Record<string, unknown>> {
  return await requestJson<Record<string, unknown>>({
    command: "request get",
    config,
    path: normalizeRawPath(path),
    runtime,
    token,
  });
}

type RequestJsonOptions = {
  body?: Record<string, unknown>;
  command: string;
  config: Pick<CliConfig, "baseUrl" | "timeoutMs">;
  method?: "DELETE" | "GET" | "POST" | "PUT";
  path: string;
  query?: Record<string, string>;
  runtime: ClientRuntime;
  token: string;
};

async function requestJson<T>({
  body,
  command,
  config,
  method = "GET",
  path,
  query,
  runtime,
  token,
}: RequestJsonOptions): Promise<T> {
  const url = new URL(`${config.baseUrl}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  let response: Awaited<ReturnType<typeof runtime.fetch>>;

  try {
    response = await runtime.fetch(url.toString(), {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      method,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new CliError({
        code: "network_timeout",
        command,
        message: "Raindrop API request timed out",
      });
    }

    throw new CliError({
      code: "network_error",
      command,
      message: "Failed to reach the Raindrop API",
    });
  }

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok || payload.result === false) {
    const apiError = getApiError(command, payload, response.status);

    throw new CliError({
      code: apiError.code,
      command,
      message: apiError.message,
      status: response.status || undefined,
    });
  }

  return payload as T;
}

function getApiError(
  command: string,
  payload: Record<string, unknown>,
  status: number,
): {
  code: string;
  message: string;
} {
  if (isSuggestProOnlyError(command, payload, status)) {
    return {
      code: "feature_requires_pro",
      message: "bookmarks suggest requires a Raindrop Pro account",
    };
  }

  return {
    code: getApiErrorCode(payload, status),
    message: getApiErrorMessage(payload, status),
  };
}

function getApiErrorCode(
  payload: Record<string, unknown>,
  status: number,
): string {
  if (typeof payload.error === "string" && payload.error.trim() !== "") {
    return payload.error;
  }

  if (status === 429) {
    return "rate_limited";
  }

  return "api_error";
}

function getApiErrorMessage(
  payload: Record<string, unknown>,
  status: number,
): string {
  if (
    typeof payload.errorMessage === "string" &&
    payload.errorMessage.trim() !== ""
  ) {
    return payload.errorMessage;
  }

  if (status === 401) {
    return "Raindrop API request failed";
  }

  if (status === 429) {
    return "Raindrop API rate limit exceeded";
  }

  return "Raindrop API request failed";
}

function isSuggestProOnlyError(
  command: string,
  payload: Record<string, unknown>,
  status: number,
): boolean {
  if (command !== "bookmarks suggest" || status !== 403) {
    return false;
  }

  return [payload.error, payload.errorMessage].some(
    (value) =>
      typeof value === "string" && value.trim().toLowerCase() === "pro only",
  );
}

function normalizeRawPath(path: string): string {
  if (/^https?:\/\//u.test(path)) {
    throw new CliError({
      code: "request_invalid_path",
      command: "request get",
      message: "Raw request path must be relative to the Raindrop API base URL",
    });
  }

  if (path.startsWith("/rest/v1/")) {
    return path.slice("/rest/v1".length);
  }

  if (path.startsWith("/")) {
    return path;
  }

  throw new CliError({
    code: "request_invalid_path",
    command: "request get",
    message: "Raw request path must start with '/'",
  });
}

function isTimeoutError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "TimeoutError",
  );
}
