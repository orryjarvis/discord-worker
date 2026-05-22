import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "eslint.config.mjs"],
  },
  tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.worker.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.serviceworker,
    },
  },
  {
    files: [
      "scripts/**/*.ts",
      "test/**/*.ts",
      "vitest.config.ts",
      "test/e2e/vitest.e2e.config.ts",
      "test/e2e/vitest.smoke.config.ts",
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
);
