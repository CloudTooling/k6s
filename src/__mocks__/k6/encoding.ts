export const b64encode = jest.fn(
  (input: string | ArrayBuffer, _encoding?: string): string => {
    if (typeof input === 'string') {
      return Buffer.from(input).toString('base64url');
    }
    return Buffer.from(new Uint8Array(input as ArrayBuffer)).toString('base64url');
  },
);

export const b64decode = jest.fn(
  (input: string, _encoding?: string, _format?: string): ArrayBuffer => {
    const buf = Buffer.from(input, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  },
);
