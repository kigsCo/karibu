// src/pages/RegisterBusinessPage.jsx
// The intake form for a NEW listing (spec: onboarding spine). Uploads go
// straight to storage from the browser (own-folder paths, enforced by
// storage RLS); the business-intake edge function is the only writer of the
// pending row. The server re-validates everything — this form's checks are
// UX, not security.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { functionErrorMessage } from "../lib/functionError";
import { useAuth } from "../context/AuthContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = [...PHOTO_TYPES, "application/pdf"];

function fileProblem(file, types) {
  if (!types.includes(file.type)) return `${file.name}: unsupported file type`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: larger than 5 MB`;
  return null;
}

const field =
  "w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-forest/40";
const label = "block text-sm font-semibold text-ink mb-1.5";

export default function RegisterBusinessPage() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const { cities, categories } = useReferenceData();

  const [form, setForm] = useState({
    name: "",
    category_slug: "",
    sub_type_slug: "",
    city_slug: "",
    hood: "",
    address: "",
    about: "",
    phone: "",
    hours_display: "",
    kra_pin: "",
    applicant_note: "",
    lat: null,
    lng: null,
  });
  const [photos, setPhotos] = useState([]); // File[]
  const [idDoc, setIdDoc] = useState(null); // File | null
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const city = useMemo(
    () => cities.find((c) => c.key === form.city_slug) || null,
    [cities, form.city_slug],
  );
  const category = useMemo(
    () => categories.find((c) => c.key === form.category_slug) || null,
    [categories, form.category_slug],
  );
  // Restaurants carry their sub-types as `cuisineTags` with `subTypes: []`
  // (see ReferenceDataContext) — fall back to those so the dropdown isn't
  // permanently disabled for that category.
  const subTypeOptions =
    (category?.subTypes?.length ? category.subTypes : category?.cuisineTags) || [];

  if (!session) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">List your business</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Sign in first so we know who to talk to about your application.
        </p>
        <button
          type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() =>
            navigate("/welcome", { state: { next: "/for-business/register" } })
          }
        >
          Sign in to continue
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">Application received</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Your listing is under review. Our Nairobi team checks every
          application by hand — allow up to 48 hours. You can follow its status
          on the For Business page.
        </p>
        <button
          type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() => navigate("/for-business")}
        >
          Back to For Business
        </button>
      </div>
    );
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({
          ...f,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        })),
      () => setError("Couldn't read your location — you can leave the pin empty."),
    );
  };

  const onPhotos = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 10);
    for (const f of files) {
      const problem = fileProblem(f, PHOTO_TYPES);
      if (problem) return setError(problem);
    }
    setError(null);
    setPhotos(files);
  };

  const onIdDoc = (e) => {
    const f = (e.target.files || [])[0] || null;
    if (f) {
      const problem = fileProblem(f, DOC_TYPES);
      if (problem) return setError(problem);
    }
    setError(null);
    setIdDoc(f);
  };

  async function uploadTo(bucket, file) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upError } = await supabase.storage.from(bucket).upload(path, file);
    if (upError) throw new Error(upError.message);
    return path;
  }

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) return setError("Business name is required.");
    if (!form.category_slug) return setError("Pick a category.");
    if (!form.city_slug || !form.hood) return setError("Pick your city and neighbourhood.");
    if (form.about.trim().length < 20) {
      return setError("Tell visitors a little more — at least 20 characters.");
    }
    if (!form.phone.trim()) return setError("A phone number is required.");
    if (!form.hours_display.trim()) return setError("Opening hours are required.");
    if (!/^[AP][0-9]{9}[A-Z]$/.test(form.kra_pin.trim().toUpperCase())) {
      return setError("KRA PIN must look like A123456789Z.");
    }
    if (photos.length < 3) return setError("Add at least 3 photos of your business.");
    if (!idDoc) return setError("Upload an ID document so we can verify you.");

    setSubmitting(true);
    try {
      const photoPaths = [];
      for (const f of photos) photoPaths.push(await uploadTo("business-photos", f));
      const idPath = await uploadTo("verification-docs", idDoc);

      const { data, error: fnError } = await supabase.functions.invoke("business-intake", {
        body: {
          action: "register",
          name: form.name.trim(),
          category_slug: form.category_slug,
          sub_type_slug: form.sub_type_slug || undefined,
          city_slug: form.city_slug,
          hood: form.hood,
          address: form.address.trim() || undefined,
          about: form.about.trim(),
          phone: form.phone.trim(),
          hours_display: form.hours_display.trim(),
          kra_pin: form.kra_pin.trim().toUpperCase(),
          applicant_note: form.applicant_note.trim() || undefined,
          lat: form.lat ?? undefined,
          lng: form.lng ?? undefined,
          photo_paths: photoPaths,
          id_document_path: idPath,
        },
      });
      if (fnError) throw new Error(await functionErrorMessage(fnError, "Submission failed"));
      if (data?.error) throw new Error(data.error);
      setDone(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] pb-16">
      <div className="px-5 md:px-8 pt-5 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/for-business")}
          className="flex items-center gap-1 text-sm text-stone-500 mb-4"
        >
          <ChevronLeft size={16} /> For Business
        </button>
        <h1 className="font-serif text-2xl text-ink mb-1">List your business</h1>
        <p className="text-sm text-stone-500 mb-6">
          Every listing is verified by our Nairobi team before it goes live.
        </p>

        <div className="space-y-5">
          <div>
            <label className={label} htmlFor="rb-name">Business name</label>
            <input id="rb-name" className={field} value={form.name} onChange={set("name")} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="rb-category">Category</label>
              <select id="rb-category" className={field}
                value={form.category_slug}
                onChange={(e) => setForm((f) => ({ ...f, category_slug: e.target.value, sub_type_slug: "" }))}>
                <option value="">Choose...</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="rb-subtype">Sub-type (optional)</label>
              <select id="rb-subtype" className={field}
                value={form.sub_type_slug} onChange={set("sub_type_slug")}
                disabled={!category || !subTypeOptions.length}>
                <option value="">Choose...</option>
                {subTypeOptions.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="rb-city">City</label>
              <select id="rb-city" className={field}
                value={form.city_slug}
                onChange={(e) => setForm((f) => ({ ...f, city_slug: e.target.value, hood: "" }))}>
                <option value="">Choose...</option>
                {cities.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="rb-hood">Neighbourhood</label>
              <select id="rb-hood" className={field}
                value={form.hood} onChange={set("hood")} disabled={!city}>
                <option value="">Choose...</option>
                {(city?.hoods || []).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="rb-address">Street address (optional)</label>
            <input id="rb-address" className={field} value={form.address} onChange={set("address")} />
          </div>

          <div>
            <label className={label} htmlFor="rb-about">About your business</label>
            <textarea id="rb-about" rows={4} className={field}
              value={form.about} onChange={set("about")}
              placeholder="What do you do, and what should a newcomer know?" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="rb-phone">Phone</label>
              <input id="rb-phone" className={field} value={form.phone}
                onChange={set("phone")} placeholder="07XX XXX XXX" />
            </div>
            <div>
              <label className={label} htmlFor="rb-hours">Opening hours</label>
              <input id="rb-hours" className={field} value={form.hours_display}
                onChange={set("hours_display")} placeholder="Mon-Sat 9am-7pm" />
            </div>
          </div>

          <div>
            <span className={label}>Location pin (optional)</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={useMyLocation}
                className="bg-white border border-stone-300 rounded-xl px-4 py-2.5 text-sm font-semibold">
                Use my current location
              </button>
              <span className="text-xs text-stone-500">
                {form.lat != null ? `${form.lat}, ${form.lng}` : "No pin set"}
              </span>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="rb-photos">Photos (at least 3)</label>
            <input id="rb-photos" type="file" multiple accept={PHOTO_TYPES.join(",")}
              onChange={onPhotos} className="text-sm" />
            {photos.length > 0 && (
              <p className="text-xs text-stone-500 mt-1">{photos.length} selected</p>
            )}
          </div>

          <div>
            <label className={label} htmlFor="rb-kra">KRA PIN</label>
            <input id="rb-kra" className={field} value={form.kra_pin}
              onChange={set("kra_pin")} placeholder="A123456789Z" />
          </div>

          <div>
            <label className={label} htmlFor="rb-iddoc">ID document (owner or manager)</label>
            <input id="rb-iddoc" type="file" accept={DOC_TYPES.join(",")}
              onChange={onIdDoc} className="text-sm" />
            <p className="text-xs text-stone-500 mt-1">
              Private — only our verification team can see this.
            </p>
          </div>

          <div>
            <label className={label} htmlFor="rb-note">Anything else? (optional)</label>
            <textarea id="rb-note" rows={2} className={field}
              value={form.applicant_note} onChange={set("applicant_note")} />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button type="button" onClick={submit} disabled={submitting}
            className="w-full bg-forest text-white rounded-xl px-6 py-3.5 text-sm font-semibold disabled:opacity-60">
            {submitting ? "Submitting..." : "Submit application"}
          </button>
          <p className="text-xs text-stone-500">
            By submitting you confirm you're authorised to represent this
            business. Review usually takes under 48 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
