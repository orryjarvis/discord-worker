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
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/discord|github|cloudflare/i]",
          message: "Do not introduce platform-specific terms in core contracts.",
        },
        {
          selector: "ImportDeclaration[source.value^='../']",
          message: "Core modules must only import from within src/core or from npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='../']",
          message: "Core modules must only re-export from within src/core or from npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='../']",
          message: "Core modules must only re-export from within src/core or from npm packages.",
        },
      ],
    },
  },
  {
    files: ["src/skills/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../integrations/'])",
          message: "Skills modules may only import from src/core, src/integrations, or npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../integrations/'])",
          message: "Skills modules may only re-export from src/core, src/integrations, or npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../integrations/'])",
          message: "Skills modules may only re-export from src/core, src/integrations, or npm packages.",
        },
      ],
    },
  },
  {
    files: ["src/integrations/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value^='../']:not([source.value^='../core/'])",
          message: "Integrations modules may only import from src/core or npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='../']:not([source.value^='../core/'])",
          message: "Integrations modules may only re-export from src/core or npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='../']:not([source.value^='../core/'])",
          message: "Integrations modules may only re-export from src/core or npm packages.",
        },
      ],
    },
  },
  {
    files: ["src/commands/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../skills/'])",
          message: "Commands modules may only import from src/core, src/skills, or npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../skills/'])",
          message: "Commands modules may only re-export from src/core, src/skills, or npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../skills/'])",
          message: "Commands modules may only re-export from src/core, src/skills, or npm packages.",
        },
      ],
    },
  },
  {
    files: ["src/handlers/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../commands/'])",
          message: "Handlers modules may only import from src/core, src/commands, or npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../commands/'])",
          message: "Handlers modules may only re-export from src/core, src/commands, or npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='../']:not([source.value^='../core/']):not([source.value^='../commands/'])",
          message: "Handlers modules may only re-export from src/core, src/commands, or npm packages.",
        },
      ],
    },
  },
  {
    files: ["src/app.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value^='./']:not([source.value^='./handlers/']):not([source.value^='./core/'])",
          message: "app.ts may only import from ./handlers/ or ./core/.",
        },
        {
          selector: "ImportDeclaration[source.value^='../']",
          message: "app.ts must not use parent-directory imports.",
        },
      ],
    },
  },
);
