---
status: completed
type: feature
created: 2026-11-10
repo-name: oncue
effort: high
workflow: auto
source: docs/prompts/proposal-add-astro-default-theme.md
artifact-url: https://claude.ai/artifact/QBNWsY6MP4UqfsMkZouoZd
issue: https://github.com/shawn-sandy/oncue/issues/36
prototype: docs/prototypes/add-astro-default-theme.html
proto-model: {"entity":"Theme","fields":[{"name":"name","type":"string"},{"name":"mode","type":"string"},{"name":"stroke","type":"string"},{"name":"weight","type":"string"},{"name":"ground","type":"string"},{"name":"card","type":"string"},{"name":"rule","type":"string"},{"name":"ink","type":"string"},{"name":"accent","type":"string"}],"action":"Add theme","successSignal":"Themes"}
glance: Today every Short with no brand look gets a palette the model invents, and every Short has the same heavy 2px borders and bold headings. After this, a Short with no look starts from one named, calm Astro theme, and a new theme is a single JSON file. We will know it worked when the Gleaner example renders in the Astro look in light and dark, both new settings change the video and the deck, and the full engine suite passes with nothing skipped.
---

# Plan: Give OnCue a calm Astro default theme and two new look settings

## Objective

Ship `engine/themes/astro.json` as OnCue's default look, add the `stroke` (border thickness) and `weight` (heading boldness) theme settings that look needs, and have the storyboard skill copy the preset into any new Short that has no look.

## Context

OnCue has no named default look. When a person gives no look, `skills/storyboard/SKILL.md` step 1 tells the model to use the product's logo and site, and failing that to "pick a ground (dark unless their words say otherwise), one accent and one highlight". The de facto reference is the Gleaner sample. The full research is in `docs/prompts/proposal-add-astro-default-theme.md`; this plan carries out its locked decisions and does not reopen them.

Why two new settings and not just a preset file: Astro Kit's palette fits OnCue's 13 colour roles and passes every contrast pair, but its look lives in traits `scenes.ts` hard-codes (2px borders, 800-weight headings). A colours-only preset would repaint today's shapes. Hence `theme.stroke` (`bold` | `hairline`) and `theme.weight` (`heavy` | `semibold`).

How the engine is tested matters for every step. The test files import the compiled `dist/` folder, not `src/`, so every GREEN step runs `npm run build` before its test command. `CLAUDE.md` also requires `dist/` to be committed after any change to `src/`.

Known risks and their mitigations:

- A 1px line may soften once the video is compressed (H.264). Mitigation: Step 17 looks at an encoded frame; if the line is broken, `hairline` becomes 1.5px. Decide from that frame, not in advance.
- Mapping both `accent` and `highlight` to one teal removes the second colour that strings, step numbers and the progress bar use today. The look will read calmer. Step 16 checks the stills to confirm that is acceptable.
- Pills and circles (`.tag`, `.moment`, `.ts`, `.pill`, `.ico`, `.num`, `.play`) stay round. Astro Kit says "never pill-shaped"; a third token for that is a later, separate decision.
- `panelRule` (`#c9dfe6` light, `#1d4552` dark) is a derived tint, not an Astro Kit token. Every other role is an Astro Kit value unchanged.
- Adding `@fontsource/inter` adds install weight to every engine copy.
- This Mac's test environment has known quirks: a root-owned npm cache, a Playwright Chromium build that goes missing after `npm ci` (browser tests then skip and look green), and no `ffmpeg` on PATH. Steps 13 and 17 say how to detect and work around each.

## Decisions

- Approach is a preset file plus two look settings, chosen over "preset only", "engine-side preset merge" and "keep inventing palettes", because it is the only option that renders a look distinct from today's while keeping a new theme to one file.
- The storyboard skill copies the preset into `short.json`; `loadSpec` gains no merge code, so the engine still reads only `short.json` and customizing means editing the copied block.
- Light is the default mode (paper `#fcfcfd`, island `#0b6070`); the word "dark" selects the dark mode through the plain-words table.
- Fonts are Inter for sans (new `@fontsource/inter`) and JetBrains Mono for mono (already installed). Inter ships the 400, 600, 700 and 800 weights `writeScenes` copies.
- In the deck, `stroke: hairline` draws a 0.75pt `rule`-coloured line on exactly the five shapes the video borders: item cards, chat turns, tiles, the player and the image card. Panel, result bar and pill stay borderless. `bold` leaves default deck XML unchanged. `weight` does nothing in the deck, because PowerPoint bold is on or off; `spec.md` says so.
- Preset density is `regular`, the safe fit for every scene kind; `airy` stays available through the plain-words table.
- The plan is red-green-verify: failing tests come first, then the minimum code to pass them, then the full checks. It is one chain with no lanes, because every step depends on the one before it.
- The version bump and changelog sit inside the VERIFY phase, after the example render has been looked at, so the final `npm run validate` also checks them. There is no SHIP phase: nobody asked for a commit or a pull request here.
- Under `hairline` the panel divider `.hr` goes from 3px to 2px, not 1px, so it stays visible on the tinted panel; the borders go to 1px. Chosen in the plan interview.
- Under `semibold` only the 800 weights change; `.result` and tile labels keep their 700 and 600. Accepted as mixed weights, chosen in the plan interview.
- If `ffmpeg` cannot be set up for step 17, the plan may finish with the 1px compression risk reported as open, not blocked.
- No cue slot: neither new setting animates, so `cues.ts` is untouched.

## Files

- plugins/oncue/engine/test/theme.test.mjs (modified) — new keys in `VALUES` and `DEFAULTS`, plus the video and deck assertions for both settings
- plugins/oncue/engine/test/themes.test.mjs (new) — every preset, every mode: loads, zero contrast warnings, fonts resolve, look renders
- plugins/oncue/engine/src/spec.ts (modified) — `stroke` and `weight` in `SCALES`, `Look` and `look()`
- plugins/oncue/engine/src/scenes.ts (modified) — borders, rule height and heading weights read the new settings
- plugins/oncue/engine/src/deck.ts (modified) — `hairline` line on five card shapes
- plugins/oncue/engine/dist (generated) — rebuilt output, committed
- plugins/oncue/engine/themes/astro.json (new) — the preset, light and dark modes
- plugins/oncue/engine/package.json (modified) — `@fontsource/inter` dependency
- plugins/oncue/engine/package-lock.json (modified) — lockfile for Inter
- plugins/oncue/skills/storyboard/SKILL.md (modified) — step 1 copies the default theme
- plugins/oncue/skills/storyboard/references/theme.md (modified) — default theme, making a theme, plain words, DESIGN.md block
- plugins/oncue/skills/storyboard/references/spec.md (modified) — rows for `stroke` and `weight`
- plugins/oncue/.claude-plugin/plugin.json (modified) — version 1.8.0 to 1.9.0
- README.md (modified) — `### 1.9.0` changelog entry

## Steps

### Phase: RED

1. [x] Add `stroke: ["bold", "hairline"]` and `weight: ["heavy", "semibold"]` to `VALUES`, and `stroke: "bold", weight: "heavy"` to `DEFAULTS`, in `plugins/oncue/engine/test/theme.test.mjs`. Why: the file's existing "rejects an unknown value" loop and its byte-identical-defaults test then cover both new keys with no new test code. Verify: `cd plugins/oncue/engine && npm run build && node --test test/theme.test.mjs` fails on the new keys with `theme.stroke: is not a theme key`, not on a syntax or import error; keep the output.
2. [x] Add three tests to the same file: `hairline` sets `.card` `border` to `1px solid` and `.hr` height to `2px`; `semibold` sets `h2`, `.pt` and `.num` `font-weight` to `600`; and a deck test that a `hairline` spec gives the item, chat-turn, tile, player and image shapes a 0.75pt (`w="9525"`) line in the `rule` colour while panel, result and pill shapes and a `bold` spec have none. Why: the video and the deck are separate renderers, and `CLAUDE.md` requires every theme setting to work in both. Verify: the same command fails with the renderer assertions reporting `2px` instead of `1px`, `800` instead of `600`, and no `9525` line; keep the output.
3. [x] Create `plugins/oncue/engine/test/themes.test.mjs`: assert at least one `themes/*.json` exists; then for every preset and every key of its `modes`, write a spec from the Gleaner `lines` plus that preset's colours, `fonts`, `deckFonts` and `theme`, run `loadSpec`, assert `contrastWarnings` is empty, run `writeScenes` into a temp folder removed in an `after` hook, and assert the scenes page has `1px` borders and `600` headings when the preset says so. Why: this is the guard that makes "a new theme is one file" safe, and running `writeScenes` means a preset naming a font that is not installed fails here instead of at render time. Verify: `node --test test/themes.test.mjs` fails on the at-least-one-preset assertion, so an empty `themes/` folder cannot pass vacuously; keep the output.

### Phase: GREEN

4. [x] Add `stroke` and `weight` to `SCALES` in `plugins/oncue/engine/src/spec.ts` (`stroke`: `bold` 2px borders and 3px rule, `hairline` 1px borders and a 2px rule; `weight`: `heavy` 800, `semibold` 600), carry them through `Look` and `look()`, and update the `SCALES` doc comment, which currently calls every value a multiplier. Why: `checkTheme` builds its allowed keys and values from `SCALES`, so validation and the `Theme` type follow without new validation code. Verify: `npm run build && node --test test/theme.test.mjs` now passes the unknown-value loop and the byte-identical-defaults test, and `check` on `"stroke": "thin"` names `theme.stroke` and lists `bold, hairline`; the three renderer tests stay red.
5. [x] In `plugins/oncue/engine/src/scenes.ts`, make the border width on `.card`, `.bubble`, `.player`, `.tile` and `.photo` and the `.hr` height read `look().stroke`, and the 800 weights on `h1,h2`, `.pt` and `.num` read `look().weight`. Why: these are the hard-coded traits that make every Short look the same, and the defaults must still print today's exact CSS. Verify: `npm run build && node --test test/theme.test.mjs` turns the two video assertions green and the byte-identical test stays green.
6. [x] In `plugins/oncue/engine/src/deck.ts`, give the `card()` helper an optional line argument and pass the `rule` colour at 0.75pt from the item, chat-turn, tile, player and image call sites when `look().stroke` is `hairline`; leave panel, result and pill as they are, and do not read `weight`. Why: a hairline that shows in the video but not in the PowerPoint would break the both-renderers rule. Verify: `npm run build && node --test test/theme.test.mjs` passes in full, including the deck test and the default-deck-XML test.
7. [x] In `plugins/oncue/skills/storyboard/references/spec.md`, add `stroke` and `weight` rows to the theme table, add them to the unknown-key error example (currently `use radius, type, density, background, header`), and state that `weight` changes the video only. Why: `CLAUDE.md` requires a `spec.md` row for every new `short.json` field, and a reader must learn that the deck ignores `weight`. Verify: `grep -n "stroke\|weight" plugins/oncue/skills/storyboard/references/spec.md` shows both rows, the error text and the video-only note.
8. [x] Add `"@fontsource/inter": "^5.3.0"` to `dependencies` in `plugins/oncue/engine/package.json` and install it, using `npm_config_cache` in the scratchpad if the npm cache is root-owned. Why: the preset's sans font must be an `@fontsource` package that ships the weights `writeScenes` copies. Verify: `ls plugins/oncue/engine/node_modules/@fontsource/inter/files/inter-latin-{400,600,700,800}-normal.woff2` lists all four files, and `package-lock.json` names `@fontsource/inter`.
9. [x] Create `plugins/oncue/engine/themes/astro.json` from Appendix B of the proposal: `name`, `source`, `modes.light.colors`, `modes.dark.colors`, `fonts` (`inter`, `jetbrains-mono`), `deckFonts` (Arial, Arial) and `theme` (`radius: soft`, `background: flat`, `density: regular`, `type: regular`, `header: brand`, `stroke: hairline`, `weight: semibold`). Why: this is the default look, and one JSON file is the whole cost of a theme. Verify: `node --test test/themes.test.mjs` passes with two mode runs, zero contrast warnings, and the fonts resolved; confirm the test output lists both `light` and `dark`.
10. [x] In `plugins/oncue/skills/storyboard/SKILL.md` step 1, replace "pick a ground (dark unless their words say otherwise), one accent and one highlight" with an instruction to copy the Astro default theme from `oncue-engine/themes/astro.json` (the chosen mode's `colors`, plus `fonts`, `deckFonts` and `theme`, keeping the product's own `name` and `logo`), light unless the person's words say dark, and to say so out loud. Why: this is the only place that decides what a look-less Short gets. Verify: `grep -c "dark unless their words say otherwise" plugins/oncue/skills/storyboard/SKILL.md` prints `0` and `grep -n "themes/astro.json" plugins/oncue/skills/storyboard/SKILL.md` shows the new line.
11. [x] In `plugins/oncue/skills/storyboard/references/theme.md`, point "nothing accepted" at the default theme, add a short "Default theme" section (what it is, light versus dark, copied not referenced) and a short "Making a new theme" section (copy `astro.json`, change values, run `themes.test.mjs` or `check`, drop the file in `engine/themes/`), let the `editorial`, `quiet` and `technical` plain words also set `stroke: hairline` and `bold` also set `weight: heavy`, and add `stroke` and `weight` to the DESIGN.md `oncue:` block so a saved look round-trips. Why: the skill prose is what the model reads at run time, so the engine change does nothing until it says so. If any test from steps 1 to 3 still fails after 8 fix-and-rerun iterations across steps 4 to 9, stop and report the exact failing assertion, the last diff tried and what was ruled out; do not report success. Verify: `grep -n "Default theme\|Making a new theme\|stroke" plugins/oncue/skills/storyboard/references/theme.md` shows both sections, the plain-word rows and the `oncue:` block keys.

### Phase: VERIFY

12. [x] Run `npm run engine:typecheck` from the repo root. Why: the engine is strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), and a green test run over code that does not typecheck is not verified. Verify: the command exits 0 with no diagnostics printed.
13. [x] Run `npm run engine:test` from the repo root with the sandbox off, after `npx playwright install chromium` in `plugins/oncue/engine` if the browser tests skip. Why: the stills tests need a real Chromium build, and a run that reports skips looks green but proves nothing about them. Verify: the TAP summary shows `# fail 0` and `# skipped 0`; grep for both, and treat any skip as unverified.
14. [x] Build a scratch copy of `examples/gleaner/short.json` in the scratchpad with the Astro light preset applied (keeping Gleaner's `title`, `format`, `lines` and logo), then run the engine's `deck` and `stills` commands on it, and again with the dark preset. Why: the proposal requires the example to be rendered and looked at in both modes before the version bump, because colours that pass a ratio can still look wrong. Verify: both commands exit 0 for both modes and print no contrast or shrink-to-fit warning; the output folders hold the deck and a still for every scene.
15. [x] Open the light and dark `.pptx` as zip files and count `w="9525"` lines in the slide XML, and count them in the default Gleaner deck. Why: the 0.75pt deck line is the one part of this change a still image cannot show. Verify: the hairline decks contain `w="9525"` on item, turn, tile, player and image shapes and nowhere else, and the default Gleaner deck contains none.
16. [x] Read the light and dark stills as images and judge them against the risks: hairlines visible, headings at one weight, flat ground with no glow, teal accent legible, strings and step numbers still readable with accent equal to highlight. Why: the calmer look is intended, but only a rendered frame can confirm it is not washed out. Verify: report one sentence per mode on each of those five points; if any point fails, say which and fix `astro.json` before continuing.
17. [x] Render a few seconds of video with the `video` command on the light scratch spec, putting wrapped `ffmpeg` and `ffprobe` on PATH (see the `ffmpeg-via-remotion-wrapper` memory), and extract one frame. Why: this is the only check that shows whether H.264 compression softens the 1px hairline. Verify: the extracted frame shows a continuous hairline on a card; if it looks broken, change `hairline` to 1.5px in `src/spec.ts`, rebuild, rerun steps 13 and 14, and record it in Decisions; if `ffmpeg` cannot be set up, say so and leave the risk open.
18. [x] Bump `plugins/oncue/.claude-plugin/plugin.json` from `1.8.0` to `1.9.0` and add a `### 1.9.0 (<date>)` entry at the end of `README.md` covering the default theme, the two settings and "specs without `stroke` or `weight` render as in 1.8.0". Why: `CLAUDE.md` says a change to what a skill or the engine does earns a bump, and the release workflow builds the GitHub release from that entry. Verify: `grep '"version"' plugins/oncue/.claude-plugin/plugin.json` prints `1.9.0` and `grep -n "### 1.9.0" README.md` finds the entry.
19. [x] Run `npm run validate` from the repo root, then `npm run build` in the engine and `git status --short plugins/oncue/engine/dist`. Why: validation checks the skills, links and the shipped engine, and `dist/` must be committed in step with `src/`. Verify: validate exits 0, and the rebuild leaves `dist/` with no changes beyond what steps 4 to 6 produced.

## Tests

Tier 1 — This plan changes application code
- Objective: the Astro preset renders as a calm hairline look in both modes. File: plugins/oncue/engine/test/themes.test.mjs; Type: smoke; Asserts: for every `themes/*.json` and every mode, `loadSpec` accepts Gleaner's lines plus the preset, there are zero contrast warnings, `writeScenes` resolves the fonts, and the scenes page carries `1px` borders and `600` headings; Run: `cd plugins/oncue/engine && npm run build && node --test test/themes.test.mjs`
- Unit: the new settings validate and default correctly. File: plugins/oncue/engine/test/theme.test.mjs; Targets: `checkTheme`, `look`; Key cases: unknown `stroke` and `weight` values rejected with the allowed list, a spec listing every default renders byte-identical to one with no theme
- Integration: both renderers follow both settings. File: plugins/oncue/engine/test/theme.test.mjs; Targets: `writeScenes`, `deck`; Key cases: `hairline` gives `.card` a 1px border and `.hr` 2px, `semibold` gives `h2`, `.pt` and `.num` weight 600, the deck draws a 0.75pt line on exactly item, turn, tile, player and image shapes under `hairline` and none under `bold`

## Acceptance Criteria

- [x] `check` accepts `"theme": { "stroke": "hairline", "weight": "semibold" }` and rejects `"stroke": "thin"` with a message naming `theme.stroke` and the values `bold, hairline`.
- [x] A spec that lists every default theme value, including `stroke: bold` and `weight: heavy`, renders scenes HTML and deck XML byte-identical to a spec with no theme (the default test in `theme.test.mjs` passes).
- [x] Under `hairline`, the scenes page sets `1px` borders on `.card`, `.bubble`, `.player`, `.tile` and `.photo` and a `2px` `.hr`; under `semibold`, `h1`, `h2`, `.pt` and `.num` render at weight 600.
- [x] Under `hairline`, the deck XML carries a `w="9525"` line in the `rule` colour on item, chat-turn, tile, player and image shapes only; the default Gleaner deck carries none.
- [x] `plugins/oncue/engine/themes/astro.json` exists with `light` and `dark` modes, and `themes.test.mjs` passes for both with zero contrast warnings and every font resolved.
- [x] `npm run engine:typecheck` and `npm run validate` exit 0, and `npm run engine:test` reports `# fail 0` and `# skipped 0`.
- [x] `skills/storyboard/SKILL.md` no longer contains "dark unless their words say otherwise" and names `oncue-engine/themes/astro.json`.
- [x] `references/spec.md` has `stroke` and `weight` rows and says `weight` changes the video only.
- [x] The Gleaner example was rendered with the Astro light and dark presets and the stills were looked at, with one sentence per mode recorded.
- [x] `plugin.json` reads `1.9.0` and `README.md` has a `### 1.9.0` entry.

## Verification

From the repo root, run `npm run engine:typecheck`, `npm run engine:test` and `npm run validate`; all three exit 0, and the test summary shows `# fail 0` and `# skipped 0`. Then walk the objective as a person would. Copy `examples/gleaner/short.json` to a scratch folder, apply `themes/astro.json` light colours, `fonts`, `deckFonts` and `theme`, and run `node dist/cli.js stills` and `node dist/cli.js deck` on it: the stills show a flat light ground, a thin outline on cards and one teal accent, and the unzipped deck contains `w="9525"` lines. Repeat with the dark mode. Finally run the same two commands on the untouched Gleaner example and confirm its output is unchanged from before this work, which proves the new settings are opt-in.

## Next Steps

- Add a third look setting for corner shape so pills and circles can go square
  Astro Kit says "never pill-shaped", but `.tag`, `.moment`, `.ts` and `.pill` stay 999px and `.ico`, `.num` and `.play` stay circular. Deliberately out of scope here; wish list.
  ```text
  In the oncue repo, plugins/oncue/engine: add an optional theme key `shape` (`round` default | `square`) following the new-field rule in CLAUDE.md: type in src/spec.ts, validation via SCALES, both renderers (scenes.ts pills and circles, deck.ts), a spec.md row, then npm run build and commit dist/. Bump plugin.json by a minor version and add a README changelog entry. Verify: a spec with no `shape` renders byte-identical scenes HTML and deck XML, `npm run engine:test` shows `# fail 0` and `# skipped 0`, and `npm run validate` exits 0.
  ```

## Resources

- docs/prompts/proposal-add-astro-default-theme.md — the converged proposal with the locked decisions, the colour mapping and measured contrast (Appendix A) and the draft preset (Appendix B)
- plugins/oncue/skills/storyboard/references/theme.md — the plain-words table and DESIGN.md block that step 11 edits
- Astro Kit Design System, https://claude.ai/artifact/HKxyaqURmUX9WE4G8TiiW4 — source of the seven direction colours, Inter 600 headings and 1px hairline rule
