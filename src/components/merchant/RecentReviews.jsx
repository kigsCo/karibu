// The owner's latest published reviews via the public-read policy. No
// respond CTA — replies are a later (Recommended-tier) cycle.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import StarRow from "../StarRow.jsx";

export default function RecentReviews({ businessId }) {
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    if (!businessId) return undefined;
    let cancelled = false;
    supabase
      .from("reviews")
      .select("id, reviewer_name, reviewer_country, rating, body, created_at")
      .eq("business_id", businessId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (!cancelled && !error) setReviews(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!reviews || reviews.length === 0) return null;
  return (
    <div className="px-5 md:px-8 pb-4">
      <h3 className="font-serif-d text-lg text-ink mb-2">Recent reviews</h3>
      <div className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="p-3 rounded-xl border border-ink-10 bg-white">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{r.reviewer_name}</span>
                {r.reviewer_country && (
                  <span className="text-[10px] md:text-xs text-stone-w">{r.reviewer_country}</span>
                )}
              </div>
              <StarRow rating={r.rating} size={11} />
            </div>
            <p className="text-xs text-stone-w italic">"{r.body}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
