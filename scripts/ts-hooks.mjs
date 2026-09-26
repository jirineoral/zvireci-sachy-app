// Lets node (>= 22.18 / 24, native type stripping) import the app's TypeScript modules,
// which use extensionless relative imports ("./types") as the Vite/bundler resolution
// allows. Used by scripts/check-lessons.mjs and scripts/test-lesson-runner.mjs:
//   import './ts-hooks.mjs';  (before importing any src/*.ts)
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw err;
    }
  },
});
