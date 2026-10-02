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
    files: ["**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/\\.(js|ts)$/]",
          message: "Do not include file extensions in imports.",
        },
        {
          selector: "ExportNamedDeclaration[source.value=/\\.(js|ts)$/]",
          message: "Do not include file extensions in re-exports.",
        },
        {
          selector: "ExportAllDeclaration[source.value=/\\.(js|ts)$/]",
          message: "Do not include file extensions in re-exports.",
        },
        {
          selector: "ImportDeclaration[source.value=/\\/index$/]:not([source.value='@/index'])",
          message: "Omit trailing /index in imports (prefer '@/core' over '@/core/index').",
        },
        {
          selector: "ExportNamedDeclaration[source.value=/\\/index$/]:not([source.value='@/index'])",
          message: "Omit trailing /index in re-exports.",
        },
        {
          selector: "ExportAllDeclaration[source.value=/\\/index$/]:not([source.value='@/index'])",
          message: "Omit trailing /index in re-exports.",
        },
        {
          selector: "ImportDeclaration[source.value^='../src/']",
          message: "Use @/ to import from src.",
        },
        {
          selector: "ImportDeclaration[source.value^='./src/']",
          message: "Use @/ to import from src.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='../src/']",
          message: "Use @/ to re-export from src.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='../src/']",
          message: "Use @/ to re-export from src.",
        },
      ],
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
          selector: "ImportDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value^='@/core/'])",
          message: "Core modules must only import from src/core or from npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value^='@/core/'])",
          message: "Core modules must only re-export from src/core or from npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value^='@/core/'])",
          message: "Core modules must only re-export from src/core or from npm packages.",
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
          selector: "ImportDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/integrations']):not([source.value='@/skills']):not([source.value^='@/core/']):not([source.value^='@/integrations/']):not([source.value^='@/skills/'])",
          message: "Skills modules may only import from src/core, src/integrations, src/skills, or npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/integrations']):not([source.value='@/skills']):not([source.value^='@/core/']):not([source.value^='@/integrations/']):not([source.value^='@/skills/'])",
          message: "Skills modules may only re-export from src/core, src/integrations, src/skills, or npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/integrations']):not([source.value='@/skills']):not([source.value^='@/core/']):not([source.value^='@/integrations/']):not([source.value^='@/skills/'])",
          message: "Skills modules may only re-export from src/core, src/integrations, src/skills, or npm packages.",
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
          selector: "ImportDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/integrations']):not([source.value^='@/core/']):not([source.value^='@/integrations/'])",
          message: "Integrations modules may only import from src/core, src/integrations, or npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/integrations']):not([source.value^='@/core/']):not([source.value^='@/integrations/'])",
          message: "Integrations modules may only re-export from src/core, src/integrations, or npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/integrations']):not([source.value^='@/core/']):not([source.value^='@/integrations/'])",
          message: "Integrations modules may only re-export from src/core, src/integrations, or npm packages.",
        },
      ],
    },
  },
  {
    files: ["src/commands/**/*.ts"],
    ignores: ["src/commands/index.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value^='@/commands/']",
          message: "Commands modules must not import other command modules. Move shared logic to src/skills and route composition through src/handlers/commandRuntime.ts.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='@/commands/']",
          message: "Commands modules must not re-export other command modules.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='@/commands/']",
          message: "Commands modules must not re-export other command modules.",
        },
        {
          selector: "ImportDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/skills']):not([source.value^='@/core/']):not([source.value^='@/skills/'])",
          message: "Commands modules may only import from src/core, src/skills, or npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/skills']):not([source.value^='@/core/']):not([source.value^='@/skills/'])",
          message: "Commands modules may only re-export from src/core, src/skills, or npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/skills']):not([source.value^='@/core/']):not([source.value^='@/skills/'])",
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
          selector: "ImportDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/commands']):not([source.value='@/handlers']):not([source.value^='@/core/']):not([source.value^='@/commands/']):not([source.value^='@/handlers/'])",
          message: "Handlers modules may only import from src/core, src/commands, src/handlers, or npm packages.",
        },
        {
          selector: "ExportNamedDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/commands']):not([source.value='@/handlers']):not([source.value^='@/core/']):not([source.value^='@/commands/']):not([source.value^='@/handlers/'])",
          message: "Handlers modules may only re-export from src/core, src/commands, src/handlers, or npm packages.",
        },
        {
          selector: "ExportAllDeclaration[source.value^='@/']:not([source.value='@/core']):not([source.value='@/commands']):not([source.value='@/handlers']):not([source.value^='@/core/']):not([source.value^='@/commands/']):not([source.value^='@/handlers/'])",
          message: "Handlers modules may only re-export from src/core, src/commands, src/handlers, or npm packages.",
        },
      ],
    },
  },
  {
    files: ["src/**/index.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: ":matches(FunctionDeclaration, ClassDeclaration, VariableDeclaration, TSEnumDeclaration, TSInterfaceDeclaration, TSTypeAliasDeclaration)",
          message: "index.ts files must be barrel-only: import/re-export siblings and define no local declarations.",
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
          selector: "ImportDeclaration[source.value^='@/']:not([source.value^='@/handlers/']):not([source.value^='@/core/'])",
          message: "app.ts may only import from src/handlers or src/core.",
        },
      ],
    },
  },
);
