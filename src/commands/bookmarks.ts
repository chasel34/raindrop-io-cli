import { Command } from "commander";

import { resolveAuth } from "../auth.js";
import {
  createBookmark,
  getBookmark,
  listBookmarks,
  suggestBookmark,
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
