import { describe, expect, it } from "vitest";

import { runCli } from "../cli.js";

describe("request commands", () => {
  it("wraps raw GET responses in the standard envelope", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "request", "get", "/rest/v1/user"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_request_token",
        },
        fetch: async (input, init) => {
          expect(input).toBe("https://api.raindrop.io/rest/v1/user");
          expect(init).toMatchObject({
            headers: {
              Authorization: "Bearer rdt_request_token",
            },
            method: "GET",
          });

          return createJsonResponse(200, {
            result: true,
            user: {
              _id: 32,
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
            payload: {
              result: true,
              user: {
                _id: 32,
              },
            },
          },
          meta: {
            command: "request get",
          },
        },
        null,
        2,
      )}\n`,
    );
    expect(stderr.contents()).toBe("");
  });

  it("rejects absolute raw request URLs", async () => {
    const stdout = createBufferedWriter();
    const stderr = createBufferedWriter();

    const exitCode = await runCli(
      ["--json", "request", "get", "https://api.raindrop.io/rest/v1/user"],
      {
        env: {
          RAINDROP_TOKEN: "rdt_request_token",
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
            code: "request_invalid_path",
            message:
              "Raw request path must be relative to the Raindrop API base URL",
          },
          meta: {
            command: "request get",
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
