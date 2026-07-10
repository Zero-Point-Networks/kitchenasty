# Repair ESLint Configuration

## Status: Draft

## Objective

Make `npm run lint` (`eslint packages/*/src --ext .ts,.tsx`) actually run: the repo has no ESLint configuration file at all, so the root lint script fails immediately with "ESLint couldn't find a configuration file" under the installed ESLint v10.

## Problem Statement

1. **No config exists** — there is no `eslint.config.*` (flat config) and no legacy `.eslintrc*` anywhere in the repo, yet the root `package.json` defines `"lint": "eslint packages/*/src --ext .ts,.tsx"` and the project profile lists it as the lint command.
2. **Workflow impact** — every `/wf:develop` Refactor phase and the Code Quality audit dimension call this command; it currently exits with a configuration error, so no code in the monorepo is linted (discovered 2026-07-03 during the coolgardie-branding-menu-seed spec).
3. **ESLint v10 requires flat config** — a modern `eslint.config.js` with `typescript-eslint` is needed; the `--ext` flag is also a legacy-CLI option that flat config replaces.

## Design (rough)

- Add root `eslint.config.js` using `typescript-eslint` (flat config) covering `packages/*/src/**/*.{ts,tsx}`, with React plugin for `admin`/`storefront`, and sensible ignores (`dist`, `node_modules`, generated files).
- Align rules with the project profile's Language Standards (no `any`, no default exports for React components, explicit return types on exported functions).
- Update the root `lint` script for the flat-config CLI (drop `--ext`).
- Expect a first-run violation backlog; decide whether to fix or selectively disable rules per package in this spec's implementation.

## Implementation Order

### Phase 1: Config and script

- [ ] **T1.1** Add flat `eslint.config.js` + `typescript-eslint`/React plugin devDependencies `[root]` `[~60 LOC]`
- [ ] **T1.2** Update root `lint` script; verify `npm run lint` runs to completion `[root]` `[~2 LOC]`
- [ ] **T1.3** Triage first-run violations: auto-fix, then fix or rule-tune the remainder `[all]` `[size unknown until T1.2]`

## Testing Strategy

`npm run lint` exits 0 on a clean tree; CI (if/when added) runs it.

## Out of Scope

- Adding lint to CI pipelines (no CI config exists yet).
- Prettier/formatting integration.
