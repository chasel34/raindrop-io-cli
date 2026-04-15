import { Command } from "commander";

import { resolveAuth } from "../auth.js";
import { rawGet } from "../client.js";
import { type GlobalOptions, type CliRuntime } from "../cli.js";
import { CliError } from "../errors.js";
import { addMissingSubcommandHandler, withExitOverride } from "./helpers.js";
import { printJson, printLine } from "../output.js";

export function createRequestCommand(
  program: Command,
  runtime: CliRuntime,
): Command {
  const requestCommand = withExitOverride(
    new Command("request").description(
      "Escape hatch for raw read-only requests",
    ),
  );

  addMissingSubcommandHandler(requestCommand, program, "request");

  requestCommand.addCommand(
    withExitOverride(new Command("get"))
      .description("Run a raw GET request against the Raindrop REST API")
      .argument("<path>", "Raw API path, such as /rest/v1/user")
      .action(async (path: string) => {
        const globalOptions = program.opts<GlobalOptions>();
        const auth = await resolveAuth(globalOptions, "request get", runtime);

        if (!auth.token) {
          throw new CliError({
            code: "auth_missing",
            command: "request get",
            message: "Raindrop token not found",
            status: 401,
          });
        }

        const payload = await rawGet(auth.config, auth.token, path, runtime);

        if (globalOptions.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              payload,
            },
            meta: {
              command: "request get",
            },
          });
          return;
        }

        printLine(runtime.stdout, JSON.stringify(payload, null, 2));
      }),
  );

  return requestCommand;
}
