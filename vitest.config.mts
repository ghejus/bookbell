import { configDefaults, defineConfig } from "vitest/config";

// `npm test` runs the fast checks only. The database lock test talks to the
// real Supabase project, so it has its own command: `npm run test:db`.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/db/**"],
  },
});
