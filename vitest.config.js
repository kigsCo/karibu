import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
    // Scope to the frontend test tree only. Vitest's default include glob is
    // repo-wide and would otherwise also pick up the pre-existing Deno tests
    // under supabase/functions/**/*.test.ts (they use `jsr:` imports Vite
    // cannot resolve and are run separately via `deno test`), plus any nested
    // git worktrees checked out under .claude/worktrees/.
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
  },
});
