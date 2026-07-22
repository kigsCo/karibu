import { Clock, ChevronRight, AlertCircle } from "lucide-react";

// "Places you've visited": distinct businesses by recency (last-visit-wins
// in visited_places), owner-only. Clear removes the caller's rows and
// nothing else. Presentational; data + actions come from useVisitHistory.
export default function VisitHistorySection({
  visits,
  loading,
  error,
  onClear,
  onOpen,
}) {
  return (
    <div className="w-full max-w-xs text-left mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink">Places you've visited</h3>
        {visits.length > 0 && (
          <button onClick={onClear} className="text-xs text-clay font-semibold">
            Clear history
          </button>
        )}
      </div>
      {error && (
        <div className="p-3 mb-2 rounded-xl bg-clay-soft border border-clay text-xs text-ink flex items-start gap-2">
          <AlertCircle size={13} className="text-clay flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {visits.length === 0 ? (
        <p className="text-xs text-stone-w">
          {loading
            ? "Loading your history…"
            : "Businesses you view appear here so you can find your way back."}
        </p>
      ) : (
        <div className="space-y-2">
          {visits.map((v) => (
            <button
              key={v.business_id}
              onClick={() => onOpen(v.business)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-ink-10 bg-white text-left"
            >
              <div className="w-8 h-8 rounded-full bg-ivory-2 flex items-center justify-center flex-shrink-0">
                <Clock size={14} className="text-stone-w" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink truncate">
                  {v.business.name}
                </div>
                <div className="text-[11px] text-stone-w truncate">
                  {[v.business.hood, v.business.category?.label]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <ChevronRight size={14} className="text-stone-w flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
