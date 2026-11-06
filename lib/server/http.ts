import "server-only";
import { isAllowedOrigin } from "../request-origin";

export class HttpRequestError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export function checkOrigin(request: Request) {
  if (!isAllowedOrigin(request.url, request.headers.get("origin"), process.env.APP_ORIGIN, process.env.NODE_ENV === "development")) {
    throw new HttpRequestError("This page's address does not match the portal configuration. Open the configured portal address and try again.", 403);
  }
}
export function fail(message: string, status = 400) { return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } }); }

export async function limitedBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpRequestError("The request body is missing.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) { await reader.cancel(); throw new HttpRequestError("The request is too large.", 413); }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
