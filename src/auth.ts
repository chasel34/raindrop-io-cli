import { loadConfig, type CliConfig, type ConfigRuntime } from "./config.js";

export type AuthRuntime = ConfigRuntime & {
  env: NodeJS.ProcessEnv;
};

export type ResolvedAuth = {
  config: CliConfig;
  source: "flag" | "env" | "config" | null;
  token: string | null;
};

export async function resolveAuth(
  options: { token?: string },
  command: string,
  runtime: AuthRuntime,
): Promise<ResolvedAuth> {
  const flagToken = options.token?.trim();

  if (flagToken) {
    return {
      config: await loadConfig(runtime, command, { ignoreParseErrors: true }),
      source: "flag",
      token: flagToken,
    };
  }

  const envToken = runtime.env.RAINDROP_TOKEN?.trim();

  if (envToken) {
    return {
      config: await loadConfig(runtime, command, { ignoreParseErrors: true }),
      source: "env",
      token: envToken,
    };
  }

  const config = await loadConfig(runtime, command);

  if (config.token?.trim()) {
    return {
      config,
      source: "config",
      token: config.token.trim(),
    };
  }

  return {
    config,
    source: null,
    token: null,
  };
}
