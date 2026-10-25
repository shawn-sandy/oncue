# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repo is

A Claude Code plugin marketplace (`oncue`) shipping one plugin, `oncue`, with five skills under `plugins/oncue/skills/` and a typed Node engine under `plugins/oncue/engine/`. The skills are prose the model reads at runtime; the engine does the rendering.

## Engine

- Sources are strict TypeScript in `engine/src/` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Keep all JavaScript type-safe: TypeScript sources, or `// @ts-check` with JSDoc for plain `.mjs` scripts.
- `dist/` is committed so the skills run after `npm install` with no build. Run `npm run build` in the engine after any change to `src/` and commit both.
- `short.json` is the contract between the skills and the engine. A new field needs: the type in `src/spec.ts`, validation in `loadSpec`, both renderers (`scenes.ts`, `deck.ts`), a cue slot in `cues.ts` if it animates, and a row in `skills/storyboard/references/spec.md`.
- `render.ts` compiles to a plain browser script (no imports or exports). Animation must stay a pure function of time: no timers, no CSS transitions, so frame capture stays deterministic.
- Playwright is an optional peer dependency: never add it to `dependencies`, because sandboxes often preinstall a version matched to their browser.

## Validate

```bash
npm run validate
npm run engine:typecheck
```

Before calling an engine change done, run the example end to end in the engine folder: `npm run example:deck` and `npm run example:stills`, and look at the output.

## Versioning

The version lives only in `plugins/oncue/.claude-plugin/plugin.json`; `marketplace.json` has none. The changelog is the last section of `README.md`. Bump for changes to what a skill or the engine does, not for wording fixes.
