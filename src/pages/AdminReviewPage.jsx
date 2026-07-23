// Staff-only onboarding queue. The is_staff read here is a UX gate; the
// admin-review function re-checks it with the service role on every call, so
// nothing on this page grants any capability by itself.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { functionErrorMessage } from "../lib/functionError";
import { useAuth } from "../context/AuthContext.jsx";

function QueueCard({ title, subtitle, fields, docUrl, onApprove, onReject }) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (fn, requireReason) => {
    if (requireReason && reason.trim().length < 3) {
      setReasonError(true);
      return;
    }
    setReasonError(false);
    setBusy(true);
    try {
      await fn(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <p className="font-serif text-lg text-ink">{title}</p>
      <p className="text-xs text-stone-500 mb-3">{subtitle}</p>
      <dl className="text-sm space-y-1 mb-3">
        {fields.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-stone-500 w-28 shrink-0">{k}</dt>
            <dd className="font-medium break-all">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      {docUrl && (
        <a href={docUrl} target="_blank" rel="noreferrer"
          className="text-sm text-forest underline underline-offset-2">
          View ID document
        </a>
      )}
      <div className="mt-4 space-y-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required to reject)"
          className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-sm"
        />
        {reasonError && (
          <p className="text-xs text-red-700">A reason is required to reject.</p>
        )}
        <div className="flex gap-2">
          <button type="button" disabled={busy}
            onClick={() => act(onApprove, false)}
            className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
            Approve
          </button>
          <button type="button" disabled={busy}
            onClick={() => act(onReject, true)}
            className="flex-1 bg-white border border-red-300 text-red-700 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminReviewPage() {
  const { user, loading } = useAuth();
  const [isStaff, setIsStaff] = useState(null); // null = checking
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Auth is still resolving (e.g. a direct /admin load, getSession() not
    // yet settled) — stay in the "checking" state rather than flashing "Not
    // authorized" for a staff member whose session hasn't loaded yet.
    if (loading) return undefined;
    if (!user) {
      setIsStaff(false);
      return undefined;
    }
    let cancelled = false;
    supabase
      .from("profiles").select("is_staff").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsStaff(Boolean(data?.is_staff));
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const loadQueue = useCallback(async () => {
    const { data, error: fnError } = await supabase.functions.invoke("admin-review", {
      body: { action: "queue" },
    });
    if (fnError || data?.error) {
      setError(
        fnError
          ? await functionErrorMessage(fnError, "Could not load the queue")
          : data?.error || "Could not load the queue",
      );
      return;
    }
    setError(null);
    setQueue(data);
  }, []);

  useEffect(() => {
    if (isStaff) loadQueue();
  }, [isStaff, loadQueue]);

  const decide = useCallback(
    async (action, kind, id, reason) => {
      const { data, error: fnError } = await supabase.functions.invoke("admin-review", {
        body: { action, kind, id, ...(reason ? { reason } : {}) },
      });
      if (fnError || data?.error) {
        setError(
          fnError
            ? await functionErrorMessage(fnError, "Action failed")
            : data?.error || "Action failed",
        );
      }
      await loadQueue();
    },
    [loadQueue],
  );

  if (isStaff === null) {
    return <div className="min-h-screen bg-[#FAF7F0]" />;
  }
  if (!isStaff) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-6">
        <p className="text-sm text-stone-500">Not authorized.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] pb-16">
      <div className="px-5 md:px-8 pt-6 max-w-3xl mx-auto">
        <h1 className="font-serif text-2xl text-ink mb-1">Onboarding review</h1>
        <p className="text-sm text-stone-500 mb-6">
          Pending registrations and ownership claims. Every decision is logged.
        </p>
        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

        <h2 className="font-semibold text-sm text-stone-600 uppercase tracking-wide mb-3">
          New registrations
        </h2>
        <div className="space-y-4 mb-8">
          {(queue?.registrations ?? []).map((r) => (
            <QueueCard
              key={r.id}
              title={r.name}
              subtitle={`${r.category?.label ?? ""} · ${r.hood}, ${r.city?.name ?? ""}`}
              fields={[
                ["KRA PIN", r.verification?.kra_pin],
                ["Phone", r.verification?.contact_phone],
                ["Note", r.verification?.applicant_note],
                ["Submitted", r.created_at],
              ]}
              docUrl={r.id_document_url}
              onApprove={() => decide("approve", "registration", r.id)}
              onReject={(reason) => decide("reject", "registration", r.id, reason)}
            />
          ))}
          {queue && queue.registrations.length === 0 && (
            <p className="text-sm text-stone-400">Nothing pending.</p>
          )}
        </div>

        <h2 className="font-semibold text-sm text-stone-600 uppercase tracking-wide mb-3">
          Ownership claims
        </h2>
        <div className="space-y-4">
          {(queue?.claims ?? []).map((c) => (
            <QueueCard
              key={c.id}
              title={c.business?.name ?? "Listing"}
              subtitle={`Claimed ${c.created_at}`}
              fields={[
                ["Role", c.role_title],
                ["KRA PIN", c.kra_pin],
                ["Phone", c.contact_phone],
                ["Note", c.note],
              ]}
              docUrl={c.id_document_url}
              onApprove={() => decide("approve", "claim", c.id)}
              onReject={(reason) => decide("reject", "claim", c.id, reason)}
            />
          ))}
          {queue && queue.claims.length === 0 && (
            <p className="text-sm text-stone-400">Nothing pending.</p>
          )}
        </div>
      </div>
    </div>
  );
}
