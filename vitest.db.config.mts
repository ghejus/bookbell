import { defineConfig } from "vitest/config";

// Only the tests that talk to the real Supabase database.
export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 20_000,
    // One file at a time: several files book times in the same test shops,
    // and their clean-up steps must not cancel each other's bookings.
    fileParallelism: false,
  },
});
