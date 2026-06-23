// src/lib/supabase.js
// The single browser Supabase client. Only the two PUBLIC values belong here
// (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY). No service-role key, no
// Anthropic key — server-only secrets never touch the frontend bundle.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev, but do NOT throw at import — a missing .env must not
  // blank the app. Calls will surface through each screen's own error UI.
  console.warn(
    "[Karibu] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — " +
      "copy .env.example to .env and fill in your Supabase project values."
  );
}

// Fallbacks keep createClient constructible when env is absent so the UI still
// renders; they point nowhere real and any request fails gracefully.
export const supabase = createClient(
  url || "http://127.0.0.1:54321",
  anonKey || "anon-key-not-set"
);
