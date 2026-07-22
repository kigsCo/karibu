import { MapPin } from "lucide-react";

// Home-city preference: chip per launch city, the profile's home_city_id
// highlighted. Presentational — the parent saves the profile field and syncs
// CityContext. Only rendered when cities carry DB ids (live reference data);
// the fallback constants have none, and there is nothing to save offline.
export default function HomeCitySection({ cities, homeCityId, saving, onSelect }) {
  return (
    <div className="w-full max-w-xs text-left mb-6">
      <h3 className="text-sm font-semibold text-ink mb-2">Home city</h3>
      <p className="text-xs text-stone-w mb-3">
        Karibu opens in your home city and grounds recommendations there.
      </p>
      <div className="flex flex-wrap gap-2">
        {cities.map((c) => {
          const isActive = c.id === homeCityId;
          return (
            <button
              key={c.key}
              onClick={() => onSelect(c)}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                isActive
                  ? "border-clay bg-clay-soft text-clay"
                  : "border-ink-10 bg-white text-ink"
              }`}
            >
              <MapPin size={12} className={isActive ? "text-clay" : "text-stone-w"} />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
