# Restore a Working ESLint Setup

## Status: Draft

## Objective

Make `npm run lint` actually run, by adding ESLint as a dependency and providing the flat config that ESLint v9+ requires.

## Problem Statement

Discovered while developing `table-natural-name-ordering` — the `/wf:develop` Refactor phase calls for running the linter, and it could not be run at all.

1. **No ESLint config exists anywhere in the repo** — `git ls-files | grep -iE 'eslint'` returns nothing, on this branch and on `main`. Running `npm run lint` fails with `ESLint couldn't find an eslint.config.(js|mjs|cjs) file.`
2. **ESLint is not a declared dependency** — neither `dependencies` nor `devDependencies` in the root `package.json` mentions `eslint` or any plugin. `npx eslint` resolves to whatever version npm fetches ad hoc (v10.6.0 at time of writing).
3. **The `lint` script uses removed flags** — `package.json` `scripts.lint` is `eslint packages/*/src --ext .ts,.tsx`. The `--ext` flag was removed in ESLint v9; file selection now comes from the config's `files` patterns.
4. **The project profile advertises lint commands that cannot work** — `.claude/memory/project-profile.md` lists `npm run lint` and `npm run lint -- --fix`, and its Code Quality Metrics section defines "Lint issues" as `npm run lint 2>&1 | grep -c 'error'`. Every workflow command that reaches the Refactor phase is told to run a linter that always fails.

The practical effect is that no lint rule has ever been enforced — the `no-explicit-any` and explicit-return-type conventions in the profile's Language Standards are honoured by convention and code review only.

## Current Architecture

The repo is an npm-workspaces monorepo (`packages/shared`, `server`, `admin`, `storefront`, `docs`, `mobile`). TypeScript is `^5.7.0` with `strict` on at the root `tsconfig.json`, and per-package type-checking works today (`tsc --noEmit -p packages/server`, `tsc -b` in the React packages). Type-checking is therefore the only automated static analysis currently running.

The packages have materially different lint needs: `server` is Node + Express ESM, `admin`/`storefront` are React + Vite with JSX, `mobile` is Expo/React Native and is excluded from the root pipeline, and `docs` is VitePress.

### Key Files

| File | Role |
|------|------|
| `package.json` | Declares the broken `lint` script; needs the ESLint devDependencies |
| `tsconfig.json` | Root strict TypeScript config the lint rules should align with |
| `.claude/memory/project-profile.md` | Advertises the lint commands and Code Quality Metrics that depend on them |
| `eslint.config.js` | **NEW** — flat config for the workspace |

## Design

### Flat Config at the Repo Root

Add `eslint.config.js` (ESM, matching the repo's `"type": "module"` packages) exporting an array of config objects:

- A base object applying `@eslint/js` recommended rules plus `typescript-eslint` recommended rules to `packages/*/src/**/*.{ts,tsx}`.
- An override for `packages/admin` and `packages/storefront` adding the React and React Hooks plugins with JSX parsing enabled.
- An override relaxing `@typescript-eslint/no-explicit-any` to a warning inside `**/__tests__/**` and `e2e/**`, since the established Prisma-mock convention in the server integration tests uses `as any` deliberately.
- A global `ignores` list covering `dist/`, `build/`, `node_modules/`, `packages/docs/.vitepress/cache/`, and generated Prisma output.

Rules should start from the recommended presets and encode the two conventions the profile already names as required: `@typescript-eslint/no-explicit-any` (error in `src/`) and `@typescript-eslint/explicit-module-boundary-types` (error on exported functions).

**Decide the initial severity budget during implementation.** Turning on recommended presets against an unlinted codebase will surface a backlog. If the violation count is large, land the config with the noisiest rules set to `warn`, record the counts, and raise them to `error` in a follow-up rather than blocking this spec on a repo-wide cleanup.

### Fix the Scripts

- `lint`: `eslint packages/*/src e2e` (drop `--ext`; the config's `files` patterns select extensions).
- Add `lint:fix`: `eslint packages/*/src e2e --fix`, so the profile no longer has to document the `-- --fix` workaround.

### Pin the Dependencies

Add to root `devDependencies`: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`. Pin ESLint to a major version so `npx` cannot silently drift.

## Implementation Order

### Phase 1: Working Lint Baseline
<!-- packages: root -->

- [ ] **T1.1** Add ESLint + typescript-eslint + React plugin devDependencies to the root `package.json` `[root]` `[~10 LOC]`
- [ ] **T1.2** Write `eslint.config.js` with the base, React, and test overrides plus the ignores list `[root]` `[~70 LOC]` - depends: T1.1
- [ ] **T1.3** Fix `scripts.lint` and add `scripts.lint:fix` `[root]` `[~2 LOC]` - depends: T1.2
- [ ] **T1.4** Run the linter, record the violation counts per package, and set the initial severity budget (`warn` vs `error`) so the command exits clean `[root]` `[~20 LOC]` - depends: T1.3
- [ ] **T1.5** Update `.claude/memory/project-profile.md` Build Commands and Code Quality Metrics to match the working commands `[root]` `[~5 LOC]` - depends: T1.3

## Testing Strategy

### Verification Commands

- `npm run lint` — must exit 0
- `npm run lint:fix` — must exit 0 and leave the tree clean
- `npx eslint packages/server/src/lib/table-name-sort.ts` — must report no errors on a known-good file
- `npm test` — must still pass, confirming no autofix changed behaviour

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Recommended presets surface hundreds of pre-existing violations | Land the config with noisy rules at `warn`, record counts in the phase summary, raise to `error` in a follow-up spec |
| Autofix silently changes runtime behaviour | Run the full test suite after any `--fix` pass; review the autofix diff rather than committing it blind |
| React plugin version drift against React 18 | Pin the plugin majors alongside ESLint |

## Out of Scope

- Adding lint to CI or a pre-commit hook — separate spec once the command exits clean.
- Linting `packages/mobile` (excluded from the root pipeline by design) and `packages/docs`.
- Fixing the violations the new config surfaces beyond what is needed for the command to exit clean.
- Prettier or any formatter.

## Files to Change

| File | Change |
|------|--------|
| `package.json` | Add ESLint devDependencies; fix `lint`; add `lint:fix` |
| `eslint.config.js` | **NEW** — flat config for the workspace |
| `.claude/memory/project-profile.md` | Correct the lint commands and Code Quality Metrics |

## Documentation Impact

- [ ] `CONTRIBUTING.md` — mention `npm run lint` / `npm run lint:fix` once they work.
