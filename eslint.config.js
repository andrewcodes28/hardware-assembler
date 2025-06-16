import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig([
  eslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  globalIgnores(["dist/"]),
]);
