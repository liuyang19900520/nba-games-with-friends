// ESLint v9+ flat config
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import nextPlugin from "@next/eslint-plugin-next";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  // Next.js recommended rules (includes core-web-vitals checks)
  ...compat.extends("next/core-web-vitals"),
  // Project-level ignores
  { ignores: ["dist", "node_modules", "*.config.*", "public"] },
  // TypeScript / React config for app source
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      parser,
      parserOptions: {
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: "readonly",
        JSX: "readonly",
        // browser / DOM globals
        window: "readonly",
        document: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        Element: "readonly",
        IntersectionObserver: "readonly",
        // node globals
        process: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@next/next": nextPlugin,
    },
    rules: {
      // Base JS / TS / React rules
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Disable react-refresh rule globally; handled by Next already
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
