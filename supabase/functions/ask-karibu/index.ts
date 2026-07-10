// ask-karibu — the "warm local guide" chat endpoint.
//
// Why this exists: the prototype called the Anthropic API directly from the
// browser with the key in a VITE_* var (a NON-NEGOTIABLE guardrail violation,
// CLAUDE.md). This function is the server-side proxy. The browser sends the
// chat; this function holds ANTHROPIC_API_KEY and grounds every reply in the
// verified directory so the model can't recommend businesses we haven't vetted.
//
// verify_jwt = false (public — no login needed to chat).

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // --- Parse & validate input -------------------------------------------
  let body: {
    messages?: unknown;
    city?: string;
    sessionId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { messages, city = "nairobi", sessionId } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse("`messages` must be a non-empty array", 400);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return errorResponse("Server misconfigured", 500);

  const supabase = createServiceClient();

  // --- Fetch the verified directory (top 40 active by ranking) ----------
  const { data: businesses, error: dbError } = await supabase
    .from("businesses")
    .select("id, name, hood, category_id, price_range, rating, tier, about, tags")
    .eq("status", "active")
    .order("ranking_score", { ascending: false })
    .limit(40);

  if (dbError) {
    console.error("ask-karibu directory fetch failed:", dbError.message);
    return errorResponse("Could not load the directory", 500);
  }

  const list = businesses ?? [];

  // Build the grounding directory string.
  const directory = list
    .map(
      (b) =>
        `- ${b.name} (${b.hood}) — ${b.about?.slice(0, 80) ?? ""}, ${b.price_range}, ${b.rating}★ ${b.tier === "recommended" ? "· Karibu Recommended" : ""}`,
    )
    .join("\n");

  const systemPrompt =
    `You are Karibu, a warm local guide for visitors to ${city}. Only recommend businesses from this verified directory:\n${directory}\nWhen asked about something not in the directory, say so honestly and suggest browsing the broader category in the app. Keep replies under 120 words. Natural prose. No markdown lists.`;

  // --- Call Anthropic ----------------------------------------------------
  const anthropicRes = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!anthropicRes.ok) {
    const text = await anthropicRes.text();
    console.error("Anthropic error:", anthropicRes.status, text);
    return errorResponse(text, 502);
  }

  const result = await anthropicRes.json();

  // --- Fire-and-forget conversation log (must NOT block the response) ----
  // Per CLAUDE.md: logging is async; never await it on the request path.
  if (sessionId) {
    void supabase
      .from("ai_conversations")
      .insert({
        session_id: sessionId,
        city_slug: city,
        messages_json: messages,
        business_ids_returned: list.map((b) => b.id),
      })
      .then(({ error }) => {
        if (error) console.error("ai_conversations log failed:", error.message);
      });
  }

  return json(result);
});
