import { describe, expect, it } from "vitest";

import { runCli } from "../cli.js";

describe("collections commands", () => {
  it("creates a collection", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "collections",
        "create",
        "--title",
        "Reading",
        "--parent",
        "10",
        "--public",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_collections_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe("https://api.raindrop.io/rest/v1/collection");
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_collections_token",
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          expect(JSON.parse(String(init?.body))).toEqual({
            parent: {
              $id: 10,
            },
            public: true,
            title: "Reading",
          });

          return createJsonResponse(200, {
            result: true,
            item: {
              _id: 21,
              parent: {
                $id: 10,
              },
              title: "Reading",
              public: true,
            },
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
            collection: {
              id: 21,
              parentId: 10,
              public: true,
              title: "Reading",
            },
          },
          meta: {
            command: "collections create",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("updates a collection", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "collections",
        "update",
        "21",
        "--title",
        "Long Reads",
        "--parent",
        "10",
        "--private",
        "--view",
        "list",
        "--sort",
        "1",
        "--cover",
        "https://example.com/cover.png",
        "--expanded",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_collections_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe("https://api.raindrop.io/rest/v1/collection/21");
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_collections_token",
              "Content-Type": "application/json",
            },
            method: "PUT",
          });
          expect(JSON.parse(String(init?.body))).toEqual({
            parent: {
              $id: 10,
            },
            cover: ["https://example.com/cover.png"],
            expanded: true,
            public: false,
            sort: 1,
            title: "Long Reads",
            view: "list",
          });

          return createJsonResponse(200, {
            result: true,
            item: {
              _id: 21,
              parent: {
                $id: 10,
              },
              title: "Long Reads",
              public: false,
            },
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
            collection: {
              id: 21,
              parentId: 10,
              public: false,
              title: "Long Reads",
            },
          },
          meta: {
            command: "collections update",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("deletes a collection", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "collections", "delete", "21"], {
      env: {
        RAINDROP_TOKEN: "rdt_collections_token",
      },
      fetch: async (input, init) => {
        expect(input).toBe("https://api.raindrop.io/rest/v1/collection/21");
        expect(init).toMatchObject({
          headers: {
            Authorization: "Bearer rdt_collections_token",
          },
          method: "DELETE",
        });

        return createJsonResponse(200, {
          result: true,
        });
      },
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(0);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: true,
          data: {
            deleted: {
              id: 21,
            },
          },
          meta: {
            command: "collections delete",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("deletes multiple collections", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "collections", "delete-many", "--ids", "21,22"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_collections_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe("https://api.raindrop.io/rest/v1/collections");
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_collections_token",
              "Content-Type": "application/json",
            },
            method: "DELETE",
          });
          expect(JSON.parse(String(init?.body))).toEqual({
            ids: [21, 22],
          });

          return createJsonResponse(200, {
            result: true,
            modified: 2,
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
            modified: 2,
          },
          meta: {
            command: "collections delete-many",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

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
