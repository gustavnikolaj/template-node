import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.nodeBuiltin,
      },
    },
  },
  {
    ignores: [],
  },
];
