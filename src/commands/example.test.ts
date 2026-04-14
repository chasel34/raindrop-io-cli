import { describe, expect, it, vi } from "vitest";

import { createExampleCommand } from "./example.js";

describe("example command", () => {
  it("prints human-readable output by default", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const command = createExampleCommand();

    await command.parseAsync(["node", "example"], { from: "node" });

    expect(writeSpy).toHaveBeenCalledWith("Raindrop CLI example is working.\n");
    writeSpy.mockRestore();
  });

  it("prints stable json output with --json", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const command = createExampleCommand();

    await command.parseAsync(["node", "example", "--json"], { from: "node" });

    expect(writeSpy).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          ok: true,
          data: {
            message: "Raindrop CLI example is working.",
            project: "raindrop",
          },
          meta: {
            command: "example",
          },
        },
        null,
        2,
      )}\n`,
    );
    writeSpy.mockRestore();
  });
});
