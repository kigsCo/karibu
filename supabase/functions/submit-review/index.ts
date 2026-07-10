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
import { clientIpFromXff } from "../_shared/security.ts";

const VALID_RECOMMENDATIONS = ["yes", "caveats", "no"];
const MIN_BODY_LENGTH = 40;
const RATE_LIMIT_MAX = 3; // per IP
const RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60; // 24h

// Per-user limits, from the guide's anti-abuse section. Unlike the per-IP limit
// these are bound to a verified `auth.uid()`, so no header can forge them.
const USER_REVIEWS_PER_DAY = 3;
const USER_REVIEWS_PER_BUSINESS_DAYS = 30;

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
  // The LAST x-forwarded-for hop is the one Supabase's edge appended, and is
  // the only entry a client cannot forge. Reading the first hop would let any
  // caller bypass the per-IP limit just by sending the header themselves.
  const reviewerIp = clientIpFromXff(req.headers.get("x-forwarded-for"));

  // Use the service client: rate_limits is locked down to the service role, and
  // counting a user's own reviews must not be filtered by RLS.
  const service = createServiceClient();

  // --- Rate limit, per authenticated user --------------------------------
  // Bound to auth.uid(), so it holds even if the IP is shared, rotated, or
  // spoofed. This is the load-bearing limit; the per-IP one below is a second
  // layer for a single user cycling accounts.
  const dayAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const { count: recentByUser, error: userCountErr } = await service
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("reviewer_id", reviewerId)
    .gt("created_at", dayAgo);

  if (userCountErr) {
    // Fail open on a counting outage, exactly as checkIpRateLimit does: an
    // anti-abuse layer must not take down the feature. RLS is still the backstop.
    console.error("submit-review per-user count failed (failing open):", userCountErr.message);
  } else if ((recentByUser ?? 0) >= USER_REVIEWS_PER_DAY) {
    return errorResponse("Rate limit", 429);
  }

  // One review per business per 30 days, per the guide's anti-abuse rules.
  const windowStart = new Date(
    Date.now() - USER_REVIEWS_PER_BUSINESS_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: recentForBusiness, error: bizCountErr } = await service
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("reviewer_id", reviewerId)
    .eq("business_id", business_id)
    .gt("created_at", windowStart);

  if (bizCountErr) {
    console.error("submit-review per-business count failed (failing open):", bizCountErr.message);
  } else if ((recentForBusiness ?? 0) >= 1) {
    return errorResponse(
      `You can review a business once every ${USER_REVIEWS_PER_BUSINESS_DAYS} days`,
      429,
    );
  }

  // --- Rate limit (max 3 reviews per IP per 24h) -------------------------
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
