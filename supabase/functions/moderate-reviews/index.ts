// moderate-reviews — CRON, hourly (0 * * * *).
//
// Pulls a batch of pending_moderation reviews and asks Claude to classify each
// on five abuse axes. Clean reviews are published; anything flagged is held for
// a human. This is heavy/batch work and runs OFF the request path (CLAUDE.md).
//
// verify_jwt = false — scheduler-invoked with the service role. There is no end
// user, so we use the service client and process sequentially (gentle on the
// Anthropic rate limit; at hourly cadence throughput is a non-issue).

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const BATCH_SIZE = 50;

interface Classification {
  authentic: boolean;
  off_topic: boolean;
  hate_speech: boolean;
  promotional: boolean;
  coordinated: boolean;
  reasoning: string;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return errorResponse("Server misconfigured", 500);

  const supabase = createServiceClient();

  // Pull pending reviews joined to their business name + category slug.
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select(
      "id, rating, body, recommendation, reviewer_country, business:businesses ( name, category:categories ( slug ) )",
    )
    .eq("status", "pending_moderation")
    .limit(BATCH_SIZE);

  if (error) {
    console.error("moderate-reviews fetch failed:", error.message);
    return errorResponse("Could not load reviews", 500);
  }

  const queue = reviews ?? [];
  let published = 0;
  let flagged = 0;
  let errors = 0;

  // Process sequentially; tolerate per-row errors so one bad row can't stall
  // the whole batch (it stays pending and is retried next hour).
  for (const review of queue) {
    try {
      // deno-lint-ignore no-explicit-any
      const business = (review as any).business ?? {};
      const businessName = business?.name ?? "Unknown";
      const businessCategory = business?.category?.slug ?? "unknown";

      const prompt =
        `Classify the following Karibu review on five axes. Return ONLY valid JSON with these exact keys, no other text:\n{\n "authentic": boolean,\n "off_topic": boolean,\n "hate_speech": boolean,\n "promotional": boolean,\n "coordinated": boolean,\n "reasoning": "string"\n}\nBusiness: ${businessName} (${businessCategory})\nReviewer country: ${review.reviewer_country}\nRating: ${review.rating}/5\nRecommendation: ${review.recommendation}\nReview body:\n"${review.body}"`;

      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        console.error(`Anthropic error for review ${review.id}:`, res.status, await res.text());
        errors++;
        continue; // leave pending; retry next run
      }

      const data = await res.json();
      const text: string = data?.content?.[0]?.text ?? "";
      const verdict = parseClassification(text);
      if (!verdict) {
        console.error(`Could not parse classification for review ${review.id}:`, text);
        errors++;
        continue;
      }

      const clean = verdict.authentic &&
        !verdict.off_topic &&
        !verdict.hate_speech &&
        !verdict.promotional &&
        !verdict.coordinated;

      if (clean) {
        const { error: upErr } = await supabase
          .from("reviews")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            moderation_notes: verdict.reasoning,
          })
          .eq("id", review.id);
        if (upErr) {
          console.error(`publish update failed for ${review.id}:`, upErr.message);
          errors++;
          continue;
        }
        published++;
      } else {
        const { error: upErr } = await supabase
          .from("reviews")
          .update({
            status: "flagged",
            flagged_at: new Date().toISOString(),
            moderation_notes: verdict.reasoning,
          })
          .eq("id", review.id);
        if (upErr) {
          console.error(`flag update failed for ${review.id}:`, upErr.message);
          errors++;
          continue;
        }
        flagged++;
        // TODO: notify the moderation team via Slack (incoming webhook) so a
        // human can review flagged content promptly.
      }
    } catch (e) {
      console.error(`moderate-reviews row error:`, e);
      errors++;
    }
  }

  return json({ ok: true, processed: queue.length, published, flagged, errors });
});

/**
 * Parse the model's reply into a Classification. The prompt demands JSON-only,
 * but we defensively extract the first {...} block in case of stray prose.
 */
function parseClassification(text: string): Classification | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;
    const obj = JSON.parse(text.slice(start, end + 1));
    if (
      typeof obj.authentic === "boolean" &&
      typeof obj.off_topic === "boolean" &&
      typeof obj.hate_speech === "boolean" &&
      typeof obj.promotional === "boolean" &&
      typeof obj.coordinated === "boolean"
    ) {
      return {
        authentic: obj.authentic,
        off_topic: obj.off_topic,
        hate_speech: obj.hate_speech,
        promotional: obj.promotional,
        coordinated: obj.coordinated,
        reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
      };
    }
    return null;
  } catch {
    return null;
  }
}
