// The honest replacement for the mock's engagement grid: Rating, Total
// reviews, Reviews last 30 days (MV, refreshed nightly), In moderation
// (live). A missing stats payload renders "—", never fake numbers.
// Includes the rating-trend sparkline (real monthly buckets; hidden below
// two months of data).
import StarRow from "../StarRow.jsx";

function Sparkline({ trend }) {
  if (!trend || trend.length < 2) return null;
  const avgs = trend.map((t) => t.avg);
  const min = Math.min(...avgs);
  const max = Math.max(...avgs);
  const span = Math.max(max - min, 0.2);
  const points = trend
    .map((t, i) => {
      const x = (i / (trend.length - 1)) * 78 + 1;
      const y = 22 - ((t.avg - min) / span) * 20;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 80 24" className="w-full mt-2 h-6" data-testid="rating-sparkline">
      <polyline fill="none" stroke="#D4A341" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export default function MetricTiles({ business, stats }) {
  const dash = "—";
  const tiles = [
    { label: "Total reviews", value: business.review_count ?? 0, note: "All time" },
    { label: "Last 30 days", value: stats ? stats.reviews_30d : dash, note: "Updated nightly" },
    { label: "In moderation", value: stats ? stats.pending_moderation : dash, note: "Awaiting review" },
  ];
  return (
    <div className="px-5 md:px-8 pb-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-serif-d text-lg text-ink">Reviews</h3>
        <span className="text-[10px] md:text-xs text-stone-w uppercase tracking-wider">Live from customers</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl border border-ink-10 bg-white">
          <div className="text-[10px] md:text-xs text-stone-w">Rating</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-serif-d text-2xl text-ink leading-none">
              {business.rating > 0 ? business.rating : dash}
            </span>
          </div>
          <div className="mt-1"><StarRow rating={business.rating ?? 0} size={10} /></div>
          <Sparkline trend={stats?.trend} />
        </div>
        {tiles.map((t) => (
          <div key={t.label} className="p-3 rounded-xl border border-ink-10 bg-white">
            <div className="text-[10px] md:text-xs text-stone-w">{t.label}</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-serif-d text-2xl text-ink leading-none">{t.value}</span>
            </div>
            <div className="text-[10px] md:text-xs text-stone-w mt-1">{t.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
