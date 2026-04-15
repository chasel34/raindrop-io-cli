import { Command, CommanderError, InvalidArgumentError } from "commander";

import { type GlobalOptions } from "../cli.js";

type IntegerParserOptions = {
  label: string;
  min?: number;
};

export function withExitOverride<T extends Command>(command: T): T {
  return command.exitOverride();
}

export function addMissingSubcommandHandler(
  command: Command,
  program: Command,
  name: string,
): void {
  command.showHelpAfterError().action(() => {
    const options = program.opts<GlobalOptions>();

    if (options.json) {
      throw new CommanderError(
        1,
        "cli_usage_error",
        `error: missing subcommand for '${name}'`,
      );
    }

    command.help({ error: true });
  });
}

export function createIntegerParser({
  label,
  min,
}: IntegerParserOptions): (value: string) => number {
  return (value: string) => {
    if (!/^-?\d+$/u.test(value)) {
      throw new InvalidArgumentError(`${label} must be an integer`);
    }

    const parsed = Number.parseInt(value, 10);

    if (min !== undefined && parsed < min) {
      throw new InvalidArgumentError(`${label} must be at least ${min}`);
    }

    return parsed;
  };
}
