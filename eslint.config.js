const js = require("@eslint/js");
const importPlugin = require("eslint-plugin-import");

module.exports = [
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    languageOptions: {
      sourceType: "commonjs",
    },
  },
  {
    ignores: [],
  },
];
