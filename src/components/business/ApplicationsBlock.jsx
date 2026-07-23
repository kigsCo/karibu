// src/components/business/ApplicationsBlock.jsx
// "Your applications" on /for-business: the signed-in user's own listings
// (any status — owner-read RLS) and claims (claimant-read RLS), with status
// chips. Degrades to nothing on any error or when there is nothing to show —
// it must never blank the marketing page.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext.jsx";

const BUSINESS_STATUS = {
  pending: { label: "Under review", cls: "bg-amber-100 text-amber-800" },
  active: { label: "Live", cls: "bg-green-100 text-green-800" },
  unlisted: { label: "Not approved", cls: "bg-stone-200 text-stone-600" },
  suspended: { label: "Suspended", cls: "bg-red-100 text-red-700" },
};
const CLAIM_STATUS = {
  pending: { label: "Under review", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Not approved", cls: "bg-stone-200 text-stone-600" },
};

function StatusChip({ map, status }) {
  const meta = map[status] || { label: status, cls: "bg-stone-200 text-stone-600" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

export default function ApplicationsBlock() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState(null);

  useEffect(() => {
    if (!user) {
      setApps(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const [biz, claims] = await Promise.all([
        supabase
          .from("businesses")
          .select("id, slug, name, status")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("business_claims")
          .select("id, status, business:businesses(name, slug)")
          .eq("claimant_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (cancelled || biz.error || claims.error) return;
      setApps({ businesses: biz.data ?? [], claims: claims.data ?? [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !apps) return null;
  if (apps.businesses.length === 0 && apps.claims.length === 0) return null;

  return (
    <div className="px-5 md:px-8 pt-6">
      <h2 className="font-serif text-xl text-ink mb-3">Your applications</h2>
      <div className="space-y-2">
        {apps.businesses.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between bg-white rounded-xl border border-stone-200 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-sm">{b.name}</p>
              <p className="text-xs text-stone-500">New listing</p>
            </div>
            <div className="flex items-center">
              <StatusChip map={BUSINESS_STATUS} status={b.status} />
              {b.status === "active" && (
                <button
                  type="button"
                  onClick={() => navigate("/merchant")}
                  className="text-xs font-semibold text-forest ml-2"
                >
                  Open dashboard
                </button>
              )}
            </div>
          </div>
        ))}
        {apps.claims.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between bg-white rounded-xl border border-stone-200 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-sm">{c.business?.name || "Listing"}</p>
              <p className="text-xs text-stone-500">Ownership claim</p>
            </div>
            <StatusChip map={CLAIM_STATUS} status={c.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
