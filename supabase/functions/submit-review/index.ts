// submit-review — accept a user review, rate-limit it, queue it for moderation.
//
// A review is never published directly: it lands as 'pending_moderation' and
// the hourly moderate-reviews cron decides. This function's job is validation
// + abuse control. RLS also enforces reviewer_id = auth.uid() as a backstop.
//
// verify_jwt = true (only logged-in users may review; the platform guarantees a
// valid JWT before we run, and we read the uid from it via the user client).

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient, createUserClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { checkIpRateLimit } from "../_shared/ratelimit.ts";

const VALID_RECOMMENDATIONS = ["yes", "caveats", "no"];
const MIN_BODY_LENGTH = 40;
const RATE_LIMIT_MAX = 3; // per IP
const RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60; // 24h

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // --- Parse body --------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const {
    business_id,
    reviewer_name,
    reviewer_country,
    reviewer_type,
    rating,
    body: reviewBody,
    service_used,
    recommendation,
    reviewer_fingerprint,
  } = body as {
    business_id?: string;
    reviewer_name?: string;
    reviewer_country?: string;
    reviewer_type?: string;
    rating?: number;
    body?: string;
    service_used?: string;
    recommendation?: string;
    reviewer_fingerprint?: string;
  };

  // --- Validate ----------------------------------------------------------
  if (!business_id || typeof business_id !== "string") {
    return errorResponse("`business_id` is required", 400);
  }
  if (!reviewer_name || typeof reviewer_name !== "string") {
    return errorResponse("`reviewer_name` is required", 400);
  }
  if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return errorResponse("`rating` must be an integer 1-5", 400);
  }
  if (typeof reviewBody !== "string" || reviewBody.trim().length < MIN_BODY_LENGTH) {
    return errorResponse(`Review must be at least ${MIN_BODY_LENGTH} characters`, 400);
  }
  if (!recommendation || !VALID_RECOMMENDATIONS.includes(recommendation)) {
    return errorResponse("`recommendation` must be one of yes|caveats|no", 400);
  }

  // --- Identify the reviewer (from the verified JWT) ---------------------
  const userClient = createUserClient(req);
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) {
    return errorResponse("Not authenticated", 401);
  }
  const reviewerId = userData.user.id;

  // --- Derive reviewer IP for anti-abuse ---------------------------------
  // x-forwarded-for may be a comma-separated list; the first hop is the client.
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const reviewerIp = forwardedFor.split(",")[0].trim() || "0.0.0.0";

  // --- Rate limit (max 3 reviews per IP per 24h) -------------------------
  // Use the service client: rate_limits is locked down to the service role.
  const service = createServiceClient();
  const allowed = await checkIpRateLimit(
    service,
    reviewerIp,
    "submit-review",
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!allowed) {
    return errorResponse("Rate limit", 429);
  }

  // --- Insert (as the user, so RLS validates ownership) ------------------
  const { error: insertError } = await userClient.from("reviews").insert({
    business_id,
    reviewer_id: reviewerId,
    reviewer_name,
    reviewer_country: reviewer_country ?? null,
    reviewer_type: reviewer_type ?? null,
    rating,
    body: reviewBody,
    service_used: service_used ?? null,
    recommendation,
    status: "pending_moderation",
    reviewer_ip: reviewerIp,
    reviewer_fingerprint: reviewer_fingerprint ?? null,
  });

  if (insertError) {
    console.error("submit-review insert failed:", insertError.message);
    return errorResponse("Could not save review", 500);
  }

  return json({ ok: true, status: "pending_moderation" });
});
