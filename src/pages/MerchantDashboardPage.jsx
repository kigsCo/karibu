import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, LogOut, Shield, Trophy, ArrowUp, ArrowDown,
  Sparkles, Check, MessageSquare, CircleDollarSign,
} from "lucide-react";
import StarRow from "../components/StarRow.jsx";

const MerchantDashboardScreen = ({ back }) => {
  // Mock business — would come from auth in production
  const biz = {
    name: "Posh Palace Salon",
    category: "Salons & Nails",
    hood: "Westlands",
    tier: "Karibu Recommended",
    rating: 4.8,
    reviews: 412,
    rank: 1,
    totalInCat: 6,
    improvementStatus: "healthy", // "healthy" | "warning" | "window"
  };

  const metrics = [
    { label: "Profile views", value: "2,341", delta: "+18%", trend: "up", period: "This month" },
    { label: "WhatsApp taps", value: "187", delta: "+24%", trend: "up", period: "This month" },
    { label: "Direction taps", value: "94", delta: "-6%", trend: "down", period: "This month" },
    { label: "New reviews", value: "23", delta: "+9", trend: "up", period: "This month" },
  ];

  const ratingTrend = [4.5, 4.5, 4.6, 4.7, 4.7, 4.8, 4.8];

  const themes = [
    { label: "Quality of gel work", sentiment: "positive", count: 38 },
    { label: "Staff multilingual", sentiment: "positive", count: 27 },
    { label: "Clean, modern space", sentiment: "positive", count: 21 },
    { label: "Wait times on weekends", sentiment: "negative", count: 9 },
    { label: "Parking tight", sentiment: "negative", count: 4 },
  ];

  const recentReviews = [
    { name: "Sarah M.", country: "🇩🇪", rating: 5, snippet: "Best gel set I've ever had...", responded: false },
    { name: "Jon A.", country: "🇺🇸", rating: 5, snippet: "First time getting a pedi here — felt safe...", responded: true },
    { name: "Grace K.", country: "🇰🇪", rating: 3, snippet: "Waited 45 minutes past my appointment...", responded: false },
  ];

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <ChevronLeft size={17} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Merchant</h2>
        <button className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
          <LogOut size={14} className="text-ink" />
        </button>
      </div>

      {/* Business header */}
      <div className="px-5 md:px-8 pt-5 pb-4">
        <div className="text-xs font-semibold text-ochre-d uppercase tracking-wider">
          {biz.tier}
        </div>
        <h1 className="font-serif-d text-3xl text-ink leading-tight mt-0.5">{biz.name}</h1>
        <p className="text-sm text-stone-w mt-0.5">{biz.category} · {biz.hood}</p>

        {/* Status card */}
        <div className="mt-4 p-4 rounded-2xl border border-forest bg-forest-soft">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-forest flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-forest">
                Healthy standing
              </div>
              <p className="text-xs text-ink mt-0.5 leading-relaxed">
                Your rating is well above the 3.5★ threshold. Keep it up and you'll keep your Recommended status next cycle.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rating + rank */}
      <div className="px-5 md:px-8 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl border border-ink-10 bg-white">
            <div className="text-[10px] md:text-xs font-semibold text-stone-w uppercase tracking-wider">
              Rating
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif-d text-3xl text-ink leading-none">{biz.rating}</span>
              <span className="text-xs text-forest font-semibold">+0.1</span>
            </div>
            <div className="mt-1">
              <StarRow rating={biz.rating} size={10} />
            </div>
            <div className="text-[10px] md:text-xs text-stone-w mt-1">{biz.reviews} reviews</div>

            {/* Sparkline */}
            <svg viewBox="0 0 80 24" className="w-full mt-2 h-6">
              <polyline
                fill="none"
                stroke="#D4A341"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={ratingTrend
                  .map((v, i) => {
                    const x = (i / (ratingTrend.length - 1)) * 78 + 1;
                    const y = 22 - ((v - 4.3) / 0.6) * 20;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
            </svg>
          </div>

          <div className="p-4 rounded-2xl border border-ochre bg-ochre-soft">
            <div className="text-[10px] md:text-xs font-semibold text-ochre-d uppercase tracking-wider">
              Category rank
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif-d text-3xl text-ink leading-none">#{biz.rank}</span>
              <span className="text-xs text-stone-w">/ {biz.totalInCat}</span>
            </div>
            <div className="text-[10px] md:text-xs text-stone-w mt-1">{biz.hood}</div>
            <div className="mt-2 flex items-center gap-1">
              <Trophy size={11} className="text-ochre" />
              <span className="text-[10px] md:text-xs font-semibold text-ochre-d">
                Top 3 this month
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="px-5 md:px-8 pb-4">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-serif-d text-lg text-ink">Activity</h3>
          <span className="text-[10px] md:text-xs text-stone-w uppercase tracking-wider">Last 30 days</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="p-3 rounded-xl border border-ink-10 bg-white">
              <div className="text-[10px] md:text-xs text-stone-w">{m.label}</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="font-serif-d text-2xl text-ink leading-none">{m.value}</span>
                <span
                  className={`text-[10px] md:text-xs font-semibold inline-flex items-center gap-0.5 ${
                    m.trend === "up" ? "text-forest" : "text-clay"
                  }`}
                >
                  {m.trend === "up" ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                  {m.delta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review themes */}
      <div className="px-5 md:px-8 pb-4">
        <h3 className="font-serif-d text-lg text-ink mb-2">What reviewers mention</h3>
        <div className="p-3 rounded-xl border border-ink-10 bg-white">
          <div className="text-[10px] md:text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">
            Top themes · last 90 days
          </div>
          <div className="space-y-1.5">
            {themes.map((t) => {
              const isPositive = t.sentiment === "positive";
              return (
                <div key={t.label} className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isPositive ? "bg-forest" : "bg-clay"
                    }`}
                  />
                  <span className="text-xs text-ink flex-1">{t.label}</span>
                  <span className="text-[10px] md:text-xs text-stone-w">{t.count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-ink-10 flex items-start gap-2">
            <Sparkles size={11} className="text-ochre-d flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-ink leading-relaxed">
              <span className="font-semibold">Suggestion:</span> Consider a weekend-only second chair to ease wait times — it's your most-cited negative.
            </p>
          </div>
        </div>
      </div>

      {/* Recent reviews */}
      <div className="px-5 md:px-8 pb-4">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-serif-d text-lg text-ink">Recent reviews</h3>
          <button className="text-xs text-clay font-semibold">See all</button>
        </div>
        <div className="space-y-2">
          {recentReviews.map((r, i) => (
            <div key={i} className="p-3 rounded-xl border border-ink-10 bg-white">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{r.country}</span>
                  <span className="text-sm font-semibold text-ink">{r.name}</span>
                </div>
                <StarRow rating={r.rating} size={11} />
              </div>
              <p className="text-xs text-stone-w italic">"{r.snippet}"</p>
              <div className="mt-2 flex items-center gap-2">
                {r.responded ? (
                  <span className="text-[10px] md:text-xs text-forest font-semibold flex items-center gap-1">
                    <Check size={10} />
                    Responded
                  </span>
                ) : (
                  <button className="text-[11px] font-semibold text-clay flex items-center gap-1">
                    <MessageSquare size={11} />
                    Write response
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription */}
      <div className="px-5 md:px-8 pb-6">
        <div className="p-4 rounded-2xl border border-ink-10 bg-ivory-2">
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign size={15} className="text-forest" />
            <span className="text-sm font-semibold text-ink">Subscription</span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-serif-d text-xl text-ink">Recommended tier</div>
              <div className="text-xs text-stone-w">Next bill: 15 May · KSh 7,500</div>
            </div>
            <button className="text-xs font-semibold text-clay">Manage</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  return <MerchantDashboardScreen back={() => navigate("/")} />;
}
