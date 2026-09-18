import "server-only";

export function checkOrigin(request: Request) {
  const allowed = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== allowed) throw new Error("Please submit this form from the recruitment website.");
}
export function fail(message: string, status = 400) { return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } }); }

export async function limitedBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("The request body is missing.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) { await reader.cancel(); throw new Error("The request is too large."); }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
