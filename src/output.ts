export type JsonEnvelope<T> =
  | {
      ok: true;
      data: T;
      meta: {
        command: string;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
      meta: {
        command: string;
      };
    };

export function printJson<T>(payload: JsonEnvelope<T>): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
