import { Command } from "commander";

import { printJson } from "../output.js";

type ExamplePayload = {
  message: string;
  project: string;
};

export function createExampleCommand(): Command {
  return new Command("example")
    .description("Run the example command")
    .option("--json", "Print JSON output")
    .action((options: { json?: boolean }) => {
      const payload: ExamplePayload = {
        message: "Raindrop CLI example is working.",
        project: "raindrop",
      };

      if (options.json) {
        printJson({
          ok: true,
          data: payload,
          meta: {
            command: "example",
          },
        });
        return;
      }

      process.stdout.write(`${payload.message}\n`);
    });
}
