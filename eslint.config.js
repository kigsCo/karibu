// Flat ESLint config (ESLint 9). Replaces the legacy .eslintrc the scaffold
// never shipped. Tuned for a React 18 + Vite prototype mid data-migration:
// real-bug rules stay errors; prototype-stylistic noise is relaxed so the
// existing visual layer is not forced into churn.
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**", "node_modules/**", "supabase/functions/**", ".claude/worktrees/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      // Prototype reality: no prop-types, copy is full of apostrophes/quotes.
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Ignore unused capitalised imports (icon set) and _-prefixed args.
      "no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Vitest globals (test, expect, vi, ...) for test files — the
    // vitest.config.js `globals: true` option affects the test runtime only,
    // not ESLint's static analysis, so it needs its own globals here.
    files: ["**/*.{test,spec}.{js,jsx}", "src/test/**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.vitest },
    },
  },
];
