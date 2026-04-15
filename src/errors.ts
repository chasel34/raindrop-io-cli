export type CliErrorOptions = {
  code: string;
  command: string;
  exitCode?: number;
  message: string;
  status?: number;
};

export class CliError extends Error {
  readonly code: string;
  readonly command: string;
  readonly exitCode: number;
  readonly status?: number;

  constructor({
    code,
    command,
    exitCode = 1,
    message,
    status,
  }: CliErrorOptions) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.command = command;
    this.exitCode = exitCode;
    this.status = status;
  }
}

export function toCliError(
  error: unknown,
  fallback: Pick<CliErrorOptions, "command">,
): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof Error) {
    return new CliError({
      code: "internal_error",
      command: fallback.command,
      message: error.message,
    });
  }

  return new CliError({
    code: "internal_error",
    command: fallback.command,
    message: "Unknown CLI error",
  });
}
