import { Command } from "commander";

import { resolveAuth } from "../auth.js";
import {
  createCollection,
  deleteCollection,
  deleteCollections,
  listCollections,
  updateCollection,
} from "../client.js";
import { type GlobalOptions, type CliRuntime } from "../cli.js";
import { CliError } from "../errors.js";
import {
  addMissingSubcommandHandler,
  createIntegerParser,
  withExitOverride,
} from "./helpers.js";
import { printJson, printLine } from "../output.js";
import { type ApiCollection } from "../types/api.js";

type CollectionNode = {
  children: CollectionNode[];
  id: number;
  parentId: number | null;
  path: string;
  title: string;
};

export function createCollectionsCommand(
  program: Command,
  runtime: CliRuntime,
): Command {
  const collectionsCommand = withExitOverride(
    new Command("collections").description("Read Raindrop collections"),
  );

  addMissingSubcommandHandler(collectionsCommand, program, "collections");

  collectionsCommand.addCommand(
    withExitOverride(new Command("create"))
      .description("Create a collection")
      .requiredOption("--title <title>", "Collection title")
      .option(
        "--parent <id>",
        "Parent collection ID",
        createIntegerParser({
          label: "Parent collection ID",
        }),
      )
      .option("--view <view>", "Collection view")
      .option(
        "--sort <number>",
        "Collection sort order",
        createIntegerParser({
          label: "Sort order",
        }),
      )
      .option("--cover <urls>", "Comma-separated cover image URLs")
      .option("--public", "Make the collection public")
      .action(async (options: CollectionCreateOptions) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "collections create",
          runtime,
        );
        const token = requireToken(auth.token, "collections create");
        const collection = normalizeCollection(
          await createCollection(
            auth.config,
            token,
            buildCreateCollectionBody(options),
            runtime,
          ),
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              collection,
            },
            meta: {
              command: "collections create",
            },
          });
          return;
        }

        printLine(runtime.stdout, collection.title);
      }),
  );

  collectionsCommand.addCommand(
    withExitOverride(new Command("update"))
      .description("Update a collection")
      .argument(
        "<id>",
        "Collection ID",
        createIntegerParser({
          label: "Collection ID",
          min: 1,
        }),
      )
      .option("--title <title>", "Collection title")
      .option(
        "--parent <id>",
        "Parent collection ID",
        createIntegerParser({
          label: "Parent collection ID",
        }),
      )
      .option("--no-parent", "Remove the parent collection")
      .option("--view <view>", "Collection view")
      .option(
        "--sort <number>",
        "Collection sort order",
        createIntegerParser({
          label: "Sort order",
        }),
      )
      .option("--cover <urls>", "Comma-separated cover image URLs")
      .option("--expanded", "Expand collection in Raindrop")
      .option("--collapsed", "Collapse collection in Raindrop")
      .option("--public", "Make the collection public")
      .option("--private", "Make the collection private")
      .action(async (id: number, options: CollectionUpdateOptions) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "collections update",
          runtime,
        );
        const token = requireToken(auth.token, "collections update");
        const collection = normalizeCollection(
          await updateCollection(
            auth.config,
            token,
            id,
            buildUpdateCollectionBody(options),
            runtime,
          ),
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              collection,
            },
            meta: {
              command: "collections update",
            },
          });
          return;
        }

        printLine(runtime.stdout, collection.title);
      }),
  );

  collectionsCommand.addCommand(
    withExitOverride(new Command("delete"))
      .description("Delete a collection")
      .argument(
        "<id>",
        "Collection ID",
        createIntegerParser({
          label: "Collection ID",
          min: 1,
        }),
      )
      .action(async (id: number) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "collections delete",
          runtime,
        );
        const token = requireToken(auth.token, "collections delete");

        await deleteCollection(auth.config, token, id, runtime);

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              deleted: {
                id,
              },
            },
            meta: {
              command: "collections delete",
            },
          });
          return;
        }

        printLine(runtime.stdout, `Deleted collection ${id}`);
      }),
  );

  collectionsCommand.addCommand(
    withExitOverride(new Command("delete-many"))
      .description("Delete multiple collections")
      .requiredOption("--ids <ids>", "Comma-separated collection IDs")
      .action(async (options: { ids: string }) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "collections delete-many",
          runtime,
        );
        const token = requireToken(auth.token, "collections delete-many");
        const result = await deleteCollections(
          auth.config,
          token,
          parseIdList(options.ids, "collections delete-many"),
          runtime,
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              modified: result.modified,
            },
            meta: {
              command: "collections delete-many",
            },
          });
          return;
        }

        printLine(
          runtime.stdout,
          `Modified ${result.modified ?? 0} collections`,
        );
      }),
  );

  collectionsCommand.addCommand(
    withExitOverride(new Command("list"))
      .description("List collections")
      .option("--tree", "Render nested collection structure")
      .action(async (options: { tree?: boolean }) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "collections list",
          runtime,
        );

        if (!auth.token) {
          throw new CliError({
            code: "auth_missing",
            command: "collections list",
            message: "Raindrop token not found",
            status: 401,
          });
        }

        const items = buildCollectionTree(
          await listCollections(auth.config, auth.token, runtime),
        );
        const data = options.tree ? items : flattenCollectionTree(items);

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              items: data,
            },
            meta: {
              command: "collections list",
            },
          });
          return;
        }

        for (const item of flattenCollectionTree(items)) {
          printLine(runtime.stdout, item.path);
        }
      }),
  );

  collectionsCommand.addCommand(
    withExitOverride(new Command("resolve"))
      .description("Resolve a collection by name or path")
      .requiredOption("--name <name>", "Collection name or full path")
      .action(async (options: { name: string }) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(
          globalOptions,
          "collections resolve",
          runtime,
        );

        if (!auth.token) {
          throw new CliError({
            code: "auth_missing",
            command: "collections resolve",
            message: "Raindrop token not found",
            status: 401,
          });
        }

        const items = flattenCollectionTree(
          buildCollectionTree(
            await listCollections(auth.config, auth.token, runtime),
          ),
        );
        const query = options.name.trim().toLowerCase();
        const matches = items.filter((item) => {
          const title = item.title.toLowerCase();
          const path = item.path.toLowerCase();
          return title === query || path === query;
        });

        if (matches.length === 0) {
          throw new CliError({
            code: "collection_not_found",
            command: "collections resolve",
            message: `No collection matches '${options.name}'`,
          });
        }

        if (matches.length > 1) {
          throw new CliError({
            code: "collection_ambiguous",
            command: "collections resolve",
            message: `Multiple collections match '${options.name}'; refine the name or use a full path`,
          });
        }

        const collection = matches[0];

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              collection,
            },
            meta: {
              command: "collections resolve",
            },
          });
          return;
        }

        printLine(runtime.stdout, collection.path);
      }),
  );

  return collectionsCommand;
}

function buildCollectionTree(items: ApiCollection[]): CollectionNode[] {
  const nodes = new Map<number, CollectionNode>();

  for (const item of items) {
    nodes.set(item._id, {
      children: [],
      id: item._id,
      parentId: item.parent?.$id ?? null,
      path: "",
      title: item.title,
    });
  }

  const roots: CollectionNode[] = [];

  for (const node of nodes.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(node.parentId);

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: CollectionNode[]) => {
    list.sort((left, right) => left.title.localeCompare(right.title));

    for (const node of list) {
      sortNodes(node.children);
    }
  };

  sortNodes(roots);

  const assignPaths = (list: CollectionNode[], parentPath: string | null) => {
    for (const node of list) {
      node.path = parentPath ? `${parentPath}/${node.title}` : node.title;
      assignPaths(node.children, node.path);
    }
  };

  assignPaths(roots, null);
  return roots;
}

function flattenCollectionTree(items: CollectionNode[]): CollectionNode[] {
  const flattened: CollectionNode[] = [];

  for (const item of items) {
    flattened.push(item);
    flattened.push(...flattenCollectionTree(item.children));
  }

  return flattened;
}

type CollectionCreateOptions = {
  cover?: string;
  parent?: number;
  public?: boolean;
  sort?: number;
  title: string;
  view?: string;
};

function buildCreateCollectionBody(
  options: CollectionCreateOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: options.title,
  };

  if (options.parent !== undefined) {
    body.parent = {
      $id: options.parent,
    };
  }

  if (options.public) {
    body.public = true;
  }

  addCollectionMetadata(body, options, "collections create");

  return body;
}

type CollectionUpdateOptions = {
  collapsed?: boolean;
  cover?: string;
  expanded?: boolean;
  parent?: false | number;
  private?: boolean;
  public?: boolean;
  sort?: number;
  title?: string;
  view?: string;
};

function buildUpdateCollectionBody(
  options: CollectionUpdateOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (options.title) {
    body.title = options.title;
  }

  if (options.parent !== undefined) {
    body.parent = {
      $id: options.parent,
    };
  }

  if (options.parent === false) {
    body.parent = null;
  }

  if (options.public && options.private) {
    throw new CliError({
      code: "collection_options_conflict",
      command: "collections update",
      message: "Use either --public or --private, not both",
    });
  }

  if (options.public) {
    body.public = true;
  }

  if (options.private) {
    body.public = false;
  }

  if (options.expanded && options.collapsed) {
    throw new CliError({
      code: "collection_options_conflict",
      command: "collections update",
      message: "Use either --expanded or --collapsed, not both",
    });
  }

  if (options.expanded) {
    body.expanded = true;
  }

  if (options.collapsed) {
    body.expanded = false;
  }

  addCollectionMetadata(body, options, "collections update");

  if (Object.keys(body).length === 0) {
    throw new CliError({
      code: "collection_update_empty",
      command: "collections update",
      message: "Provide at least one field to update",
    });
  }

  return body;
}

function addCollectionMetadata(
  body: Record<string, unknown>,
  options: {
    cover?: string;
    sort?: number;
    view?: string;
  },
  command: string,
): void {
  if (options.view) {
    body.view = options.view;
  }

  if (options.sort !== undefined) {
    body.sort = options.sort;
  }

  const cover = parseCoverUrls(options.cover, command);

  if (cover.length > 0) {
    body.cover = cover;
  }
}

function normalizeCollection(collection: ApiCollection): {
  id: number;
  parentId: number | null;
  public: boolean | null;
  title: string;
} {
  return {
    id: collection._id,
    parentId: collection.parent?.$id ?? null,
    public: typeof collection.public === "boolean" ? collection.public : null,
    title: collection.title,
  };
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

function parseCoverUrls(input: string | undefined, command: string): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url !== "")
    .map((url) => validateUrl(url, command));
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
      code: "collection_url_invalid",
      command,
      message: "Collection URL fields must be valid absolute URLs",
    });
  }
}
