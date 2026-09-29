import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/.turbo/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
  ]),
  {
    files: ["packages/**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["apps/tickets/**/*.{js,jsx,mjs,ts,tsx}"],
    extends: [...nextVitals, ...nextTs],
  },
]);

export default eslintConfig;
