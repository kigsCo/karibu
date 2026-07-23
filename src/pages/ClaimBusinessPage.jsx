// src/pages/ClaimBusinessPage.jsx
// "This is my business" on an existing listing. Short evidence form; the
// business-intake edge function is the only writer, and re-validates
// everything. The dead-end (already managed) is checked here for UX and
// enforced server-side regardless.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const field =
  "w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-forest/40";
const label = "block text-sm font-semibold text-ink mb-1.5";

export default function ClaimBusinessPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { session, user } = useAuth();

  const [biz, setBiz] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ role_title: "", kra_pin: "", contact_phone: "", note: "" });
  const [idDoc, setIdDoc] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("businesses")
      .select("id, name, owner_id")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setBiz(data ?? null);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  if (!session) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">Claim this listing</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Sign in first so the listing can be linked to your account.
        </p>
        <button type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() => navigate("/welcome", { state: { next: `/b/${slug}/claim` } })}>
          Sign in to continue
        </button>
      </div>
    );
  }

  if (loaded && (!biz || biz.owner_id)) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">
          {biz ? "Already managed" : "Listing not found"}
        </h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          {biz
            ? "This listing already has an owner on Karibu. If you believe that's wrong, contact hello@karibu.co.ke."
            : "We couldn't find that listing."}
        </p>
        <button type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl text-ink mb-2">Claim received</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Your claim is under review — allow up to 48 hours. You can follow its
          status on the For Business page.
        </p>
        <button type="button"
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
          onClick={() => navigate("/for-business")}>
          Back to For Business
        </button>
      </div>
    );
  }

  const onIdDoc = (e) => {
    const f = (e.target.files || [])[0] || null;
    if (f && (!DOC_TYPES.includes(f.type) || f.size > MAX_FILE_BYTES)) {
      return setError(`${f.name}: must be an image or PDF under 5 MB`);
    }
    setError(null);
    setIdDoc(f);
  };

  const submit = async () => {
    setError(null);
    if (!/^[AP][0-9]{9}[A-Z]$/.test(form.kra_pin.trim().toUpperCase())) {
      return setError("KRA PIN must look like A123456789Z.");
    }
    if (!form.contact_phone.trim()) return setError("A phone number is required.");
    if (!idDoc) return setError("Upload an ID document so we can verify you.");
    setSubmitting(true);
    try {
      const ext = (idDoc.name.split(".").pop() || "bin").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await supabase.storage
        .from("verification-docs").upload(path, idDoc);
      if (upError) throw new Error(upError.message);

      const { data, error: fnError } = await supabase.functions.invoke("business-intake", {
        body: {
          action: "claim",
          business_id: biz.id,
          role_title: form.role_title.trim() || undefined,
          kra_pin: form.kra_pin.trim().toUpperCase(),
          contact_phone: form.contact_phone.trim(),
          id_document_path: path,
          note: form.note.trim() || undefined,
        },
      });
      if (fnError) throw new Error(fnError.message || "Submission failed");
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
      <div className="px-5 md:px-8 pt-5 max-w-xl mx-auto">
        <button type="button" onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-stone-500 mb-4">
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="font-serif text-2xl text-ink mb-1">
          Claim {biz?.name || "this listing"}
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          Prove you run this business and we'll hand you the keys after a quick
          human review.
        </p>

        <div className="space-y-5">
          <div>
            <label className={label} htmlFor="cb-role">Your role (optional)</label>
            <input id="cb-role" className={field} value={form.role_title}
              onChange={set("role_title")} placeholder="Owner, manager..." />
          </div>
          <div>
            <label className={label} htmlFor="cb-kra">KRA PIN</label>
            <input id="cb-kra" className={field} value={form.kra_pin}
              onChange={set("kra_pin")} placeholder="A123456789Z" />
          </div>
          <div>
            <label className={label} htmlFor="cb-phone">Phone</label>
            <input id="cb-phone" className={field} value={form.contact_phone}
              onChange={set("contact_phone")} placeholder="07XX XXX XXX" />
          </div>
          <div>
            <label className={label} htmlFor="cb-iddoc">ID document</label>
            <input id="cb-iddoc" type="file" accept={DOC_TYPES.join(",")}
              onChange={onIdDoc} className="text-sm" />
            <p className="text-xs text-stone-500 mt-1">
              Private — only our verification team can see this.
            </p>
          </div>
          <div>
            <label className={label} htmlFor="cb-note">Anything else? (optional)</label>
            <textarea id="cb-note" rows={2} className={field}
              value={form.note} onChange={set("note")} />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button type="button" onClick={submit} disabled={submitting}
            className="w-full bg-forest text-white rounded-xl px-6 py-3.5 text-sm font-semibold disabled:opacity-60">
            {submitting ? "Submitting..." : "Submit claim"}
          </button>
        </div>
      </div>
    </div>
  );
}
