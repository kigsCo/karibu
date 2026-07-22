import { Star } from "lucide-react";
import { REVIEW_STATUS_CHIP } from "../../hooks/useMyReviews.js";

const CHIP_CLASSES = {
  live: "bg-forest-soft text-forest",
  pending: "bg-ivory-2 text-stone-w",
  off: "bg-clay-soft text-clay",
};

// "Your reviews": every review the signed-in user wrote, with its moderation
// status — the honest counterpart to the optimistic "thanks, in review" the
// composer shows. Presentational; data comes from useMyReviews.
export default function MyReviewsSection({ reviews, loading }) {
  return (
    <div className="w-full max-w-xs text-left mb-6">
      <h3 className="text-sm font-semibold text-ink mb-2">Your reviews</h3>
      {reviews.length === 0 ? (
        <p className="text-xs text-stone-w">
          {loading
            ? "Loading your reviews…"
            : "Reviews you write appear here with their status — in review, live, or not published."}
        </p>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => {
            const chip =
              REVIEW_STATUS_CHIP[r.status] ?? REVIEW_STATUS_CHIP.pending_moderation;
            return (
              <div
                key={r.id}
                className="p-3 rounded-xl border border-ink-10 bg-white"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink truncate">
                    {r.business?.name || "A Karibu business"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${CHIP_CLASSES[chip.tone]}`}
                  >
                    {chip.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={11}
                      className={
                        i < r.rating ? "fill-current text-clay" : "text-ink-10"
                      }
                    />
                  ))}
                  <span className="text-[10px] text-stone-w ml-1">
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-xs text-stone-w line-clamp-2">{r.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
