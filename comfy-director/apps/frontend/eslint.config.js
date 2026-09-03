import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

// Config flat (richiesta da ESLint 9+ — mai esistita in questo progetto: `npm run
// lint` era rotto fin dallo scaffold di Fase 1 con "ESLint couldn't find an
// eslint.config.js file". Usa solo i pacchetti già dichiarati in package.json
// (@typescript-eslint/eslint-plugin+parser, eslint-plugin-react-hooks,
// eslint-plugin-react-refresh) — nessuna nuova dipendenza aggiunta solo per
// collegarli.
export default [
  { ignores: ["dist"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Un parametro/variabile non usato prefissato con `_` è deliberato (es. un
      // handler di callback che ignora un argomento) — non un refuso da segnalare.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // `no-undef` di base non conosce i tipi TypeScript (namespace `React.*` usati
      // solo come tipo, lib DOM come `RequestInit`): il type-check di `tsc --noEmit`
      // (già nella pipeline, `npm run build`) copre questi casi correttamente — la
      // raccomandazione ufficiale di typescript-eslint è disattivarlo sui file TS.
      "no-undef": "off",
    },
  },
];
