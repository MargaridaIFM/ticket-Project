import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        fetch: "readonly",
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-empty": "warn",
      "eqeqeq": "error",
      "no-var": "error",
      "prefer-const": "warn",
      "no-console": "warn",
    },
  },
  {
    // O server.js e o errorMiddleware usam console intencionalmente
    files: ["src/server.js", "src/middlewares/errorMiddleware.js"],
    rules: {
      "no-console": "off",
      "no-unused-vars": "off",
    }
  },
  {
    ignores: ["node_modules/", "data/"]
  }
];
