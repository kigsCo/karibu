import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft } from "lucide-react";
import { useLegacyNav } from "../lib/nav.js";

const SearchScreen = ({ back, go }) => {
  const [q, setQ] = useState("");
  const suggestions = [
    "Nails in Westlands",
    "Airport transfer to JKIA",
    "Best Ethiopian food",
    "24-hour pharmacy Kilimani",
    "Gym day pass",
    "Kenyan SIM card",
  ];
  return (
    <div className="fade-in">
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center gap-2 border-b border-ink-10">
        <button onClick={back} className="w-8 h-8 flex items-center justify-center">
          <ChevronLeft size={18} className="text-ink" />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-white border border-ink-10 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-stone-w" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What are you looking for?"
            className="flex-1 bg-transparent text-sm text-ink outline-none font-sans-d"
          />
        </div>
      </div>
      <div className="px-5 md:px-8 pt-4">
        <h4 className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">Popular searches</h4>
        <div className="space-y-1">
          {suggestions
            .filter((s) => s.toLowerCase().includes(q.toLowerCase()))
            .map((s) => (
              <button
                key={s}
                onClick={() => go("category", { key: "salons", label: "Nails & Salons" })}
                className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-ivory-2 text-left"
              >
                <Search size={14} className="text-stone-w" />
                <span className="text-sm text-ink">{s}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default function SearchPage() {
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  return <SearchScreen back={() => navigate(-1)} go={go} />;
}
