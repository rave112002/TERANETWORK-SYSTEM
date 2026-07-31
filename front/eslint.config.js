import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist"],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // ── React Compiler rules (new in eslint-plugin-react-hooks v7) ──
      // Downgraded to "warn" deliberately. v7 arrived as a forced peer bump of
      // the eslint 9 → 10 security upgrade, and its new rules flag existing
      // code — including `Roles/hooks.jsx` and the form drawers, which
      // `modern-module-pattern.md` and `ui-form-design.md` hold up as the
      // reference implementation. Fixing them means changing the documented
      // pattern, so that's a deliberate follow-up rather than a side effect of
      // a security patch. Findings stay visible; they just don't fail the run.
      // Promote back to "error" once the code and those docs are updated.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    // Generated shadcn/ui primitives export variant helpers (buttonVariants,
    // badgeVariants) and hooks (useFormField) alongside their components — a
    // deliberate part of the shadcn design. Don't flag fast-refresh here.
    files: ["src/components/ui/**/*.{js,jsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
];
