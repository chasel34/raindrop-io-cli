import { describe, expect, it } from "vitest";

import { runCli } from "../cli.js";

describe("collections commands", () => {
  it("lists collections as a nested tree in json mode", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> =
      [];

    const exitCode = await runCli(["--json", "collections", "list", "--tree"], {
      env: {
        RAINDROP_TOKEN: "rdt_collections_token",
      },
      fetch: async (input, init) => {
        fetchCalls.push({ input, init });

        if (input === "https://api.raindrop.io/rest/v1/collections") {
          return createJsonResponse(200, {
            result: true,
            items: [
              {
                _id: 10,
                title: "Research",
              },
            ],
          });
        }

        if (input === "https://api.raindrop.io/rest/v1/collections/childrens") {
          return createJsonResponse(200, {
            result: true,
            items: [
              {
                _id: 11,
                title: "AI",
                parent: {
                  $id: 10,
                },
              },
            ],
          });
        }

        throw new Error(`Unexpected URL: ${String(input)}`);
      },
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(0);
    expect(fetchCalls).toHaveLength(2);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: true,
          data: {
            items: [
              {
                children: [
                  {
                    children: [],
                    id: 11,
                    parentId: 10,
                    path: "Research/AI",
                    title: "AI",
                  },
                ],
                id: 10,
                parentId: null,
                path: "Research",
                title: "Research",
              },
            ],
          },
          meta: {
            command: "collections list",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("returns a structured error when collection resolution is ambiguous", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "collections", "resolve", "--name", "Research"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_collections_token",
        },
        fetch: async (input) => {
          if (input === "https://api.raindrop.io/rest/v1/collections") {
            return createJsonResponse(200, {
              result: true,
              items: [
                {
                  _id: 10,
                  title: "Research",
                },
              ],
            });
          }

          if (
            input === "https://api.raindrop.io/rest/v1/collections/childrens"
          ) {
            return createJsonResponse(200, {
              result: true,
              items: [
                {
                  _id: 11,
                  title: "Research",
                  parent: {
                    $id: 10,
                  },
                },
              ],
            });
          }

          throw new Error(`Unexpected URL: ${String(input)}`);
        },
        stderr: stderr.writer,
        stdout: stdout.writer,
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "collection_ambiguous",
            message:
              "Multiple collections match 'Research'; refine the name or use a full path",
          },
          meta: {
            command: "collections resolve",
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
