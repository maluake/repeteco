// Lint só de erros prováveis (variáveis não declaradas, código morto,
// comparações estranhas). Não impõe estilo: o código fica como está.
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/", "assets/vendor/", "test-results/"] },
  js.configs.recommended,
  {
    files: ["assets/**/*.js", "dashboard/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, supabase: "readonly", L: "readonly" }
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.js", "api/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },
    rules: { "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }] }
  }
];
