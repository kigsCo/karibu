// Safe-fields editor. What may be edited is decided by the column-scoped
// grant (20260723200000), not this form — the locked-fields note is UX,
// the 42501 behind it is the enforcement. Photos upload to the owner's own
// business-photos folder (storage RLS enforces the folder); removal edits
// the array only (storage orphans are the tracked cleanup-cron follow-up).
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext.jsx";
import { useOwnerListingUpdate } from "../../hooks/useOwnerListingUpdate.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_GALLERY = 15;

const field =
  "w-full bg-white border border-ink-10 rounded-xl px-3 py-2.5 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-forest/40";
const label = "block text-xs font-semibold text-ink mb-1";

const hoursToText = (hoursJson) =>
  typeof hoursJson === "string" ? hoursJson : hoursJson?.display ?? "";

export default function EditListingSection({ business, onSaved }) {
  const { user } = useAuth();
  const { save, saving, error } = useOwnerListingUpdate(business.id);
  const [form, setForm] = useState({});
  const [gallery, setGallery] = useState([]);
  const [hero, setHero] = useState(null);
  const [notice, setNotice] = useState(null); // "saved" | upload error text

  useEffect(() => {
    setForm({
      hours: hoursToText(business.hours_json),
      phone: business.phone ?? "",
      whatsapp: business.whatsapp ?? "",
      email: business.email ?? "",
      website: business.website ?? "",
      about: business.about ?? "",
      price_range: business.price_range ?? "",
      address: business.address ?? "",
    });
    setGallery(business.gallery_image_urls ?? []);
    setHero(business.hero_image_url ?? null);
    setNotice(null);
    // Reseed only on a genuine listing switch: a same-id refetch after a
    // successful save (onSaved -> page refresh -> new `business` reference,
    // same id) must not clobber local edit state — that state already holds
    // the just-saved values, and clobbering it also drops in-flight edits
    // (typed text, newly uploaded photos) and instantly clears the "Saved."
    // notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    setNotice(null);
    if (gallery.length + files.length > MAX_GALLERY) {
      return setNotice(`A gallery holds up to ${MAX_GALLERY} photos.`);
    }
    try {
      const urls = [];
      for (const f of files) {
        if (!PHOTO_TYPES.includes(f.type) || f.size > MAX_FILE_BYTES) {
          throw new Error(`${f.name}: must be an image under 5 MB`);
        }
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upError } = await supabase.storage
          .from("business-photos").upload(path, f);
        if (upError) throw new Error(upError.message);
        urls.push(
          `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business-photos/${path}`,
        );
      }
      setGallery((g) => [...g, ...urls]);
    } catch (err) {
      setNotice(err.message);
    }
  };

  const removePhoto = (url) => setGallery((g) => g.filter((u) => u !== url));

  const submit = async () => {
    setNotice(null);
    const ok = await save({
      hours_json: form.hours.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      about: form.about.trim() || null,
      price_range: form.price_range.trim() || null,
      address: form.address.trim() || null,
      hero_image_url: hero ?? gallery[0] ?? null,
      gallery_image_urls: gallery,
    });
    if (ok) {
      setNotice("saved");
      onSaved?.();
    }
  };

  return (
    <div className="px-5 md:px-8 pb-4">
      <h3 className="font-serif-d text-lg text-ink mb-2">Edit your listing</h3>
      <div className="p-4 rounded-2xl border border-ink-10 bg-white space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="el-hours">Opening hours</label>
            <input id="el-hours" className={field} value={form.hours ?? ""} onChange={set("hours")} />
          </div>
          <div>
            <label className={label} htmlFor="el-phone">Phone</label>
            <input id="el-phone" className={field} value={form.phone ?? ""} onChange={set("phone")} />
          </div>
          <div>
            <label className={label} htmlFor="el-whatsapp">WhatsApp</label>
            <input id="el-whatsapp" className={field} value={form.whatsapp ?? ""} onChange={set("whatsapp")} />
          </div>
          <div>
            <label className={label} htmlFor="el-email">Email</label>
            <input id="el-email" className={field} value={form.email ?? ""} onChange={set("email")} />
          </div>
          <div>
            <label className={label} htmlFor="el-website">Website</label>
            <input id="el-website" className={field} value={form.website ?? ""} onChange={set("website")} />
          </div>
          <div>
            <label className={label} htmlFor="el-price">Price range</label>
            <input id="el-price" className={field} value={form.price_range ?? ""} onChange={set("price_range")} placeholder="KSh 500-2,000" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="el-address">Street address</label>
          <input id="el-address" className={field} value={form.address ?? ""} onChange={set("address")} />
        </div>
        <div>
          <label className={label} htmlFor="el-about">About</label>
          <textarea id="el-about" rows={3} className={field} value={form.about ?? ""} onChange={set("about")} />
        </div>

        <div>
          <span className={label}>Photos ({gallery.length}/{MAX_GALLERY})</span>
          {gallery.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {gallery.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-ink-10" />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => removePhoto(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white text-[10px] leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className={label} htmlFor="el-photos">Add photos</label>
          <input id="el-photos" type="file" multiple accept={PHOTO_TYPES.join(",")}
            onChange={addPhotos} className="text-xs" />
        </div>

        <p className="text-[11px] text-stone-w">
          Name, category, and location are verified details — contact
          hello@karibu.co.ke to change them.
        </p>

        {notice === "saved" && <p className="text-xs text-forest font-semibold">Saved.</p>}
        {notice && notice !== "saved" && <p className="text-xs text-clay">{notice}</p>}
        {error && <p className="text-xs text-clay">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full bg-forest text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
