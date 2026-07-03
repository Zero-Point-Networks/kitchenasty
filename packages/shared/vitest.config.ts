import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Never pick up compiled test files emitted into dist/ by a prior build.
    exclude: [...configDefaults.exclude, 'dist/**'],
  },
});
