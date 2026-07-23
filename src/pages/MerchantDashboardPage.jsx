// The owner's real home (cycle 2). Every number on this page has a data
// source: the businesses row (cached rating/count), merchant-stats (MV +
// live pending + trend), published reviews, and the subscription row. The
// prototype's engagement tiles and sentiment themes had no source and are
// gone — honest absence beats fabricated numbers.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useMyBusinesses } from "../hooks/useMyBusinesses.js";
import { useMerchantStats } from "../hooks/useMerchantStats.js";
import BusinessSwitcher from "../components/merchant/BusinessSwitcher.jsx";
import ImprovementBanner from "../components/merchant/ImprovementBanner.jsx";
import MetricTiles from "../components/merchant/MetricTiles.jsx";
import RecentReviews from "../components/merchant/RecentReviews.jsx";
import SubscriptionCard from "../components/merchant/SubscriptionCard.jsx";
import EditListingSection from "../components/merchant/EditListingSection.jsx";

const TIER_BADGE = {
  free: "Free listing",
  verified: "Verified",
  recommended: "Karibu Recommended",
};

function CenteredNote({ title, body, cta, onCta }) {
  return (
    <div className="fade-in flex flex-col items-center justify-center px-8 py-24 text-center">
      <h1 className="font-serif-d text-2xl text-ink mb-2">{title}</h1>
      <p className="text-sm text-stone-w mb-6 max-w-sm">{body}</p>
      {cta && (
        <button
          type="button"
          onClick={onCta}
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useAuth();
  const { businesses, loading, refresh } = useMyBusinesses();
  const [selectedId, setSelectedId] = useState(null);

  const active = useMemo(
    () => (businesses ?? []).filter((b) => b.status === "active"),
    [businesses],
  );
  const pending = useMemo(
    () => (businesses ?? []).filter((b) => b.status === "pending"),
    [businesses],
  );
  const business = active.find((b) => b.id === selectedId) ?? active[0] ?? null;
  const { stats } = useMerchantStats(business?.id);

  if (authLoading || loading) return <div className="fade-in pb-6" />;

  if (!session) {
    return (
      <CenteredNote
        title="Your business on Karibu"
        body="Sign in to see your listing's performance and keep its details fresh."
        cta="Sign in to continue"
        onCta={() => navigate("/welcome", { state: { next: "/merchant" } })}
      />
    );
  }

  if ((businesses ?? []).length === 0) {
    return (
      <CenteredNote
        title="No listings yet"
        body="Register your business and it will appear here once our team approves it."
        cta="List your business"
        onCta={() => navigate("/for-business/register")}
      />
    );
  }

  if (!business) {
    return (
      <CenteredNote
        title="Under review"
        body={`${pending.map((p) => p.name).join(", ")} ${pending.length === 1 ? "is" : "are"} still being reviewed by our Nairobi team — allow up to 48 hours. You'll manage it here once it goes live.`}
      />
    );
  }

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <ChevronLeft size={17} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Merchant</h2>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <LogOut size={14} className="text-ink" />
        </button>
      </div>

      <BusinessSwitcher businesses={active} selectedId={business.id} onSelect={setSelectedId} />

      {/* Business header */}
      <div className="px-5 md:px-8 pt-5 pb-4">
        <div className="text-xs font-semibold text-ochre-d uppercase tracking-wider">
          {TIER_BADGE[business.tier] ?? business.tier}
        </div>
        <h1 className="font-serif-d text-3xl text-ink leading-tight mt-0.5">{business.name}</h1>
        <p className="text-sm text-stone-w mt-0.5">
          {business.category?.label} · {business.hood}
        </p>
        <ImprovementBanner rating={business.rating} improvementUntil={business.improvement_until} />
      </div>

      <MetricTiles business={business} stats={stats} />
      {pending.length > 0 && (
        <p className="px-5 md:px-8 pb-4 text-xs text-stone-w">
          {pending.length} application{pending.length > 1 ? "s" : ""} under review — see For Business.
        </p>
      )}
      <EditListingSection business={business} onSaved={refresh} />
      <RecentReviews businessId={business.id} />
      <SubscriptionCard business={business} />
    </div>
  );
}
