import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ["node_modules/**"],
  },
  ...compat.config({
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    env: {
      serviceworker: true,
    },
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/eslint-recommended",
      "plugin:@typescript-eslint/recommended",
    ],
    overrides: [
      {
        files: ["test/**/*.ts"],
        rules: {
          "@typescript-eslint/no-explicit-any": "off",
          "@typescript-eslint/no-unused-vars": "off",
        },
      },
    ],
  }),
];