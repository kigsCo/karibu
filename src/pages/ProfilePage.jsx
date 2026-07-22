import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircle,
  Mail,
  LogOut,
  Check,
  Loader2,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";
import { useProfile } from "../hooks/useProfile.js";

// ---------- SCREEN: PROFILE / AUTH ----------
// Minimal auth surface (FIX_PLAN P0 #6): a passwordless email sign-in link.
// Visual language is the prototype's — same palette, type, and card style as the
// other placeholder screens; this is the one screen the plan allows new UI on,
// kept as small as possible.
export default function ProfilePage() {
  const navigate = useNavigate();
  const { session, user, loading, signOut } = useAuth();
  const {
    profile,
    saving: savingName,
    error: profileError,
    saveName,
  } = useProfile();
  const [nameDraft, setNameDraft] = useState(null); // null = not editing
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const sendLink = async () => {
    const addr = email.trim();
    if (!addr || sending) return;
    setSending(true);
    setError(null);
    try {
      // Passwordless: Supabase emails a sign-in link. supabase-js parses the
      // returning URL automatically (detectSessionInUrl), so the AuthContext
      // subscription picks up the session with no extra handling here.
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: window.location.origin },
      });
      if (otpError) throw otpError;
      setSent(true);
    } catch (e) {
      setError(e.message || "Couldn't send the sign-in link. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="fade-in flex flex-col items-center justify-center h-full py-20">
        <Loader2 size={22} className="text-clay animate-spin" />
      </div>
    );
  }

  if (session) {
    // The profiles row (customer database) supplies name/avatar; the session
    // email is the fallback so a failed profile fetch never blanks the screen.
    const displayName = profile?.full_name || null;
    return (
      <div className="fade-in flex flex-col items-center px-8 py-16 text-center">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full object-cover mb-4"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-ivory-2 flex items-center justify-center mb-4">
            <UserCircle size={24} className="text-clay" />
          </div>
        )}
        <h2 className="font-serif-d text-2xl text-ink mb-1">
          {displayName || "Your profile"}
        </h2>
        <p className="text-sm text-stone-w max-w-xs mb-4">
          Signed in as{" "}
          <span className="text-ink font-medium break-all">
            {profile?.email || user?.email}
          </span>
        </p>

        {nameDraft === null ? (
          <button
            onClick={() => setNameDraft(displayName || "")}
            className="inline-flex items-center gap-1.5 text-xs text-clay font-semibold mb-6"
          >
            <Pencil size={12} />
            {displayName ? "Edit name" : "Add your name"}
          </button>
        ) : (
          <div className="w-full max-w-xs space-y-2 mb-6">
            <div className="flex items-center bg-white border border-ink-10 rounded-xl px-3 py-2.5">
              <UserCircle size={15} className="text-stone-w flex-shrink-0" />
              <input
                type="text"
                autoComplete="name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Your name"
                className="flex-1 bg-transparent text-sm text-ink font-sans-d outline-none ml-2"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const ok = await saveName(nameDraft);
                  if (ok) setNameDraft(null);
                }}
                disabled={savingName}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-clay text-white flex items-center justify-center gap-2"
              >
                {savingName ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
              <button
                onClick={() => setNameDraft(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-ink-10 bg-white text-ink"
              >
                Cancel
              </button>
            </div>
            {profileError && (
              <div className="p-3 rounded-xl bg-clay-soft border border-clay text-xs text-ink flex items-start gap-2 text-left">
                <AlertCircle
                  size={13}
                  className="text-clay flex-shrink-0 mt-0.5"
                />
                <span>{profileError}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-ink-10 bg-white text-sm font-semibold text-ink"
        >
          <LogOut size={15} className="text-clay" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in flex flex-col items-center px-8 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-ivory-2 flex items-center justify-center mb-4">
        <UserCircle size={24} className="text-clay" />
      </div>
      <h2 className="font-serif-d text-2xl text-ink mb-1">Sign in to Karibu</h2>
      <p className="text-sm text-stone-w max-w-xs mb-6">
        Sign in to leave reviews and sync your saved places across devices. We'll
        email you a secure sign-in link — no password needed.
      </p>

      {!sent ? (
        <div className="w-full max-w-xs space-y-2">
          <div className="flex items-center bg-white border border-ink-10 rounded-xl px-3 py-2.5">
            <Mail size={15} className="text-stone-w flex-shrink-0" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendLink();
              }}
              placeholder="you@example.com"
              className="flex-1 bg-transparent text-sm text-ink font-sans-d outline-none ml-2"
            />
          </div>
          <button
            onClick={sendLink}
            disabled={!email.trim() || sending}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
              email.trim() && !sending
                ? "bg-clay text-white"
                : "bg-ivory-2 text-stone-w cursor-not-allowed"
            }`}
          >
            {sending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Sending…
              </>
            ) : (
              "Email me a sign-in link"
            )}
          </button>
          {error && (
            <div className="p-3 rounded-xl bg-clay-soft border border-clay text-xs text-ink flex items-start gap-2 text-left">
              <AlertCircle size={13} className="text-clay flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-xs p-4 rounded-xl bg-forest-soft border border-ink-10 fade-in">
          <div className="flex items-center gap-2 justify-center mb-1">
            <Check size={16} className="text-forest" />
            <span className="text-sm font-semibold text-forest">
              Check your inbox
            </span>
          </div>
          <p className="text-xs text-stone-w">
            We sent a sign-in link to{" "}
            <span className="text-ink font-medium break-all">{email.trim()}</span>.
            Open it on this device to finish signing in.
          </p>
          <button
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="mt-3 text-xs text-clay font-semibold"
          >
            Use a different email
          </button>
        </div>
      )}

      <button
        onClick={() => navigate("/welcome")}
        className="mt-4 text-xs text-clay font-semibold"
      >
        Prefer Google or a password? More sign-in options
      </button>
    </div>
  );
}
