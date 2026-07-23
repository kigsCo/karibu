// src/lib/functionError.js
// Extract the server's { error } body from a failed supabase.functions.invoke.
// Non-2xx responses surface as FunctionsHttpError whose .context is the raw
// Response — the generic .message hides the function's real message.
export async function functionErrorMessage(fnError, fallback) {
  try {
    const body = await fnError?.context?.json();
    if (body?.error) return body.error;
  } catch {
    // unreadable body — fall through
  }
  return fnError?.message || fallback;
}
