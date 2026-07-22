import { Heart, Star, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PlaceholderScreen from "../components/PlaceholderScreen.jsx";
import { useSavedPlaces } from "../hooks/useSavedPlaces.js";

// ---------- SCREEN: SAVED PLACES ----------
// Signed-in users see their real saved_places list (cross-device); tapping
// the heart removes a place. Guests and empty lists keep the original
// placeholder copy — the visual layer of that state is unchanged.
export default function SavedPage() {
  const navigate = useNavigate();
  const { canPersist, savedIds, places, loading, toggle } = useSavedPlaces({
    withBusinesses: true,
  });

  // Un-hearting drops the id from savedIds; filtering here makes the row
  // disappear without refetching.
  const visible = places.filter((p) => savedIds.has(p.business_id));

  if (!canPersist || (!loading && visible.length === 0)) {
    return (
      <PlaceholderScreen
        title="Your saved places"
        message="Tap the heart on any business to save it here for later. Great for building a short-list before a trip."
      />
    );
  }

  return (
    <div className="fade-in px-5 md:px-8 py-6">
      <h2 className="font-serif-d text-2xl text-ink mb-1">Your saved places</h2>
      <p className="text-xs text-stone-w mb-4">
        {visible.length} saved · synced to your account
      </p>
      <div className="space-y-2">
        {visible.map((p) => (
          <div
            key={p.business_id}
            className="flex items-center gap-3 p-3 rounded-2xl border border-ink-10 bg-white"
          >
            <button
              onClick={() => navigate(`/b/${p.business.slug}`)}
              className="flex-1 flex items-center gap-3 text-left min-w-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink truncate">
                  {p.business.name}
                </div>
                <div className="text-[11px] text-stone-w truncate flex items-center gap-1">
                  {p.business.rating > 0 && (
                    <>
                      <Star size={10} className="fill-current text-clay" />
                      <span className="text-ink font-medium">
                        {Number(p.business.rating).toFixed(1)}
                      </span>
                      <span>·</span>
                    </>
                  )}
                  {[p.business.hood, p.business.category?.label]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <ChevronRight size={14} className="text-stone-w flex-shrink-0" />
            </button>
            <button
              onClick={() => toggle(p.business_id)}
              aria-label="Remove from saved"
              className="w-8 h-8 rounded-full bg-ivory-2 flex items-center justify-center flex-shrink-0"
            >
              <Heart size={14} className="fill-current text-clay" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
