import { join } from "node:path";

import { CliError } from "./errors.js";

export const DEFAULT_BASE_URL = "https://api.raindrop.io/rest/v1";
export const DEFAULT_TIMEOUT_MS = 10000;

export type CliConfig = {
  baseUrl: string;
  configPath: string;
  timeoutMs: number;
  token?: string;
};

export type ConfigRuntime = {
  homeDir: string;
  readFile: (path: string) => Promise<string>;
};

type ParsedConfig = Partial<Pick<CliConfig, "baseUrl" | "timeoutMs" | "token">>;

export async function loadConfig(
  runtime: ConfigRuntime,
  command: string,
  options: { ignoreParseErrors?: boolean } = {},
): Promise<CliConfig> {
  const configPath = join(runtime.homeDir, ".raindrop", "config.toml");

  try {
    const contents = await runtime.readFile(configPath);
    return {
      baseUrl: DEFAULT_BASE_URL,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      configPath,
      ...parseConfigToml(contents, command),
    };
  } catch (error) {
    if (isFileNotFound(error)) {
      return {
        baseUrl: DEFAULT_BASE_URL,
        configPath,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    }

    if (options.ignoreParseErrors && isConfigParseError(error)) {
      return {
        baseUrl: DEFAULT_BASE_URL,
        configPath,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    }

    throw error;
  }
}

export function parseConfigToml(
  contents: string,
  command: string,
): ParsedConfig {
  const parsed: ParsedConfig = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const match = /^(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.+)$/u.exec(
      line,
    );

    if (!match?.groups) {
      throw new CliError({
        code: "config_parse_error",
        command,
        message: "Invalid Raindrop config TOML",
      });
    }

    const { key } = match.groups;
    const value = stripInlineComment(match.groups.value);

    if (key === "token") {
      parsed.token = parseStringValue(value, key, command);
      continue;
    }

    if (key === "base_url") {
      parsed.baseUrl = parseStringValue(value, key, command);
      continue;
    }

    if (key === "timeout_ms") {
      parsed.timeoutMs = parseIntegerValue(value, key, command);
    }
  }

  return parsed;
}

function parseStringValue(value: string, key: string, command: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value) as string;
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  throw new CliError({
    code: "config_parse_error",
    command,
    message: `Invalid ${key} in Raindrop config`,
  });
}

function stripInlineComment(value: string): string {
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\" && inDoubleQuote) {
      escaped = true;
      continue;
    }

    if (character === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (character === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (character === "#" && !inDoubleQuote && !inSingleQuote) {
      return value.slice(0, index).trim();
    }
  }

  return value.trim();
}

function parseIntegerValue(
  value: string,
  key: string,
  command: string,
): number {
  if (!/^\d+$/u.test(value)) {
    throw new CliError({
      code: "config_parse_error",
      command,
      message: `Invalid ${key} in Raindrop config`,
    });
  }

  return Number.parseInt(value, 10);
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT",
  );
}

function isConfigParseError(error: unknown): error is CliError {
  return error instanceof CliError && error.code === "config_parse_error";
}
