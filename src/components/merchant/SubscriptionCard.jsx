// Real tier + subscription state (owner-read RLS). Checkout is cycle 3, so
// the only action is "coming soon".
import { useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { supabase } from "../../lib/supabase";

const TIER_LABEL = {
  free: "Free listing",
  verified: "Verified tier",
  recommended: "Karibu Recommended",
};

export default function SubscriptionCard({ business }) {
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (!business?.id) return undefined;
    let cancelled = false;
    supabase
      .from("subscriptions")
      .select("tier, status, amount_kes, current_period_end")
      .eq("business_id", business.id)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!cancelled && !error) setSub(data?.[0] ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [business?.id]);

  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
    : null;

  return (
    <div className="px-5 md:px-8 pb-6">
      <div className="p-4 rounded-2xl border border-ink-10 bg-ivory-2">
        <div className="flex items-center gap-2 mb-2">
          <CircleDollarSign size={15} className="text-forest" />
          <span className="text-sm font-semibold text-ink">Subscription</span>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-serif-d text-xl text-ink">
              {TIER_LABEL[business.tier] ?? business.tier}
            </div>
            <div className="text-xs text-stone-w">
              {sub && periodEnd
                ? `Renews ${periodEnd} · KSh ${Number(sub.amount_kes).toLocaleString()}`
                : "Upgrade — coming soon"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
