/**
 * Extract a useful error message from a Supabase Functions invoke() error.
 *
 * In many cases the thrown error is a FunctionsHttpError with a Response in `error.context`.
 * This helper attempts to read the response body (JSON/text) and returns a human-friendly message.
 */
export async function getInvokeErrorMessage(error: any): Promise<string> {
  if (!error) return "Unknown error";

  const baseMessage = typeof error?.message === "string" ? error.message : String(error);

  // FunctionsHttpError stores the Response object in `context`
  const ctx = error?.context;
  const looksLikeResponse = ctx && typeof ctx === "object" && typeof ctx.status === "number" && typeof ctx.headers?.get === "function";

  if (!looksLikeResponse) return baseMessage;

  const res = ctx as Response;

  try {
    const status = res.status;
    const contentType = (res.headers.get("content-type") || "").toLowerCase();

    // Clone so we don't consume the original stream (safer if something else reads it later)
    const text = await res.clone().text();

    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text);
        const msg = json?.error || json?.message || json?.details || text;
        return `${msg} (HTTP ${status})`;
      } catch {
        return `${text || baseMessage} (HTTP ${status})`;
      }
    }

    // Non-JSON body
    const cleaned = (text || baseMessage).trim();
    return `${cleaned} (HTTP ${status})`;
  } catch {
    return baseMessage;
  }
}
