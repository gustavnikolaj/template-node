import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    ignores: [],
  },
];
