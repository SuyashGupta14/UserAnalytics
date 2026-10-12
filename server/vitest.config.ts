import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 300000,
    hookTimeout: 300000,
  },
});
