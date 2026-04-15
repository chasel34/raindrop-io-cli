import { Command } from "commander";

import { resolveAuth } from "../auth.js";
import { listCollections } from "../client.js";
import { type GlobalOptions, type CliRuntime } from "../cli.js";
import { CliError } from "../errors.js";
import { addMissingSubcommandHandler, withExitOverride } from "./helpers.js";
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
