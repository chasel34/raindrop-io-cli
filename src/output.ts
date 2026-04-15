export type OutputWriter = {
  write(chunk: string): unknown;
};

export type JsonEnvelope<T> =
  | {
      ok: true;
      data: T;
      meta: JsonMeta;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        status?: number;
      };
      meta: JsonMeta;
    };

export type JsonMeta = {
  command: string;
  pagination?: {
    hasMore: boolean;
    page: number;
    perPage: number;
    returned: number;
  };
};

export function printJson<T>(
  writer: OutputWriter,
  payload: JsonEnvelope<T>,
): void {
  writer.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function printLine(writer: OutputWriter, line: string): void {
  writer.write(`${line}\n`);
}
