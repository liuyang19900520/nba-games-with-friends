import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  // 1. Next.js Base Config (Flat Config compatible via FlatCompat)
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 2. Global Ignores
  { ignores: [".next", "dist", "node_modules", "*.config.*", "public"] },

  // 3. Custom Rules for source files
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // We are fixing images, but allow warning for remaining ones
      "@next/next/no-img-element": "warn",
    },
  },
];

export default config;
