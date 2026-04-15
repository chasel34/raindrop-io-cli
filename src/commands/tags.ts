import { Command } from "commander";

import { resolveAuth } from "../auth.js";
import { listTags } from "../client.js";
import { type GlobalOptions, type CliRuntime } from "../cli.js";
import { CliError } from "../errors.js";
import {
  addMissingSubcommandHandler,
  createIntegerParser,
  withExitOverride,
} from "./helpers.js";
import { printJson, printLine } from "../output.js";

export function createTagsCommand(
  program: Command,
  runtime: CliRuntime,
): Command {
  const tagsCommand = withExitOverride(
    new Command("tags").description("Read Raindrop tags"),
  );

  addMissingSubcommandHandler(tagsCommand, program, "tags");

  tagsCommand.addCommand(
    withExitOverride(new Command("list"))
      .description("List tags")
      .option(
        "--collection <id>",
        "Collection ID",
        createIntegerParser({
          label: "Collection ID",
        }),
      )
      .action(async (options: { collection?: number }) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(globalOptions, "tags list", runtime);

        if (!auth.token) {
          throw new CliError({
            code: "auth_missing",
            command: "tags list",
            message: "Raindrop token not found",
            status: 401,
          });
        }

        const items = await listTags(
          auth.config,
          auth.token,
          options.collection,
          runtime,
        );

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              items,
            },
            meta: {
              command: "tags list",
            },
          });
          return;
        }

        for (const item of items) {
          printLine(runtime.stdout, `${item.title} (${item.count})`);
        }
      }),
  );

  return tagsCommand;
}
