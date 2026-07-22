import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Default: the Supabase client is a no-op whose query chain resolves to an
// empty result, so data hooks keep their fallbacks and never hit the network in
// tests. Individual tests can override with their own vi.mock if needed.
vi.mock("../lib/supabase", () => {
  const result = Promise.resolve({ data: null, error: null });
  const chain = {
    select: () => chain,
    update: () => chain,
    eq: () => chain,
    lt: () => chain,
    or: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => result,
    maybeSingle: () => result,
    then: (onFulfilled) => result.then(onFulfilled),
  };
  return {
    supabase: {
      from: () => chain,
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe() {} } },
        }),
        signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
        signInWithOAuth: () => Promise.resolve({ data: {}, error: null }),
        signInWithPassword: () =>
          Promise.resolve({ data: { session: null }, error: null }),
        signUp: () =>
          Promise.resolve({ data: { user: {}, session: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
      },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  };
});
