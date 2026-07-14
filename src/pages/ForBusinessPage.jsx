import { useNavigate } from "react-router-dom";
import { ChevronLeft, TrendingUp, Check, Shield, Award, AlertCircle, X } from "lucide-react";
import Badge from "../components/Badge.jsx";

const BusinessSignupScreen = ({ back }) => {
  const tiers = [
    {
      name: "Free Listing",
      price: "KSh 0",
      cadence: "forever",
      color: "#E8E1D3",
      textColor: "#1C1613",
      features: [
        "Name, contact, hours, location",
        "Appear in search results",
        "Customer reviews enabled",
      ],
      cta: "List for free",
      highlight: false,
    },
    {
      name: "Verified",
      price: "KSh 2,500",
      cadence: "per month",
      color: "#EBEFE9",
      textColor: "#2A3D2B",
      features: [
        "Verified badge · builds trust",
        "Priority in search results",
        "Photo gallery (up to 15)",
        "Analytics dashboard",
        "WhatsApp & M-Pesa integration",
      ],
      cta: "Get Verified",
      highlight: false,
    },
    {
      name: "Karibu Recommended",
      price: "KSh 7,500",
      cadence: "per month",
      color: "#FBF4E0",
      textColor: "#7A5A10",
      features: [
        "Gold Recommended badge",
        "Featured on home carousel",
        "Top 3 placement in category",
        "Review response tools",
        "Monthly performance report",
        "Dedicated account manager",
      ],
      cta: "Become Recommended",
      highlight: true,
    },
  ];

  return (
    <div className="fade-in pb-6">
      {/* Hero */}
      <div className="relative bg-forest px-5 md:px-8 pt-5 pb-7 text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #D4A341 0 1px, transparent 1px 14px)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={back}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(247,241,232,0.15)" }}
            >
              <ChevronLeft size={17} color="#F7F1E8" />
            </button>
            <span className="text-xs font-semibold text-ochre uppercase tracking-wider">For Businesses</span>
            <span className="w-8" />
          </div>
          <h1 className="font-serif-d text-3xl leading-tight">
            Be the place visitors<br />
            <span className="italic">can't stop</span> recommending.
          </h1>
          <p className="text-sm mt-2" style={{ color: "#D7CFC4" }}>
            Get discovered by tourists, expats, and newcomers searching for trusted services in Kenya.
          </p>

          <div className="flex gap-4 mt-4">
            <div>
              <div className="font-serif-d text-2xl text-ochre">28k+</div>
              <div className="text-[10px] md:text-xs uppercase tracking-wider" style={{ color: "#D7CFC4" }}>Monthly visitors</div>
            </div>
            <div>
              <div className="font-serif-d text-2xl text-ochre">2.4k</div>
              <div className="text-[10px] md:text-xs uppercase tracking-wider" style={{ color: "#D7CFC4" }}>Listed businesses</div>
            </div>
            <div>
              <div className="font-serif-d text-2xl text-ochre">41%</div>
              <div className="text-[10px] md:text-xs uppercase tracking-wider" style={{ color: "#D7CFC4" }}>Bookings uplift*</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className="px-5 md:px-8 pt-5 pb-2">
        <h3 className="font-serif-d text-xl text-ink mb-3">Choose your plan</h3>
        <div className="space-y-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl p-4 border ${t.highlight ? "border-ochre" : "border-ink-10"}`}
              style={{ backgroundColor: t.color }}
            >
              {t.highlight && (
                <div className="flex items-center justify-between mb-2">
                  <Badge kind="recommended">Most Popular</Badge>
                  <TrendingUp size={15} style={{ color: t.textColor }} />
                </div>
              )}
              <div className="flex items-baseline justify-between mb-1">
                <h4 className="font-serif-d text-xl" style={{ color: t.textColor }}>{t.name}</h4>
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="font-serif-d text-3xl" style={{ color: t.textColor }}>{t.price}</span>
                <span className="text-xs" style={{ color: t.textColor, opacity: 0.7 }}>/ {t.cadence}</span>
              </div>
              <ul className="space-y-1.5 mb-4">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs" style={{ color: t.textColor }}>
                    <Check size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2.5 rounded-xl text-sm font-semibold ${
                  t.highlight ? "bg-ochre text-ink" : "bg-ink text-white"
                }`}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] md:text-xs text-stone-w mt-3 leading-relaxed">
          * Average reported uplift from Recommended businesses in the first 90 days. All prices inclusive of 16% VAT. M-Pesa and card billing. Cancel anytime.
        </p>
      </div>

      {/* Trust row */}
      <div className="mx-5 mt-5 p-4 rounded-2xl bg-ivory-2 border border-ink-10">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-forest flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm text-ink">Verified businesses only</div>
            <p className="text-xs text-stone-w mt-0.5">
              Every Verified and Recommended listing goes through a manual review by our Nairobi team. We check registration, location, and a sample of recent reviews before approval.
            </p>
          </div>
        </div>
      </div>

      {/* Quality standards */}
      <div className="px-5 md:px-8 mt-4">
        <div className="rounded-2xl border border-ink-10 bg-white overflow-hidden">
          <div className="px-4 pt-4 pb-3 bg-forest-soft border-b border-ink-10">
            <div className="flex items-center gap-2">
              <Award size={17} className="text-forest" />
              <h3 className="font-serif-d text-lg text-forest">Quality-first platform</h3>
            </div>
            <p className="text-xs text-ink mt-1 leading-relaxed">
              Karibu exists because visitors trust it. We protect that trust by keeping ranking honest and removing businesses that consistently underdeliver.
            </p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-forest-soft flex items-center justify-center flex-shrink-0">
                <TrendingUp size={14} className="text-forest" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Reviews drive ranking</div>
                <p className="text-xs text-stone-w leading-relaxed">
                  Position in search and "Recommended" carousel is determined by rating, review volume, and recency — not by how much you pay. Subscription only unlocks placement tiers within your rating band.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FBF4E0" }}>
                <AlertCircle size={14} className="text-ochre-d" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Improvement window at 3.5★</div>
                <p className="text-xs text-stone-w leading-relaxed">
                  If a business drops below 3.5★ with 20+ reviews, we open a 60-day improvement window. You get a private dashboard of what reviewers cite, a direct line to our team, and a chance to respond.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F3D9CF" }}>
                <X size={14} className="text-clay" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Unlisted if unresolved</div>
                <p className="text-xs text-stone-w leading-relaxed">
                  Businesses still below 3.5★ after 60 days are unlisted from search and refunded their current month. Tough, but it's why visitors keep trusting Karibu — and why good businesses thrive here.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-forest-soft flex items-center justify-center flex-shrink-0">
                <Shield size={14} className="text-forest" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Fair protection against abuse</div>
                <p className="text-xs text-stone-w leading-relaxed">
                  Reviews are moderated for authenticity. We detect and remove review bombing, fake accounts, and competitor sabotage. Businesses can flag reviews for investigation at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ForBusinessPage() {
  const navigate = useNavigate();
  return <BusinessSignupScreen back={() => navigate(-1)} />;
}
