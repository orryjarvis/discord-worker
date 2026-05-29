import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "eslint.config.mjs"],
  },
  tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./src/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.serviceworker,
    },
  },
  {
    files: ["vite.config.ts", "scripts/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./scripts/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
  },
  {
    files: ["test/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./test/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
  },
  {
    files: ["e2e/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./e2e/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
  },
  {
    files: ["test/**/*.ts", "e2e/**/*.ts"],
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
