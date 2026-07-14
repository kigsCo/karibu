import { useNavigate } from "react-router-dom";
import { X, MapPin, Check, Sparkles } from "lucide-react";
import { useCity } from "../context/CityContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";

const CityPickerScreen = ({ back, activeCity, onSelect }) => {
  const { cities } = useReferenceData();
  return (
    <div className="fade-in">
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <X size={16} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Change city</h2>
        <span className="w-8" />
      </div>

      <div className="px-5 md:px-8 pt-5 pb-3">
        <h3 className="font-serif-d text-2xl text-ink leading-tight">Where in Kenya<br />are you?</h3>
        <p className="text-xs text-stone-w mt-2 leading-relaxed">
          We show services, businesses, and AI recommendations based on your city. You can switch any time.
        </p>
      </div>

      <div className="px-5 md:px-8 pb-5 space-y-2">
        {cities.map((c) => {
          const isActive = c.key === activeCity;
          return (
            <button
              key={c.key}
              onClick={() => onSelect(c.key)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition ${
                isActive ? "border-clay bg-clay-soft" : "border-ink-10 bg-white"
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isActive ? "bg-clay" : "bg-ivory-2"
              }`}>
                <MapPin size={16} className={isActive ? "text-white" : "text-stone-w"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-ink">{c.label}</div>
                <div className="text-xs text-stone-w">{c.tagline} · {c.hoods.length} neighbourhoods</div>
              </div>
              {isActive && <Check size={16} className="text-clay flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="px-5 md:px-8 pb-6">
        <div className="p-3 rounded-xl bg-forest-soft border border-ink-10 flex items-start gap-2">
          <Sparkles size={13} className="text-forest flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-ink leading-relaxed">
            More cities coming: Eldoret, Malindi, Lamu, Kilifi. Tell us where you'd like to see Karibu next.
          </p>
        </div>
      </div>
    </div>
  );
};

export default function CityPickerPage() {
  const navigate = useNavigate();
  const { cityKey, setCityKey } = useCity();
  const onSelect = (key) => {
    setCityKey(key);
    navigate(-1);
  };
  return <CityPickerScreen back={() => navigate(-1)} activeCity={cityKey} onSelect={onSelect} />;
}
