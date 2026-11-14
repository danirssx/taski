import { TaskiError } from "../../domain/ticket.ts";

export async function jsonBody(request: Request, maximum = 1048576): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new TaskiError("INVALID_INPUT", "Content-Type must be application/json");
  }
  if (!request.body) throw new TaskiError("INVALID_INPUT", "JSON body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new TaskiError("PAYLOAD_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes)) as unknown; }
  catch { throw new TaskiError("INVALID_INPUT", "Invalid JSON"); }
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new TaskiError("ACCESS_DENIED");
}

export function errorResponse(error: unknown): Response {
  const known = error instanceof TaskiError;
  const code = known ? error.code : "INTERNAL_ERROR";
  const status = ({ AUTH_REQUIRED: 401, AUTH_FAILED: 401, ACCESS_DENIED: 403, REVIEW_REQUIRED: 403,
    NOT_FOUND: 404, VERSION_CONFLICT: 409, IDEMPOTENCY_CONFLICT: 409, PROJECT_IDENTITY_CONFLICT: 409,
    PATCH_CONFLICT: 409, INVALID_CURSOR: 400, CURSOR_EXPIRED: 409, RATE_LIMITED: 429,
    CONFIGURATION_REQUIRED: 503, PAYLOAD_TOO_LARGE: 413, INTERNAL_ERROR: 500 } as Record<string, number>)[code] ?? 400;
  return Response.json({ error: { code, message: known ? error.message : "The operation could not be confirmed" } }, {
    status, headers: { "cache-control": "no-store", ...(status === 429 ? { "retry-after": "60" } : {}) },
  });
}
