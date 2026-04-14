import { Command } from "commander";

import { createExampleCommand } from "./commands/example.js";

export function createCli(): Command {
  const program = new Command();

  program.name("raindrop").description("CLI for Raindrop.io").version("0.1.0");

  program.addCommand(createExampleCommand());

  return program;
}
