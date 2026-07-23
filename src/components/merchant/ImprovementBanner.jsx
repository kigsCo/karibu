// healthy / warning / window, derived from the cached rating and
// improvement_until — the mock's three improvementStatus states made real.
import { Shield, AlertCircle } from "lucide-react";

function stateOf(rating, improvementUntil) {
  if (improvementUntil) return "window";
  if (rating > 0 && rating < 3.8) return "warning";
  return "healthy";
}

const COPY = {
  healthy: {
    title: "Healthy standing",
    body: "Your rating is above the 3.5★ threshold. Keep responding to what customers say and you'll stay in good standing.",
    wrap: "border-forest bg-forest-soft", icon: "bg-forest", text: "text-forest",
  },
  warning: {
    title: "Getting close to the threshold",
    body: "Your rating is nearing 3.5★. Listings that stay below the threshold enter a 60-day improvement window.",
    wrap: "border-ochre bg-ochre-soft", icon: "bg-ochre", text: "text-ochre-d",
  },
  window: {
    title: "Improvement window active",
    body: "Your rating fell below 3.5★. Bring it back up before the window ends or the listing is unlisted until it recovers.",
    wrap: "border-clay bg-clay-soft", icon: "bg-clay", text: "text-clay",
  },
};

export default function ImprovementBanner({ rating, improvementUntil }) {
  const s = COPY[stateOf(rating, improvementUntil)];
  const Icon = s === COPY.healthy ? Shield : AlertCircle;
  return (
    <div className={`mt-4 p-4 rounded-2xl border ${s.wrap}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full ${s.icon} flex items-center justify-center flex-shrink-0`}>
          <Icon size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <div className={`text-sm font-semibold ${s.text}`}>{s.title}</div>
          <p className="text-xs text-ink mt-0.5 leading-relaxed">{s.body}</p>
        </div>
      </div>
    </div>
  );
}
