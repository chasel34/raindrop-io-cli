import { describe, expect, it } from "vitest";

import { runCli } from "../cli.js";

describe("tags commands", () => {
  it("lists tags for a collection in json mode", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "tags", "list", "--collection", "123"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_tags_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe("https://api.raindrop.io/rest/v1/tags/123");
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_tags_token",
            },
            method: "GET",
          });

          return createJsonResponse(200, {
            result: true,
            items: [
              {
                _id: "typescript",
                count: 4,
              },
              {
                _id: "performance",
                count: 2,
              },
            ],
          });
        },
        stderr: stderr.writer,
        stdout: stdout.writer,
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: true,
          data: {
            items: [
              {
                count: 4,
                title: "typescript",
              },
              {
                count: 2,
                title: "performance",
              },
            ],
          },
          meta: {
            command: "tags list",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });
});

function createBufferedWriter() {
  let buffer = "";

  return {
    writer: {
      write(chunk: string) {
        buffer += chunk;
        return true;
      },
    },
    contents() {
      return buffer;
    },
  };
}

function createJsonResponse(status: number, payload: unknown): Response {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}
