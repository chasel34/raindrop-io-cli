import { Command } from "commander";

import { resolveAuth } from "../auth.js";
import {
  createBookmark,
  deleteBookmark,
  deleteBookmarks,
  getBookmark,
  listBookmarks,
  suggestBookmark,
  updateBookmark,
  updateBookmarks,
} from "../client.js";
import { type GlobalOptions, type CliRuntime } from "../cli.js";
import { CliError } from "../errors.js";
import {
  addMissingSubcommandHandler,
  createIntegerParser,
  withExitOverride,
} from "./helpers.js";
import { printJson, printLine } from "../output.js";
import { type ApiBookmark } from "../types/api.js";

type PaginationMeta = {
  hasMore: boolean;
  page: number;
  perPage: number;
  returned: number;
};

export function createBookmarksCommand(
  program: Command,
  runtime: CliRuntime,
): Command {
  const bookmarksCommand = withExitOverride(
    new Command("bookmarks").description("Read and create Raindrop bookmarks"),
  );

  addMissingSubcommandHandler(bookmarksCommand, program, "bookmarks");

  bookmarksCommand.addCommand(
    withExitOverride(new Command("list"))
      .description("List bookmarks")
      .requiredOption(
        "--collection <id>",
        "Collection ID",
        createIntegerParser({
          label: "Collection ID",
        }),
      )
      .option(
        "--limit <count>",
        "How many bookmarks to fetch",
        createIntegerParser({
          label: "Limit",
          min: 1,
        }),
        20,
      )
      .option(
        "--page <page>",
        "Page number",
        createIntegerParser({
          label: "Page number",
          min: 0,
        }),
        0,
      )
      .action(async (options: ListOptions) => {
        await handleBookmarksList(program, runtime, options);
      }),
  );

  bookmarksCommand.addCommand(
    withExitOverride(new Command("search"))
      .description("Search bookmarks")
      .argument("<query>", "Raw Raindrop search query")
      .requiredOption(
        "--collection <id>",
        "Collection ID",
        createIntegerParser({
          label: "Collection ID",
        }),
      )
      .option(
        "--limit <count>",
        "How many bookmarks to fetch",
        createIntegerParser({
          label: "Limit",
          min: 1,
        }),
        20,
      )
      .option(
        "--page <page>",
        "Page number",
        createIntegerParser({
          label: "Page number",
          min: 0,
        }),
        0,
      )
      .action(async (query: string, options: ListOptions) => {
        await handleBookmarksList(program, runtime, {
          ...options,
          query,
        });
      }),
  );

  bookmarksCommand.addCommand(
    withExitOverride(new Command("get"))
      .description("Fetch one bookmark")
      .argument(
        "<id>",
        "Bookmark ID",
        createIntegerParser({
          label: "Bookmark ID",
          min: 1,
        }),
      )
      .action(async (id: number) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(globalOptions, "bookmarks get", runtime);
        const token = requireToken(auth.token, "bookmarks get");
        const bookmark = normalizeBookmark(
          await getBookmark(auth.config, token, id, runtime),
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              bookmark,
            },
            meta: {
              command: "bookmarks get",
            },
          });
          return;
        }

        printLine(
          runtime.stdout,
          bookmark.title || bookmark.url || String(bookmark.id),
        );
      }),
  );

  bookmarksCommand.addCommand(
    withExitOverride(new Command("suggest"))
      .description("Suggest collections and tags for a bookmark URL")
      .requiredOption("--url <url>", "Bookmark URL")
      .action(async (options: { url: string }) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "bookmarks suggest",
          runtime,
        );
        const token = requireToken(auth.token, "bookmarks suggest");
        const suggestion = normalizeSuggestion(
          await suggestBookmark(
            auth.config,
            token,
            validateUrl(options.url, "bookmarks suggest"),
            runtime,
          ),
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              suggestion,
            },
            meta: {
              command: "bookmarks suggest",
            },
          });
          return;
        }

        printLine(
          runtime.stdout,
          `${suggestion.collections.join(", ")} ${suggestion.tags.join(", ")}`.trim(),
        );
      }),
  );

  bookmarksCommand.addCommand(
    withExitOverride(new Command("create"))
      .description("Create a bookmark")
      .requiredOption("--url <url>", "Bookmark URL")
      .requiredOption(
        "--collection <id>",
        "Collection ID",
        createIntegerParser({
          label: "Collection ID",
        }),
      )
      .option("--title <title>", "Bookmark title")
      .option("--tags <tags>", "Comma-separated tags")
      .option("--parse", "Ask Raindrop to parse the page on create")
      .action(
        async (options: {
          collection: number;
          parse?: boolean;
          tags?: string;
          title?: string;
          url: string;
        }) => {
          const globalOptions = program.opts<GlobalOptions>();
          const auth = await resolveAuth(
            globalOptions,
            "bookmarks create",
            runtime,
          );
          const token = requireToken(auth.token, "bookmarks create");
          const bookmark = normalizeBookmark(
            await createBookmark(
              auth.config,
              token,
              buildCreateBookmarkBody(options),
              runtime,
            ),
          );

          if (globalOptions.json) {
            printJson(runtime.stdout, {
              ok: true,
              data: {
                bookmark,
              },
              meta: {
                command: "bookmarks create",
              },
            });
            return;
          }

          printLine(
            runtime.stdout,
            bookmark.title || bookmark.url || String(bookmark.id),
          );
        },
      ),
  );

  bookmarksCommand.addCommand(
    withExitOverride(new Command("update"))
      .description("Update a bookmark")
      .argument(
        "<id>",
        "Bookmark ID",
        createIntegerParser({
          label: "Bookmark ID",
          min: 1,
        }),
      )
      .option("--url <url>", "Bookmark URL")
      .option("--title <title>", "Bookmark title")
      .option(
        "--collection <id>",
        "Collection ID",
        createIntegerParser({
          label: "Collection ID",
        }),
      )
      .option("--tags <tags>", "Comma-separated tags")
      .option("--clear-tags", "Remove all tags")
      .option("--important", "Mark bookmark as important")
      .option("--not-important", "Unmark bookmark as important")
      .option("--excerpt <text>", "Bookmark excerpt")
      .option("--note <text>", "Bookmark note")
      .option("--cover <url>", "Cover image URL")
      .option("--parse", "Ask Raindrop to parse the page on update")
      .action(async (id: number, options: BookmarkUpdateOptions) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "bookmarks update",
          runtime,
        );
        const token = requireToken(auth.token, "bookmarks update");
        const bookmark = normalizeBookmark(
          await updateBookmark(
            auth.config,
            token,
            id,
            buildUpdateBookmarkBody(options, "bookmarks update"),
            runtime,
          ),
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              bookmark,
            },
            meta: {
              command: "bookmarks update",
            },
          });
          return;
        }

        printLine(
          runtime.stdout,
          bookmark.title || bookmark.url || String(bookmark.id),
        );
      }),
  );

  bookmarksCommand.addCommand(
    withExitOverride(new Command("delete"))
      .description("Delete a bookmark")
      .argument(
        "<id>",
        "Bookmark ID",
        createIntegerParser({
          label: "Bookmark ID",
          min: 1,
        }),
      )
      .action(async (id: number) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "bookmarks delete",
          runtime,
        );
        const token = requireToken(auth.token, "bookmarks delete");

        await deleteBookmark(auth.config, token, id, runtime);

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              deleted: {
                id,
              },
            },
            meta: {
              command: "bookmarks delete",
            },
          });
          return;
        }

        printLine(runtime.stdout, `Deleted bookmark ${id}`);
      }),
  );

  bookmarksCommand.addCommand(
    withExitOverride(new Command("update-many"))
      .description("Update multiple bookmarks")
      .requiredOption(
        "--collection <id>",
        "Source collection ID",
        createIntegerParser({
          label: "Collection ID",
        }),
      )
      .option("--ids <ids>", "Comma-separated bookmark IDs")
      .option("--search <query>", "Raindrop search query")
      .option("--nested", "Include nested collections")
      .option("--tags <tags>", "Comma-separated tags")
      .option("--clear-tags", "Remove all tags")
      .option(
        "--move-to <id>",
        "Destination collection ID",
        createIntegerParser({
          label: "Destination collection ID",
        }),
      )
      .option("--important", "Mark bookmarks as important")
      .option("--not-important", "Unmark bookmarks as important")
      .option("--cover <url>", "Cover image URL")
      .action(async (options: BookmarkBatchUpdateOptions) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "bookmarks update-many",
          runtime,
        );
        const token = requireToken(auth.token, "bookmarks update-many");
        const batch = buildUpdateBookmarksRequest(options);
        const result = await updateBookmarks(
          auth.config,
          token,
          validateBatchCollection(options.collection, "bookmarks update-many"),
          batch.body,
          batch.query,
          runtime,
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              modified: result.modified,
            },
            meta: {
              command: "bookmarks update-many",
            },
          });
          return;
        }

        printLine(runtime.stdout, `Modified ${result.modified ?? 0} bookmarks`);
      }),
  );

  bookmarksCommand.addCommand(
    withExitOverride(new Command("delete-many"))
      .description("Delete multiple bookmarks")
      .requiredOption(
        "--collection <id>",
        "Source collection ID",
        createIntegerParser({
          label: "Collection ID",
        }),
      )
      .option("--ids <ids>", "Comma-separated bookmark IDs")
      .option("--search <query>", "Raindrop search query")
      .option("--nested", "Include nested collections")
      .action(async (options: BookmarkBatchDeleteOptions) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "bookmarks delete-many",
          runtime,
        );
        const token = requireToken(auth.token, "bookmarks delete-many");
        const batch = buildDeleteBookmarksRequest(options);
        const result = await deleteBookmarks(
          auth.config,
          token,
          validateBatchCollection(options.collection, "bookmarks delete-many"),
          batch.body,
          batch.query,
          runtime,
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              modified: result.modified,
            },
            meta: {
              command: "bookmarks delete-many",
            },
          });
          return;
        }

        printLine(runtime.stdout, `Modified ${result.modified ?? 0} bookmarks`);
      }),
  );

  return bookmarksCommand;
}

type ListOptions = {
  collection: number;
  limit: number;
  page: number;
  query?: string;
};

async function handleBookmarksList(
  program: Command,
  runtime: CliRuntime,
  options: ListOptions,
): Promise<void> {
  const commandName = options.query ? "bookmarks search" : "bookmarks list";
  const globalOptions = program.opts<GlobalOptions>();
  const auth = await resolveAuth(globalOptions, commandName, runtime);
  const token = requireToken(auth.token, commandName);
  const perPage = normalizePerPage(options.limit);
  const result = await listBookmarks(
    auth.config,
    token,
    {
      collectionId: options.collection,
      page: options.page,
      perPage,
      search: options.query,
    },
    runtime,
  );
  const items = result.items.map(normalizeBookmark);
  const pagination: PaginationMeta = {
    hasMore: result.hasMore,
    page: options.page,
    perPage: options.limit,
    returned: items.length,
  };

  if (globalOptions.json) {
    printJson(runtime.stdout, {
      ok: true,
      data: {
        items,
      },
      meta: {
        command: commandName,
        pagination,
      },
    });
    return;
  }

  for (const item of items) {
    printLine(runtime.stdout, item.title || item.url || String(item.id));
  }
}

function buildCreateBookmarkBody(options: {
  collection: number;
  parse?: boolean;
  tags?: string;
  title?: string;
  url: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    collection: {
      $id: options.collection,
    },
    link: validateUrl(options.url, "bookmarks create"),
  };

  if (options.title) {
    body.title = options.title;
  }

  const tags = parseTags(options.tags);

  if (tags.length > 0) {
    body.tags = tags;
  }

  if (options.parse) {
    body.pleaseParse = {};
  }

  return body;
}

type BookmarkUpdateOptions = {
  clearTags?: boolean;
  collection?: number;
  cover?: string;
  excerpt?: string;
  important?: boolean;
  note?: string;
  notImportant?: boolean;
  parse?: boolean;
  tags?: string;
  title?: string;
  url?: string;
};

type BookmarkBatchUpdateOptions = {
  clearTags?: boolean;
  collection: number;
  cover?: string;
  ids?: string;
  important?: boolean;
  moveTo?: number;
  nested?: boolean;
  notImportant?: boolean;
  search?: string;
  tags?: string;
};

type BookmarkBatchDeleteOptions = {
  collection: number;
  ids?: string;
  nested?: boolean;
  search?: string;
};

function buildUpdateBookmarkBody(
  options: BookmarkUpdateOptions,
  command: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (options.url) {
    body.link = validateUrl(options.url, command);
  }

  if (options.title) {
    body.title = options.title;
  }

  if (options.collection !== undefined) {
    body.collection = {
      $id: options.collection,
    };
  }

  if (options.tags && options.clearTags) {
    throw new CliError({
      code: "bookmark_options_conflict",
      command,
      message: "Use either --tags or --clear-tags, not both",
    });
  }

  if (options.clearTags) {
    body.tags = [];
  } else {
    const tags = parseTags(options.tags);

    if (tags.length > 0) {
      body.tags = tags;
    }
  }

  if (options.important && options.notImportant) {
    throw new CliError({
      code: "bookmark_options_conflict",
      command,
      message: "Use either --important or --not-important, not both",
    });
  }

  if (options.important) {
    body.important = true;
  }

  if (options.notImportant) {
    body.important = false;
  }

  if (options.excerpt) {
    body.excerpt = options.excerpt;
  }

  if (options.note) {
    body.note = options.note;
  }

  if (options.cover) {
    body.cover = validateUrl(options.cover, command);
  }

  if (options.parse) {
    body.pleaseParse = {};
  }

  if (Object.keys(body).length === 0) {
    throw new CliError({
      code: "bookmark_update_empty",
      command,
      message: "Provide at least one field to update",
    });
  }

  return body;
}

function buildUpdateBookmarksRequest(options: BookmarkBatchUpdateOptions): {
  body: Record<string, unknown>;
  query: Record<string, string>;
} {
  const { body, query } = buildBatchSelector(options, "bookmarks update-many");

  if (options.tags && options.clearTags) {
    throw new CliError({
      code: "bookmark_options_conflict",
      command: "bookmarks update-many",
      message: "Use either --tags or --clear-tags, not both",
    });
  }

  if (options.clearTags) {
    body.tags = [];
  } else {
    const tags = parseTags(options.tags);

    if (tags.length > 0) {
      body.tags = tags;
    }
  }

  if (options.moveTo !== undefined) {
    body.collection = {
      $id: options.moveTo,
    };
  }

  if (options.important && options.notImportant) {
    throw new CliError({
      code: "bookmark_options_conflict",
      command: "bookmarks update-many",
      message: "Use either --important or --not-important, not both",
    });
  }

  if (options.important) {
    body.important = true;
  }

  if (options.notImportant) {
    body.important = false;
  }

  if (options.cover) {
    body.cover = validateUrl(options.cover, "bookmarks update-many");
  }

  if (!hasUpdateField(body)) {
    throw new CliError({
      code: "bookmark_update_empty",
      command: "bookmarks update-many",
      message: "Provide at least one field to update",
    });
  }

  return {
    body,
    query,
  };
}

function buildDeleteBookmarksRequest(options: BookmarkBatchDeleteOptions): {
  body: Record<string, unknown> | undefined;
  query: Record<string, string>;
} {
  const { body, query } = buildBatchSelector(options, "bookmarks delete-many");

  return {
    body: Object.keys(body).length > 0 ? body : undefined,
    query,
  };
}

function buildBatchSelector(
  options: { ids?: string; nested?: boolean; search?: string },
  command: string,
): {
  body: Record<string, unknown>;
  query: Record<string, string>;
} {
  if (options.ids && options.search) {
    throw new CliError({
      code: "bookmark_selector_conflict",
      command,
      message: "Use either --ids or --search, not both",
    });
  }

  if (!options.ids && !options.search) {
    throw new CliError({
      code: "bookmark_selector_missing",
      command,
      message: "Provide either --ids or --search",
    });
  }

  const body: Record<string, unknown> = {};
  const query: Record<string, string> = {};

  if (options.ids) {
    body.ids = parseIdList(options.ids, command);
  }

  if (options.search) {
    query.search = options.search;
  }

  if (options.nested) {
    query.nested = "true";
  }

  return {
    body,
    query,
  };
}

function hasUpdateField(body: Record<string, unknown>): boolean {
  return Object.keys(body).some(
    (key) => key !== "ids" && key !== "search" && key !== "nested",
  );
}

function normalizeBookmark(bookmark: ApiBookmark): {
  collectionId: number | null;
  id: number;
  tags: string[];
  title: string | null;
  url: string | null;
} {
  return {
    collectionId: bookmark.collection?.$id ?? null,
    id: bookmark._id,
    tags: Array.isArray(bookmark.tags)
      ? bookmark.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    title: typeof bookmark.title === "string" ? bookmark.title : null,
    url: typeof bookmark.link === "string" ? bookmark.link : null,
  };
}

function normalizeSuggestion(suggestion: Record<string, unknown>): {
  collections: number[];
  tags: string[];
} {
  const rawCollections = Array.isArray(suggestion.collections)
    ? suggestion.collections
    : [];
  const collections = rawCollections
    .map((collection) =>
      typeof collection === "object" &&
      collection !== null &&
      "$id" in collection &&
      typeof collection.$id === "number"
        ? collection.$id
        : null,
    )
    .filter((collection): collection is number => collection !== null);
  const tags = Array.isArray(suggestion.tags)
    ? suggestion.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  return {
    collections,
    tags,
  };
}

function parseTags(input: string | undefined): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

function normalizePerPage(limit: number): number {
  return limit;
}

function requireToken(token: string | null, command: string): string {
  if (token) {
    return token;
  }

  throw new CliError({
    code: "auth_missing",
    command,
    message: "Raindrop token not found",
    status: 401,
  });
}

function parseIdList(input: string, command: string): number[] {
  const ids = input
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "")
    .map((value) => Number(value));

  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new CliError({
      code: "ids_invalid",
      command,
      message: "IDs must be a comma-separated list of positive integers",
    });
  }

  return ids;
}

function validateBatchCollection(
  collectionId: number,
  command: string,
): number {
  if (collectionId === 0) {
    throw new CliError({
      code: "bookmark_collection_unsupported",
      command,
      message: "Batch bookmark update and delete do not support collection 0",
    });
  }

  return collectionId;
}

function validateUrl(value: string, command: string): string {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }

    return value;
  } catch {
    throw new CliError({
      code: "bookmark_url_invalid",
      command,
      message: "Bookmark URL must be a valid absolute URL",
    });
  }
}
