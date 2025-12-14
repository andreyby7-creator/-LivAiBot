import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Match tsconfig target to avoid unnecessary transformations
  platform: 'neutral', // Core contracts are platform-agnostic, work in any environment
  entry: {
    index: 'src/index.ts',
    // TODO: Add entry points as modules are implemented
    // 'effect/index': 'src/effect/index.ts',
    // 'auth/index': 'src/auth/index.ts',
    // 'ci/index': 'src/ci/index.ts',
    // 'config/index': 'src/config/index.ts',
    // 'context/index': 'src/context/index.ts',
    // 'domain/index': 'src/domain/index.ts',
    // 'errors/index': 'src/errors/index.ts',
    // 'fn/index': 'src/fn/index.ts',
    // 'infrastructure/index': 'src/infrastructure/index.ts',
    // 'react/index': 'src/react/index.ts',
    // 'targets/browser': 'src/targets/browser.ts',
    // 'targets/node': 'src/targets/node.ts',
    // 'targets/mobile': 'src/targets/mobile.ts',
    // 'targets/server': 'src/targets/server.ts',
    // 'targets/shared': 'src/targets/shared.ts',
  },
  format: ['esm'],
  outDir: 'dist/esm',
  dts: false, // tsc handles .d.ts via tsconfig.build.json
  splitting: false,
  sourcemap: true,
  clean: false, // Don't delete .d.ts from tsc
  treeshake: true,
  external: ['effect', 'ulidx'], // Foundation dependencies must remain external
});
