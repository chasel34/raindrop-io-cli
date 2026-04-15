import { Command } from "commander";

import { resolveAuth } from "../auth.js";
import { getCurrentUser } from "../client.js";
import { type GlobalOptions, type CliRuntime } from "../cli.js";
import { CliError } from "../errors.js";
import { addMissingSubcommandHandler, withExitOverride } from "./helpers.js";
import { printJson, printLine } from "../output.js";

export function createUserCommand(
  program: Command,
  runtime: CliRuntime,
): Command {
  const userCommand = withExitOverride(
    new Command("user").description("Read Raindrop user data"),
  );

  addMissingSubcommandHandler(userCommand, program, "user");

  userCommand.addCommand(
    withExitOverride(new Command("me"))
      .description("Fetch the authenticated user")
      .action(async () => {
        const options = program.opts<GlobalOptions>();
        const auth = await resolveAuth(options, "user me", runtime);

        if (!auth.token) {
          throw new CliError({
            code: "auth_missing",
            command: "user me",
            message: "Raindrop token not found",
            status: 401,
          });
        }

        const user = await getCurrentUser(auth.config, auth.token, runtime);

        if (options.json) {
          printJson(runtime.stdout, {
            ok: true,
            data: {
              user,
            },
            meta: {
              command: "user me",
            },
          });
          return;
        }

        const fullName =
          typeof user.fullName === "string" ? user.fullName : "Unknown user";
        printLine(runtime.stdout, fullName);
      }),
  );

  return userCommand;
}
