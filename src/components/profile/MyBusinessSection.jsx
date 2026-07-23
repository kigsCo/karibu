// The owner's doorway from their customer profile to the merchant
// dashboard. Renders nothing for non-owners — the profile stays a purely
// customer surface for everyone else.
import { useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { useMyBusinesses } from "../../hooks/useMyBusinesses.js";

export default function MyBusinessSection() {
  const navigate = useNavigate();
  const { businesses } = useMyBusinesses();
  if (!businesses || businesses.length === 0) return null;
  const first = businesses[0];
  const extra = businesses.length - 1;

  return (
    <div className="w-full max-w-xs mb-6 text-left">
      <h3 className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">
        Your business
      </h3>
      <div className="flex items-center justify-between bg-white border border-ink-10 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Store size={15} className="text-forest flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{first.name}</p>
            {extra > 0 && (
              <p className="text-[11px] text-stone-w">+{extra} more</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/merchant")}
          className="text-xs font-semibold text-clay flex-shrink-0"
        >
          Open dashboard
        </button>
      </div>
    </div>
  );
}
