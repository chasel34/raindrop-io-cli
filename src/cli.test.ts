import { describe, expect, it } from "vitest";

import { runCli } from "./cli.js";

describe("runCli", () => {
  it("returns a structured auth_missing error for doctor in json mode when no token is configured", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "doctor"], {
      env: {},
      homeDir: "/tmp/raindrop-cli-test-home",
      readFile: async () => {
        const error = new Error("missing config") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(1);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "auth_missing",
            message: "Raindrop token not found",
            status: 401,
          },
          meta: {
            command: "doctor",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("returns structured json for commander usage errors when json mode is enabled", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "nope"], {
      env: {},
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(1);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "cli_usage_error",
            message: "error: unknown command 'nope'",
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

  it("returns structured json when a command is missing a required subcommand", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "user"], {
      env: {},
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(1);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "cli_usage_error",
            message: "error: missing subcommand for 'user'",
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

  it("returns structured json when `bookmarks` is missing a required subcommand", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "bookmarks"], {
      env: {},
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(1);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "cli_usage_error",
            message: "error: missing subcommand for 'bookmarks'",
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

  it("marks mandatory options as required in help output", async () => {
    const cases = [
      {
        argv: ["bookmarks", "list", "--help"],
        snippets: ["Collection ID (required)"],
      },
      {
        argv: ["bookmarks", "search", "--help"],
        snippets: ["Collection ID (required)"],
      },
      {
        argv: ["bookmarks", "suggest", "--help"],
        snippets: ["Bookmark URL (required)"],
      },
      {
        argv: ["bookmarks", "create", "--help"],
        snippets: ["Bookmark URL (required)", "Collection ID (required)"],
      },
      {
        argv: ["collections", "resolve", "--help"],
        snippets: ["Collection name or full path (required)"],
      },
    ];

    for (const testCase of cases) {
      const stdout = createBufferedWriter();
      const stderr = createBufferedWriter();

      const exitCode = await runCli(testCase.argv, {
        env: {},
        stderr: stderr.writer,
        stdout: stdout.writer,
      });

      expect(exitCode).toBe(0);

      for (const snippet of testCase.snippets) {
        expect(stdout.contents()).toContain(snippet);
      }

      expect(stderr.contents()).toBe("");
    }
  });

  it("returns doctor diagnostics when the token comes from the environment", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> =
      [];

    const exitCode = await runCli(["--json", "doctor"], {
      env: {
        RAINDROP_TOKEN: "rdt_secret_token",
      },
      fetch: async (input, init) => {
        fetchCalls.push({ input, init });
        return createJsonResponse(200, {
          result: true,
          user: {
            _id: 99,
          },
        });
      },
      homeDir: "/tmp/raindrop-cli-test-home",
      readFile: async () => {
        const error = new Error("missing config") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(0);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toMatchObject({
      input: "https://api.raindrop.io/rest/v1/user",
      init: {
        headers: {
          Authorization: "Bearer rdt_secret_token",
        },
        method: "GET",
        signal: expect.any(AbortSignal),
      },
    });
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: true,
          data: {
            auth: {
              configured: true,
              source: "env",
            },
            config: {
              baseUrl: "https://api.raindrop.io/rest/v1",
              path: "/tmp/raindrop-cli-test-home/.raindrop/config.toml",
              timeoutMs: 10000,
            },
          },
          meta: {
            command: "doctor",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stdout.contents()).not.toContain("rdt_secret_token");
    expect(stderr.contents()).toBe("");
  });

  it("returns doctor diagnostics when the token comes from the config file", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "doctor"], {
      env: {},
      fetch: async () =>
        createJsonResponse(200, {
          result: true,
          user: {
            _id: 100,
          },
        }),
      homeDir: "/tmp/raindrop-cli-config-home",
      readFile: async () => `token = "rdt_from_config"
base_url = "https://mirror.example/rest/v1"
timeout_ms = 2500
ignored_key = "ignored"
`,
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(0);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: true,
          data: {
            auth: {
              configured: true,
              source: "config",
            },
            config: {
              baseUrl: "https://mirror.example/rest/v1",
              path: "/tmp/raindrop-cli-config-home/.raindrop/config.toml",
              timeoutMs: 2500,
            },
          },
          meta: {
            command: "doctor",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stdout.contents()).not.toContain("rdt_from_config");
    expect(stderr.contents()).toBe("");
  });

  it("allows an explicit token to bypass config parse errors", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "--token", "rdt_flag_token", "doctor"],
      {
        env: {},
        fetch: async () =>
          createJsonResponse(200, {
            result: true,
            user: {
              _id: 101,
            },
          }),
        homeDir: "/tmp/raindrop-cli-bypass-config-home",
        readFile: async () => "token: broken",
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
            auth: {
              configured: true,
              source: "flag",
            },
            config: {
              baseUrl: "https://api.raindrop.io/rest/v1",
              path: "/tmp/raindrop-cli-bypass-config-home/.raindrop/config.toml",
              timeoutMs: 10000,
            },
          },
          meta: {
            command: "doctor",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("surfaces invalid doctor credentials instead of reporting success", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "doctor"], {
      env: {
        RAINDROP_TOKEN: "rdt_expired_token",
      },
      fetch: async () =>
        createJsonResponse(401, {
          result: false,
          error: "auth",
          errorMessage: "Unauthorized",
        }),
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

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
            command: "doctor",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("returns a structured config parse error when the config file is invalid", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "doctor"], {
      env: {},
      homeDir: "/tmp/raindrop-cli-bad-config-home",
      readFile: async () => "token: broken",
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(1);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "config_parse_error",
            message: "Invalid Raindrop config TOML",
          },
          meta: {
            command: "doctor",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("returns the authenticated user for `user me` in json mode", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> =
      [];

    const exitCode = await runCli(["--json", "user", "me"], {
      env: {
        RAINDROP_TOKEN: "rdt_user_token",
      },
      fetch: async (input, init) => {
        fetchCalls.push({ input, init });
        return createJsonResponse(200, {
          result: true,
          user: {
            _id: 32,
            email: "ada@example.com",
            fullName: "Ada Lovelace",
            pro: true,
          },
        });
      },
      homeDir: "/tmp/raindrop-cli-user-home",
      readFile: async () => {
        const error = new Error("missing config") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(0);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toMatchObject({
      input: "https://api.raindrop.io/rest/v1/user",
      init: {
        headers: {
          Authorization: "Bearer rdt_user_token",
        },
        method: "GET",
        signal: expect.any(AbortSignal),
      },
    });
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: true,
          data: {
            user: {
              _id: 32,
              email: "ada@example.com",
              fullName: "Ada Lovelace",
              pro: true,
            },
          },
          meta: {
            command: "user me",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stdout.contents()).not.toContain("rdt_user_token");
    expect(stderr.contents()).toBe("");
  });

  it("times out API requests using the configured timeout", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "user", "me"], {
      env: {
        RAINDROP_TOKEN: "rdt_user_token",
      },
      fetch: async (_input, init) => {
        const signal = init?.signal;

        await new Promise((_, reject) => {
          if (!signal) {
            reject(new Error("missing signal"));
            return;
          }

          if (signal.aborted) {
            reject(signal.reason);
            return;
          }

          signal.addEventListener(
            "abort",
            () => {
              reject(signal.reason);
            },
            { once: true },
          );
        });

        return createJsonResponse(200, {});
      },
      homeDir: "/tmp/raindrop-cli-timeout-home",
      readFile: async () => `timeout_ms = 1`,
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(1);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "network_timeout",
            message: "Raindrop API request timed out",
          },
          meta: {
            command: "user me",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("preserves the current command in config parse errors outside doctor", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "user", "me"], {
      env: {},
      homeDir: "/tmp/raindrop-cli-user-bad-config-home",
      readFile: async () => "token: broken",
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(1);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "config_parse_error",
            message: "Invalid Raindrop config TOML",
          },
          meta: {
            command: "user me",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("accepts inline comments in config values", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(["--json", "doctor"], {
      env: {},
      fetch: async () =>
        createJsonResponse(200, {
          result: true,
          user: {
            _id: 102,
          },
        }),
      homeDir: "/tmp/raindrop-cli-commented-config-home",
      readFile: async () => `token = "rdt_from_config" # personal token
base_url = "https://mirror.example/rest/v1" # mirror
timeout_ms = 2500 # milliseconds
`,
      stderr: stderr.writer,
      stdout: stdout.writer,
    });

    expect(exitCode).toBe(0);
    expect(stdout.contents()).toBe(
      `${JSON.stringify(
        {
          ok: true,
          data: {
            auth: {
              configured: true,
              source: "config",
            },
            config: {
              baseUrl: "https://mirror.example/rest/v1",
              path: "/tmp/raindrop-cli-commented-config-home/.raindrop/config.toml",
              timeoutMs: 2500,
            },
          },
          meta: {
            command: "doctor",
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
