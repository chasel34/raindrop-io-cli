import { readFile } from "node:fs/promises";
import { homedir } from "node:os";

import { Command, CommanderError } from "commander";

import { createDoctorCommand } from "./commands/doctor.js";
import { createBookmarksCommand } from "./commands/bookmarks.js";
import { createRequestCommand } from "./commands/request.js";
import { createTagsCommand } from "./commands/tags.js";
import { createCollectionsCommand } from "./commands/collections.js";
import { createUserCommand } from "./commands/user.js";
import { CliError, toCliError } from "./errors.js";
import { printJson, printLine, type OutputWriter } from "./output.js";

export type CliRuntime = {
  env: NodeJS.ProcessEnv;
  fetch: typeof fetch;
  homeDir: string;
  readFile: (path: string) => Promise<string>;
  stdout: OutputWriter;
  stderr: OutputWriter;
};

export type GlobalOptions = {
  json?: boolean;
  token?: string;
};

export function createCli(
  runtime: CliRuntime,
  options: { suppressCommanderErrorOutput?: boolean } = {},
): Command {
  const program = new Command();
  const suppressCommanderErrorOutput =
    options.suppressCommanderErrorOutput ?? false;

  program
    .name("raindrop")
    .description("CLI for Raindrop.io")
    .version("0.1.0")
    .option("--json", "Write machine-readable JSON to stdout")
    .option("--token <token>", "Raindrop access token")
    .showHelpAfterError();

  program.addCommand(createDoctorCommand(program, runtime));
  program.addCommand(createBookmarksCommand(program, runtime));
  program.addCommand(createCollectionsCommand(program, runtime));
  program.addCommand(createRequestCommand(program, runtime));
  program.addCommand(createTagsCommand(program, runtime));
  program.addCommand(createUserCommand(program, runtime));

  configureCommandTree(program, runtime, suppressCommanderErrorOutput);

  return program;
}

export async function runCli(
  argv: string[],
  overrides: Partial<CliRuntime> = {},
): Promise<number> {
  const preferJson = hasJsonFlag(argv);
  const runtime = createRuntime(overrides);
  const program = createCli(runtime, {
    suppressCommanderErrorOutput: preferJson,
  });

  try {
    await program.parseAsync(["node", "raindrop", ...argv], { from: "node" });
    return 0;
  } catch (error) {
    return handleCliError(
      error,
      program.opts<GlobalOptions>(),
      runtime,
      preferJson,
    );
  }
}

function createRuntime(overrides: Partial<CliRuntime>): CliRuntime {
  return {
    env: overrides.env ?? process.env,
    fetch: overrides.fetch ?? globalThis.fetch,
    homeDir: overrides.homeDir ?? homedir(),
    readFile:
      overrides.readFile ??
      (async (path: string) => await readFile(path, "utf8")),
    stdout: overrides.stdout ?? process.stdout,
    stderr: overrides.stderr ?? process.stderr,
  };
}

function handleCliError(
  error: unknown,
  options: GlobalOptions,
  runtime: CliRuntime,
  preferJson: boolean,
): number {
  if (error instanceof CommanderError) {
    if (!options.json && preferJson) {
      options = {
        ...options,
        json: true,
      };
    }

    if (!options.json) {
      return error.exitCode;
    }

    printJson(runtime.stdout, {
      ok: false,
      error: {
        code: "cli_usage_error",
        message: error.message,
      },
      meta: {
        command: "raindrop",
      },
    });
    return error.exitCode;
  }

  const cliError =
    error instanceof CliError
      ? error
      : toCliError(error, { command: "raindrop" });

  if (options.json) {
    printJson(runtime.stdout, {
      ok: false,
      error: {
        code: cliError.code,
        message: cliError.message,
        status: cliError.status,
      },
      meta: {
        command: cliError.command,
      },
    });
  } else {
    printLine(runtime.stderr, cliError.message);
  }

  return cliError.exitCode;
}

function hasJsonFlag(argv: string[]): boolean {
  for (const arg of argv) {
    if (arg === "--") {
      return false;
    }

    if (arg === "--json") {
      return true;
    }
  }

  return false;
}

function configureCommandTree(
  command: Command,
  runtime: CliRuntime,
  suppressCommanderErrorOutput: boolean,
): void {
  command.exitOverride();
  command.configureHelp({
    optionDescription: (option) => {
      if (!option.mandatory) {
        return option.description;
      }

      return option.description
        ? `${option.description} (required)`
        : "(required)";
    },
  });
  command.configureOutput({
    writeOut: (text) => {
      runtime.stdout.write(text);
    },
    writeErr: (text) => {
      if (!suppressCommanderErrorOutput) {
        runtime.stderr.write(text);
      }
    },
    outputError: (text, write) => {
      if (!suppressCommanderErrorOutput) {
        write(text);
      }
    },
  });

  for (const subcommand of command.commands) {
    configureCommandTree(subcommand, runtime, suppressCommanderErrorOutput);
  }
}
