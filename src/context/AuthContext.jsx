// src/context/AuthContext.jsx
// Minimal auth state (FIX_PLAN P0 #6). Everything user-owned — persisted
// reviews, saved places, merchant, checkout — is blocked on knowing whether
// there is a signed-in user. This provider is the single source of that truth.
//
// It holds only the Supabase session: reads it once on mount and then follows
// supabase.auth.onAuthStateChange, which fires when a magic-link sign-in
// completes (supabase-js parses the returning URL automatically) and on sign
// out. No UI, no network beyond Supabase Auth's own calls.
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // `loading` is true until the initial getSession resolves, so screens can tell
  // "not signed in" apart from "don't know yet" and avoid flashing a signed-out
  // state for a user who actually has a session.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });

    // Fires on SIGNED_IN (incl. the magic-link redirect), TOKEN_REFRESHED,
    // SIGNED_OUT. Keeping session in sync here means the whole tree re-renders
    // the moment auth changes, with no manual refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
