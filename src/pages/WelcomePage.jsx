import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  X,
  Mail,
  Lock,
  UserCircle,
  Loader2,
  AlertCircle,
  Check,
  Store,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

// ---------- SCREEN: WELCOME / SIGN IN LANDING ----------
// The auth landing page: Google OAuth, email+password sign-in / account
// creation, and the existing magic-link flow — plus the section that points
// business owners at /for-business (business accounts land there later).
// New screen, existing visual language: same tokens, cards, and copy voice as
// the rest of the prototype. Do-not-rebuild-the-UI still holds.

// Google's four-colour "G" — lucide carries no brand marks, so this one inline
// path set is the only non-lucide glyph in the app.
const GoogleG = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useAuth();

  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // check-your-inbox states

  // Already signed in (or the OAuth redirect just landed back here with a
  // session): go straight to the profile.
  // Auth-gated flows pass state.next to come back here after sign-in. OAuth
  // and magic-link redirects lose router state and fall back to /profile.
  const next = location.state?.next || "/profile";
  useEffect(() => {
    if (!loading && session) navigate(next, { replace: true });
  }, [loading, session, navigate, next]);

  const signInWithGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Redirects the whole tab to Google; on return supabase-js parses the
      // URL (detectSessionInUrl) and AuthContext picks up the session.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/welcome` },
      });
      if (oauthError) throw oauthError;
    } catch (e) {
      setError(e.message || "Couldn't start Google sign-in. Please try again.");
      setBusy(false);
    }
    // No finally: on success the browser is navigating away.
  };

  const submit = async () => {
    const addr = email.trim();
    if (!addr || !password || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: addr,
          password,
          options: {
            // Feeds raw_user_meta_data -> the handle_new_user trigger, so the
            // profile row is named from the very first moment.
            data: { full_name: fullName.trim() || null },
            emailRedirectTo: `${window.location.origin}/welcome`,
          },
        });
        if (signUpError) throw signUpError;
        // With email confirmation ON there is no session yet — tell them to
        // check their inbox. With it OFF the redirect effect takes over.
        if (!data?.session) {
          setNotice({
            title: "Check your inbox",
            body: `We sent a confirmation link to ${addr}. Open it to finish creating your account.`,
          });
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: addr,
          password,
        });
        if (signInError) throw signInError;
        // Session lands in AuthContext; the redirect effect navigates.
      }
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    const addr = email.trim();
    if (busy) return;
    if (!addr) {
      setError("Enter your email above first, then we can send you a link.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: `${window.location.origin}/welcome` },
      });
      if (otpError) throw otpError;
      setNotice({
        title: "Check your inbox",
        body: `We sent a sign-in link to ${addr}. Open it on this device to finish signing in.`,
      });
    } catch (e) {
      setError(e.message || "Couldn't send the sign-in link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="fade-in flex flex-col items-center justify-center h-full py-20">
        <Loader2 size={22} className="text-clay animate-spin" />
      </div>
    );
  }

  const canSubmit = email.trim() && password.length >= 6 && !busy;

  return (
    <div className="fade-in">
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          aria-label="Close"
          onClick={() => navigate("/")}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <X size={16} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Karibu</h2>
        <span className="w-8" />
      </div>

      <div className="px-5 md:px-8 pt-6 pb-4 text-center">
        <div className="w-14 h-14 rounded-full bg-ivory-2 flex items-center justify-center mb-4 mx-auto">
          <UserCircle size={24} className="text-clay" />
        </div>
        <h1 className="font-serif-d text-3xl text-ink leading-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-stone-w max-w-xs mx-auto mt-2">
          Karibu means welcome. Sign in to leave reviews, save places, and get
          recommendations that follow you across devices.
        </p>
      </div>

      <div className="px-5 md:px-8 pb-6 max-w-xs mx-auto w-full space-y-3">
        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-ink-10 bg-white text-sm font-semibold text-ink"
        >
          <GoogleG />
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <span className="flex-1 border-t border-ink-10" />
          <span className="text-[11px] uppercase tracking-wide text-stone-w">
            or
          </span>
          <span className="flex-1 border-t border-ink-10" />
        </div>

        {notice ? (
          <div className="p-4 rounded-xl bg-forest-soft border border-ink-10 fade-in">
            <div className="flex items-center gap-2 justify-center mb-1">
              <Check size={16} className="text-forest" />
              <span className="text-sm font-semibold text-forest">
                {notice.title}
              </span>
            </div>
            <p className="text-xs text-stone-w text-center">{notice.body}</p>
            <button
              onClick={() => setNotice(null)}
              className="mt-3 mx-auto block text-xs text-clay font-semibold"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {mode === "signup" && (
              <div className="flex items-center bg-white border border-ink-10 rounded-xl px-3 py-2.5">
                <UserCircle size={15} className="text-stone-w flex-shrink-0" />
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="flex-1 bg-transparent text-sm text-ink font-sans-d outline-none ml-2"
                />
              </div>
            )}
            <div className="flex items-center bg-white border border-ink-10 rounded-xl px-3 py-2.5">
              <Mail size={15} className="text-stone-w flex-shrink-0" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 bg-transparent text-sm text-ink font-sans-d outline-none ml-2"
              />
            </div>
            <div className="flex items-center bg-white border border-ink-10 rounded-xl px-3 py-2.5">
              <Lock size={15} className="text-stone-w flex-shrink-0" />
              <input
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) submit();
                }}
                placeholder={
                  mode === "signup" ? "Password (6+ characters)" : "Password"
                }
                className="flex-1 bg-transparent text-sm text-ink font-sans-d outline-none ml-2"
              />
            </div>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
                canSubmit
                  ? "bg-clay text-white"
                  : "bg-ivory-2 text-stone-w cursor-not-allowed"
              }`}
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {mode === "signup" ? "Creating account…" : "Signing in…"}
                </>
              ) : mode === "signup" ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </button>

            {error && (
              <div className="p-3 rounded-xl bg-clay-soft border border-clay text-xs text-ink flex items-start gap-2 text-left">
                <AlertCircle
                  size={13}
                  className="text-clay flex-shrink-0 mt-0.5"
                />
                <span>{error}</span>
              </div>
            )}

            <div className="text-center pt-1 space-y-1.5">
              <button
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError(null);
                }}
                className="text-xs text-ink"
              >
                {mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <span className="text-clay font-semibold">Sign in</span>
                  </>
                ) : (
                  <>
                    New to Karibu?{" "}
                    <span className="text-clay font-semibold">
                      Create an account
                    </span>
                  </>
                )}
              </button>
              <button
                onClick={sendMagicLink}
                className="block mx-auto text-xs text-stone-w underline underline-offset-2"
              >
                Email me a sign-in link instead
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          className="block mx-auto text-xs text-stone-w pt-1"
        >
          Continue as guest
        </button>
      </div>

      {/* The businesses section — the door to the business side of Karibu.
          Business accounts hang off /for-business later; this only directs. */}
      <div className="px-5 md:px-8 pb-8 max-w-xs mx-auto w-full">
        <button
          onClick={() => navigate("/for-business")}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border border-ink-10 bg-white text-left"
        >
          <div className="w-10 h-10 rounded-full bg-forest-soft flex items-center justify-center flex-shrink-0">
            <Store size={16} className="text-forest" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-ink">
              Own a business in Kenya?
            </div>
            <div className="text-xs text-stone-w">
              Get verified and reach newcomers on Karibu.
            </div>
          </div>
          <ChevronRight size={16} className="text-stone-w flex-shrink-0" />
        </button>
      </div>
    </div>
  );
}
