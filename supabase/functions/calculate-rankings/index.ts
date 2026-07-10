// calculate-rankings — CRON, nightly at 03:00 EAT (00:00 UTC, 0 0 * * *).
//
// Recomputes ranking_score for every active business, then runs the
// improvement-window maintenance helpers and refreshes the analytics MVs.
// Heavy/batch — runs in the low-traffic window, off the request path (CLAUDE.md).
//
// verify_jwt = false — scheduler-invoked with the service role.
//
// ---------------------------------------------------------------------------
// RANKING FORMULA (documented here; the source of truth for the algorithm)
// ---------------------------------------------------------------------------
//   ranking_score =
//       0.35 * rating_z              -- quality vs. category peers (z-score)
//     + 0.20 * review_volume_log     -- trust from volume, log-damped
//     + 0.15 * recency               -- recent activity vs. category peak
//     + 0.15 * verification_bonus    -- 0 free / 0.5 verified / 1.0 recommended
//     + 0.10 * engagement            -- 0 for now (no profile_views column yet)
//     + 0.05 * tier_modifier         -- recommended ? 0.1 : 0
//
//   where
//     rating_z           = (rating - rating_mean) / NULLIF(rating_stddev, 0)
//     review_volume_log  = log10(1 + review_count)
//     recency            = recent_review_count_30d / NULLIF(max_recent_in_category, 0)
//     verification_bonus = { free: 0, verified: 0.5, recommended: 1.0 }
//     engagement         = 0          -- TODO: derive from profile_views once tracked
//     tier_modifier      = (tier === 'recommended') ? 0.1 : 0
//
// Category statistics (mean / stddev / max_recent) come from the
// mv_category_stats materialized view — never aggregated live.
//
// NOTE ON SCALE: a clear JS loop is used below for readability. At ~10k active
// rows this runs in a few seconds in the nightly window. If it ever needs to be
// faster, port the arithmetic into a single SQL UPDATE ... FROM mv_category_stats
// and expose it as an .rpc() (the inputs are all already columns / MV fields).

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";

// Weights — keep in sync with the formula comment above.
const W_RATING_Z = 0.35;
const W_VOLUME = 0.20;
const W_RECENCY = 0.15;
const W_VERIFICATION = 0.15;
const W_ENGAGEMENT = 0.10;
const W_TIER = 0.05;

const VERIFICATION_BONUS: Record<string, number> = {
  free: 0,
  verified: 0.5,
  recommended: 1.0,
};

interface CategoryStat {
  category_id: string;
  rating_mean: number | null;
  rating_stddev: number | null;
  max_recent_reviews_30d: number | null;
}

interface BizRow {
  id: string;
  category_id: string;
  rating: number | null;
  review_count: number | null;
  recent_review_count_30d: number | null;
  tier: string;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const supabase = createServiceClient();

  // 1) Make sure category stats reflect the latest data before we read them.
  //    refresh_analytics() rebuilds mv_category_stats + mv_business_review_stats.
  const { error: refreshErr } = await supabase.rpc("refresh_analytics");
  if (refreshErr) {
    console.error("refresh_analytics failed:", refreshErr.message);
    return errorResponse("Could not refresh analytics", 500);
  }

  // 2) Load category stats into a lookup.
  const { data: stats, error: statsErr } = await supabase
    .from("mv_category_stats")
    .select("category_id, rating_mean, rating_stddev, max_recent_reviews_30d");
  if (statsErr) {
    console.error("mv_category_stats read failed:", statsErr.message);
    return errorResponse("Could not load category stats", 500);
  }
  const statByCategory = new Map<string, CategoryStat>();
  for (const s of (stats ?? []) as CategoryStat[]) {
    statByCategory.set(s.category_id, s);
  }

  // 3) Page through active businesses and recompute each score.
  const PAGE = 1000;
  let from = 0;
  let updated = 0;

  for (;;) {
    const { data: rows, error: bizErr } = await supabase
      .from("businesses")
      .select("id, category_id, rating, review_count, recent_review_count_30d, tier")
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (bizErr) {
      console.error("businesses page read failed:", bizErr.message);
      return errorResponse("Could not load businesses", 500);
    }
    const batch = (rows ?? []) as BizRow[];
    if (batch.length === 0) break;

    // Update each row. (Supabase has no bulk per-row UPDATE with different
    // values, so we issue one update per row; at this scale that's fine in the
    // nightly window. The SQL-port note in the header is the optimization path.)
    for (const b of batch) {
      const score = computeScore(b, statByCategory.get(b.category_id));
      const { error: upErr } = await supabase
        .from("businesses")
        .update({ ranking_score: score })
        .eq("id", b.id);
      if (upErr) {
        console.error(`ranking update failed for ${b.id}:`, upErr.message);
        continue;
      }
      updated++;
    }

    if (batch.length < PAGE) break;
    from += PAGE;
  }

  // 4) Improvement-window maintenance (SQL helpers). flag_low_rated starts a
  //    60-day window; unlist_unimproved retires those that didn't recover.
  //    (Analytics MVs were already refreshed in step 1.) Tolerate failures.
  const rpcResults: Record<string, string | null> = {};
  for (const fn of ["flag_low_rated_businesses", "unlist_unimproved_businesses"]) {
    const { error: rpcErr } = await supabase.rpc(fn);
    rpcResults[fn] = rpcErr ? rpcErr.message : null;
    if (rpcErr) console.error(`${fn} failed:`, rpcErr.message);
  }

  return json({ ok: true, updated, rpc: rpcResults });
});

/** Compute ranking_score for one business given its category stats. */
function computeScore(b: BizRow, stat?: CategoryStat): number {
  const rating = Number(b.rating ?? 0);
  const reviewCount = Number(b.review_count ?? 0);
  const recent = Number(b.recent_review_count_30d ?? 0);

  const mean = Number(stat?.rating_mean ?? 0);
  const stddev = Number(stat?.rating_stddev ?? 0);
  const maxRecent = Number(stat?.max_recent_reviews_30d ?? 0);

  // rating_z = (rating - mean) / NULLIF(stddev, 0)  -> 0 when stddev is 0.
  const ratingZ = stddev > 0 ? (rating - mean) / stddev : 0;

  // review_volume_log = log10(1 + review_count)
  const volumeLog = Math.log10(1 + reviewCount);

  // recency = recent / NULLIF(maxRecent, 0) -> 0 when no recent reviews in cat.
  const recency = maxRecent > 0 ? recent / maxRecent : 0;

  const verificationBonus = VERIFICATION_BONUS[b.tier] ?? 0;

  // engagement: no profile_views column yet — TODO when tracking lands.
  const engagement = 0;

  const tierModifier = b.tier === "recommended" ? 0.1 : 0;

  const score =
    W_RATING_Z * ratingZ +
    W_VOLUME * volumeLog +
    W_RECENCY * recency +
    W_VERIFICATION * verificationBonus +
    W_ENGAGEMENT * engagement +
    W_TIER * tierModifier;

  // Round to keep the numeric column tidy; ordering is unaffected.
  return Math.round(score * 1e6) / 1e6;
}
