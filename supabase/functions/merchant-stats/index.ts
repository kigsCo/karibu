// merchant-stats — the owner-only stats the client cannot safely read
// itself: the mv_business_review_stats row (RLS does not apply to
// materialized views, so it is never client-granted), a LIVE
// pending-moderation count (owners cannot read pending reviews under RLS,
// and the MV copy is up to a day stale), and a monthly rating trend.
//
// verify_jwt = true authenticates the caller; AUTHORIZATION is the
// owner_id check against the business row. Headline rating and total
// review count are cached on the businesses row the owner already reads —
// deliberately not served here.

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient, createUserClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { bucketMonthlyRatings } from "./trend.ts";

const TREND_FETCH_CAP = 1000;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const businessId = typeof body.business_id === "string" ? body.business_id : null;
  if (!businessId) return errorResponse("`business_id` is required", 400);

  const userClient = createUserClient(req);
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) return errorResponse("Not authenticated", 401);

  const service = createServiceClient();
  const { data: bizRows, error: bizError } = await service
    .from("businesses").select("id, owner_id").eq("id", businessId);
  if (bizError) {
    console.error("merchant-stats: business lookup failed:", bizError.message);
    return errorResponse("Could not load stats", 500);
  }
  const biz = bizRows?.[0];
  if (!biz) return errorResponse("Business not found", 404);
  if (biz.owner_id !== userData.user.id) return errorResponse("Not your listing", 403);

  const { data: mvRows, error: mvError } = await service
    .from("mv_business_review_stats")
    .select("reviews_30d, five_star, one_star")
    .eq("business_id", businessId);
  if (mvError) console.error("merchant-stats: MV read failed:", mvError.message);
  const mv = mvRows?.[0] ?? null;

  const { count: pending, error: pendingError } = await service
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "pending_moderation");
  if (pendingError) console.error("merchant-stats: pending count failed:", pendingError.message);

  const { data: ratingRows, error: trendError } = await service
    .from("reviews")
    .select("rating, created_at")
    .eq("business_id", businessId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(TREND_FETCH_CAP);
  if (trendError) console.error("merchant-stats: trend fetch failed:", trendError.message);

  return json({
    reviews_30d: mv?.reviews_30d ?? 0,
    five_star: mv?.five_star ?? 0,
    one_star: mv?.one_star ?? 0,
    pending_moderation: pending ?? 0,
    trend: bucketMonthlyRatings(ratingRows ?? []),
  });
});
