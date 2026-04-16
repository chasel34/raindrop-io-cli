import { describe, expect, it } from "vitest";

import { runCli } from "../cli.js";

describe("bookmarks commands", () => {
  it("lists bookmarks with stable pagination metadata", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "bookmarks", "list", "--collection", "0", "--limit", "20"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe(
            "https://api.raindrop.io/rest/v1/raindrops/0?page=0&perpage=50",
          );
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_bookmarks_token",
            },
            method: "GET",
          });

          return createJsonResponse(200, {
            result: true,
            items: [
              {
                _id: 101,
                collection: {
                  $id: 0,
                },
                link: "https://example.com",
                tags: ["typescript"],
                title: "Example",
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
                collectionId: 0,
                id: 101,
                tags: ["typescript"],
                title: "Example",
                url: "https://example.com",
              },
            ],
          },
          meta: {
            command: "bookmarks list",
            pagination: {
              hasMore: false,
              page: 0,
              perPage: 20,
              returned: 1,
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("passes raw search syntax through to the bookmarks search endpoint", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "search",
        "typescript #performance",
        "--collection",
        "0",
        "--limit",
        "20",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async (input) => {
          expect(input).toBe(
            "https://api.raindrop.io/rest/v1/raindrops/0?page=0&perpage=50&search=typescript+%23performance",
          );

          return createJsonResponse(200, {
            result: true,
            items: [],
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
            items: [],
          },
          meta: {
            command: "bookmarks search",
            pagination: {
              hasMore: false,
              page: 0,
              perPage: 20,
              returned: 0,
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("preserves requested limits above the API page size", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();
    const fetchCalls: string[] = [];

    const exitCode = await runCli(
      ["--json", "bookmarks", "list", "--collection", "0", "--limit", "60"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async (input) => {
          const url = String(input);
          fetchCalls.push(url);

          if (
            url ===
            "https://api.raindrop.io/rest/v1/raindrops/0?page=0&perpage=50"
          ) {
            return createJsonResponse(200, {
              result: true,
              items: createBookmarkItems(1, 50),
            });
          }

          if (
            url ===
            "https://api.raindrop.io/rest/v1/raindrops/0?page=1&perpage=50"
          ) {
            return createJsonResponse(200, {
              result: true,
              items: createBookmarkItems(51, 10),
            });
          }

          throw new Error(`Unexpected URL: ${url}`);
        },
        stderr: stderr.writer,
        stdout: stdout.writer,
      },
    );

    expect(exitCode).toBe(0);
    expect(fetchCalls).toEqual([
      "https://api.raindrop.io/rest/v1/raindrops/0?page=0&perpage=50",
      "https://api.raindrop.io/rest/v1/raindrops/0?page=1&perpage=50",
    ]);

    const payload = JSON.parse(stdout.contents()) as {
      data: {
        items: Array<{ id: number }>;
      };
      meta: {
        pagination: {
          hasMore: boolean;
          page: number;
          perPage: number;
          returned: number;
        };
      };
      ok: boolean;
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.items).toHaveLength(60);
    expect(payload.data.items[0]?.id).toBe(1);
    expect(payload.data.items[59]?.id).toBe(60);
    expect(payload.meta.pagination).toEqual({
      hasMore: false,
      page: 0,
      perPage: 60,
      returned: 60,
    });
    expect(stderr.contents()).toBe("");
  });

  it("fetches a single bookmark by id", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "bookmarks", "get", "42"], {
      env: {
        RAINDROP_TOKEN: "rdt_bookmarks_token",
      },
      fetch: async (input) => {
        expect(input).toBe("https://api.raindrop.io/rest/v1/raindrop/42");

        return createJsonResponse(200, {
          result: true,
          item: {
            _id: 42,
            collection: {
              $id: -1,
            },
            link: "https://example.com/post",
            tags: ["reading"],
            title: "Example Post",
          },
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
            bookmark: {
              collectionId: -1,
              id: 42,
              tags: ["reading"],
              title: "Example Post",
              url: "https://example.com/post",
            },
          },
          meta: {
            command: "bookmarks get",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("suggests collections and tags for a URL", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "bookmarks", "suggest", "--url", "https://example.com"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe(
            "https://api.raindrop.io/rest/v1/raindrop/suggest",
          );
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_bookmarks_token",
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          expect(JSON.parse(String(init?.body))).toEqual({
            link: "https://example.com",
          });

          return createJsonResponse(200, {
            result: true,
            item: {
              collections: [{ $id: 12 }, { $id: 18 }],
              tags: ["engineering", "tools"],
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
            suggestion: {
              collections: [12, 18],
              tags: ["engineering", "tools"],
            },
          },
          meta: {
            command: "bookmarks suggest",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("returns a structured Pro-only error for bookmark suggestions", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "bookmarks", "suggest", "--url", "https://example.com"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async () =>
          createJsonResponse(403, {
            result: false,
            errorMessage: "pro only",
          }),
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
            code: "feature_requires_pro",
            message: "bookmarks suggest requires a Raindrop Pro account",
            status: 403,
          },
          meta: {
            command: "bookmarks suggest",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("creates a bookmark and requests server-side parsing when --parse is provided", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "create",
        "--url",
        "https://example.com",
        "--collection",
        "-1",
        "--title",
        "Example",
        "--tags",
        "a,b",
        "--parse",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe("https://api.raindrop.io/rest/v1/raindrop");
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_bookmarks_token",
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          expect(JSON.parse(String(init?.body))).toEqual({
            collection: {
              $id: -1,
            },
            link: "https://example.com",
            pleaseParse: {},
            tags: ["a", "b"],
            title: "Example",
          });

          return createJsonResponse(200, {
            result: true,
            item: {
              _id: 77,
              collection: {
                $id: -1,
              },
              link: "https://example.com",
              tags: ["a", "b"],
              title: "Example",
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
            bookmark: {
              collectionId: -1,
              id: 77,
              tags: ["a", "b"],
              title: "Example",
              url: "https://example.com",
            },
          },
          meta: {
            command: "bookmarks create",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("updates a bookmark", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "update",
        "77",
        "--url",
        "https://example.com/updated",
        "--title",
        "Updated",
        "--collection",
        "10",
        "--clear-tags",
        "--important",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe("https://api.raindrop.io/rest/v1/raindrop/77");
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_bookmarks_token",
              "Content-Type": "application/json",
            },
            method: "PUT",
          });
          expect(JSON.parse(String(init?.body))).toEqual({
            collection: {
              $id: 10,
            },
            important: true,
            link: "https://example.com/updated",
            tags: [],
            title: "Updated",
          });

          return createJsonResponse(200, {
            result: true,
            item: {
              _id: 77,
              collection: {
                $id: 10,
              },
              link: "https://example.com/updated",
              tags: [],
              title: "Updated",
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
            bookmark: {
              collectionId: 10,
              id: 77,
              tags: [],
              title: "Updated",
              url: "https://example.com/updated",
            },
          },
          meta: {
            command: "bookmarks update",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("deletes a bookmark", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "bookmarks", "delete", "77"], {
      env: {
        RAINDROP_TOKEN: "rdt_bookmarks_token",
      },
      fetch: async (input, init) => {
        expect(input).toBe("https://api.raindrop.io/rest/v1/raindrop/77");
        expect(init).toMatchObject({
          headers: {
            Authorization: "Bearer rdt_bookmarks_token",
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
              id: 77,
            },
          },
          meta: {
            command: "bookmarks delete",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("updates multiple bookmarks by ids", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "update-many",
        "--collection",
        "10",
        "--ids",
        "77,78",
        "--tags",
        "a,b",
        "--move-to",
        "11",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe("https://api.raindrop.io/rest/v1/raindrops/10");
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_bookmarks_token",
              "Content-Type": "application/json",
            },
            method: "PUT",
          });
          expect(JSON.parse(String(init?.body))).toEqual({
            collection: {
              $id: 11,
            },
            ids: [77, 78],
            tags: ["a", "b"],
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
            command: "bookmarks update-many",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("deletes multiple bookmarks by search query", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "delete-many",
        "--collection",
        "10",
        "--search",
        "#stale",
        "--nested",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe(
            "https://api.raindrop.io/rest/v1/raindrops/10?search=%23stale&nested=true",
          );
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_bookmarks_token",
            },
            method: "DELETE",
          });
          expect(init?.body).toBeUndefined();

          return createJsonResponse(200, {
            result: true,
            modified: 4,
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
            modified: 4,
          },
          meta: {
            command: "bookmarks delete-many",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("rejects collection 0 for batch bookmark updates", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "update-many",
        "--collection",
        "0",
        "--ids",
        "77",
        "--tags",
        "a",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async () => {
          throw new Error("fetch should not be called");
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
            code: "bookmark_collection_unsupported",
            message:
              "Batch bookmark update and delete do not support collection 0",
          },
          meta: {
            command: "bookmarks update-many",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("rejects invalid bookmark URLs before calling the API", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "create",
        "--url",
        "not-a-url",
        "--collection",
        "-1",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async () => {
          throw new Error("fetch should not be called");
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
            code: "bookmark_url_invalid",
            message: "Bookmark URL must be a valid absolute URL",
          },
          meta: {
            command: "bookmarks create",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("surfaces 401 API errors during bookmark creation", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "create",
        "--url",
        "https://example.com",
        "--collection",
        "-1",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async () =>
          createJsonResponse(401, {
            result: false,
            error: "auth",
            errorMessage: "Unauthorized",
          }),
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
            code: "auth",
            message: "Unauthorized",
            status: 401,
          },
          meta: {
            command: "bookmarks create",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("surfaces 429 API errors during bookmark creation", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      [
        "--json",
        "bookmarks",
        "create",
        "--url",
        "https://example.com",
        "--collection",
        "-1",
      ],
      {
        env: {
          RAINDROP_TOKEN: "rdt_bookmarks_token",
        },
        fetch: async () =>
          createJsonResponse(429, {
            result: false,
            error: "rate_limited",
            errorMessage: "Too Many Requests",
          }),
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
            code: "rate_limited",
            message: "Too Many Requests",
            status: 429,
          },
          meta: {
            command: "bookmarks create",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("rejects malformed collection ids before running `bookmarks list`", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "bookmarks", "list", "--collection", "abc"],
      {
        env: {},
        fetch: async () => {
          throw new Error("fetch should not be called");
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
            code: "cli_usage_error",
            message:
              "error: option '--collection <id>' argument 'abc' is invalid. Collection ID must be an integer",
          },
          meta: {
            command: "raindrop",
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

function createBookmarkItems(startId: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index;

    return {
      _id: id,
      collection: {
        $id: 0,
      },
      link: `https://example.com/${id}`,
      tags: [],
      title: `Bookmark ${id}`,
    };
  });
}
