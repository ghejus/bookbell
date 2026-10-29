import { defineConfig } from "vitest/config";

// Only the tests that talk to the real Supabase database.
export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
