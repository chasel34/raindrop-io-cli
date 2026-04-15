import { Command } from "commander";

import { resolveAuth } from "../auth.js";
import { getCurrentUser } from "../client.js";
import { type GlobalOptions, type CliRuntime } from "../cli.js";
import { CliError } from "../errors.js";
import { printJson, printLine } from "../output.js";

type DoctorData = {
  auth: {
    configured: boolean;
    source: "flag" | "env" | "config";
  };
  config: {
    baseUrl: string;
    path: string;
    timeoutMs: number;
  };
};

export function createDoctorCommand(
  program: Command,
  runtime: CliRuntime,
): Command {
  return new Command("doctor")
    .description("Check Raindrop CLI configuration")
    .action(async () => {
      const options = program.opts<GlobalOptions>();
      const auth = await resolveAuth(options, "doctor", runtime);

      if (!auth.token || !auth.source) {
        throw new CliError({
          code: "auth_missing",
          command: "doctor",
          message: "Raindrop token not found",
          status: 401,
        });
      }

      await getCurrentUser(auth.config, auth.token, runtime, "doctor");

      const payload: DoctorData = {
        auth: {
          configured: true,
          source: auth.source,
        },
        config: {
          baseUrl: auth.config.baseUrl,
          path: auth.config.configPath,
          timeoutMs: auth.config.timeoutMs,
        },
      };

      if (options.json) {
        printJson(runtime.stdout, {
          ok: true,
          data: payload,
          meta: {
            command: "doctor",
          },
        });
        return;
      }

      printLine(runtime.stdout, "Raindrop CLI configuration looks good.");
    });
}
