import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so tests don't start the IWSDK dev runtime.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
