import { defineConfig } from 'vitest/config';

// Unit tests for the pure logic, where a bug is silent: mushaf arithmetic,
// the reciter list, the credits, and a scan that keeps private strings out of
// this public repo. Rendering is covered by `npm run build` and by using the app.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
