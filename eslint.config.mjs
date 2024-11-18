import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.extends(
    "plugin:@typescript-eslint/recommended",
    "plugin:promise/recommended"
  ),
  {
    languageOptions: {
      globals: {
        ...globals.jest,
      },

      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
    },

    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
];
