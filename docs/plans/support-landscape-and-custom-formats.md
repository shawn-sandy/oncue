---
status: completed
type: feature
created: 2026-10-25
modified: 2026-10-26
repo-name: oncue
effort: high
workflow: never
artifact-url: https://claude.ai/artifact/YFeEebGQJs98MXLpKzwCsQ
issue: https://github.com/shawn-sandy/oncue/issues/4
prototype: docs/prototypes/validate-output-sizes.html
design: https://claude.ai/artifact/CVT6S6iArxPu2TKvnsGjrv
design-dir: docs/designs/support-landscape-and-custom-formats/project
proto-model: {"entity":"Output size","fields":[{"name":"label","type":"string"},{"name":"width","type":"number"},{"name":"height","type":"number"},{"name":"layout","type":"string"},{"name":"deck","type":"string"}],"action":"Add size","successSignal":"Sizes"}
glance: Today a short.json with any size other than 9:16 passes validation and then renders with most of each scene cut off, so OnCue can only make Shorts, Reels and TikToks. After this the same spec renders a YouTube-ready 16:9 video and deck, other sizes shrink a scene to fit instead of cutting it, and the 9:16 output stays byte-for-byte identical. New node:test suites and a before-and-after comparison of the example's stills and slides prove it.
---

# Plan: Render OnCue explainers at 16:9 or any custom size from the same short.json

## Objective

Make the engine honour `short.json`'s `format`. Tall sizes get the existing portrait layout, wide sizes get a new landscape layout, a fit guard shrinks any scene that would overflow its frame, and validation rejects sizes the encoder or the layouts cannot handle.

## Context

`format: { width, height }` already exists in `plugins/oncue/engine/src/spec.ts`, and `loadSpec` only checks that both values are above 0. Both renderers ignore the shape of the frame:

**Video** (`src/scenes.ts`): the layout is a fixed 1080×1920 `#stage`, scaled by `width / 1080` only. At 1920×1080 it scales up 1.78× and the frame shows the top third of the layout. At 1080×1350 the bottom of each scene is cut off.

**Deck** (`src/deck.ts`): the slide is always 5.625 in wide, and its height follows the aspect, but every position is a fixed inch value drawn for a 10 in slide. At 16:9 the slide is 3.16 in tall, body content starts at 3.8 in, and the computed card heights go negative.

**Encoding**: libx264 with `yuv420p` rejects odd widths and heights. A 1081 px custom size passes `loadSpec` and then fails inside ffmpeg.

**Skills**: vertical-deck, animate-short, storyboard, explainer-video, `references/spec.md`, the README and both manifests describe the output as 9:16 or 1080×1920 only. vertical-deck sends 16:9 requests to other tools.

Three approaches were weighed. Letterboxing the 9:16 design inside any frame is small but produces a phone-shaped strip in a 16:9 video. A shared geometry module for both renderers handles any aspect, but it rewrites all the layout code and drops CSS flexbox. This plan takes the middle option: two layouts (portrait and landscape), chosen from the frame's orientation, plus a fit guard for sizes neither layout was drawn for.

Risks and mitigations:

**Portrait regression.** Step 1 captures the current 9:16 stills and slide XML (the slides' internal markup) before any edit. Each video and deck step compares against that baseline.

**Fonts and measurement.** If the guard measures before the web fonts load, it measures the fallback font's size. It waits on every declared font face's load promise first, which uses no timer.

**Entrance transforms.** `renderAt(0)` applies starting offsets (70 px drops, 0.55 scale), which would inflate the measured content. The guard runs before the first `renderAt`.

**Uneven overflow.** Left-aligned text can overflow to the right only. Scaling around the box's centre would then push the left edge out, so the guard scales around the content's own centre and moves that centre onto the box's.

**The deck can't be measured.** pptx text size is only known inside PowerPoint. The deck therefore snaps to its two drawn sizes, and its tests check shape geometry only.

**CI has no Chromium.** The `engine:typecheck` job installs Playwright but no browser, so the browser tests skip in CI. They must run locally with 0 skipped.

**A possible existing 9:16 defect.** If the 9:16 deck or stills already overflow somewhere, the new tests or guard expose it. Fixing it would break the identical-output rule, so report it and ask. Do not silently change portrait output.


## Decisions

- **Layout choice.** A frame wider than it is tall uses the landscape layout; anything else, including 1:1 and 4:5, uses portrait. The user chose portrait plus the fit guard for square-ish sizes, and a dedicated square layout is a follow-up.
- **Design canvas.** Its short side is always 1080 design px, and the long side follows the aspect. That keeps 1080×1920 exactly today's stage, so portrait can't drift, and 16:9 gets a 1920×1080 canvas.
- **The 16:9 arrangement is chosen per scene kind, by design.** The plan does not fix one rule; the user asked for this to depend on the design and stay flexible. Content scenes can use `side` (kicker and title in a column beside the body) or `top` (header above a body laid out across the width). `hook` and `cta` can use `stack` (logo above the headline) or `side` (logo beside the headline). Each arrangement is one modifier class in `scenes.ts`, and `deck.ts` mirrors the same choice, so changing a kind's arrangement is a one-word edit. Step 8 picks each kind's arrangement from the 1920×1080 stills and records it in this list.
- **16:9 arrangements, picked in step 8 from the 1920×1080 stills.** `hook`: `stack`; `cta`: `stack`; `list`: `side`; `card`: `side`; `chat`: `side`; `steps`: `side`; `grid`: `top`; `media`: `top`. Hook and cta open and close as centred title cards. `top` pushed the card scene's kicker into the brand row and stretched chat bubbles across empty width, and a long list stacks and shrinks under `side` instead of squeezing into a row, so those four use `side`. Grid reads better as three columns of tiles and media as the player beside its moments, so those two use `top`. The table is `WIDE` in `src/spec.ts`, read by `scenes.ts` (an `is-<arrangement>` class on each scene) and `deck.ts`. In the deck, `top` puts grid tiles in three columns and the player beside the moments, and stacks the other content kinds' bodies below the header.
- **Per-scene overrides in `short.json` are deferred.** They would mean a new spec field, its validation, both renderers and a `spec.md` row, so they are in Next Steps.
- **No schema change.** `format { width, height }` already covers custom sizes. No preset strings such as `"16:9"`.
- **Validation.** Width and height must be integers, even (libx264 with `yuv420p` needs that), and between 320 and 4096 px each. The long side may be at most 2.4× the short side, which covers 21:9 at 2.33. Each error names the field (`format.width`, `format.height` or `format`), matching `loadSpec`'s existing contract.
- **Safe zones per layout.** Portrait keeps the Shorts and Reels bottom inset: 360 and 340 px in the video, 1.4 in in the deck. Landscape uses a small bottom inset, because landscape YouTube overlays only captions and the progress bar.
- **When the guard runs.** Once at page load, after the fonts load and before the first `renderAt`. Its result depends only on the layout, so every frame stays a pure function of time, as `CLAUDE.md` requires for `render.ts`.
- **What the guard measures.** A DOM Range over the box's contents, so text that spills out of its block counts, plus every element's own box. A Range counts only its top-level elements' boxes, so on its own it let the fixed-inset `.content` box hide cards that overflowed it (seen in step 5's first run); the objective test measures the same way, independently of the guard. The target is the box clipped to the viewport, so content outside the frame counts as overflow even when it is inside its box.
- **Where guard results go.** `build/fit.json` (`[{ scene, scale, fits }]`), next to `timeline.json`, plus one `warning:` line per shrunk scene naming the scene and its scale. Tests read the JSON; people read the warnings.
- **No shrink floor.** Content always fits, and every shrink is warned, so authors can cut copy when text gets small; the user chose this over clipping below a minimum scale.
- **Old specs fail clearly.** A spec that passes today but breaks the new limits fails `loadSpec` with an error naming the field and the rule. Nothing is silently rounded; the user chose this.
- **9:16 drift stops the build.** If the guard shrinks any scene of today's 9:16 example, or any baseline comparison differs, stop and ask the user before continuing.
- **Browser tests run locally only.** CI runs the format and deck suites; the landscape and fit suites skip there without Chromium and must pass locally with 0 skipped. The user chose this to keep CI minutes flat.
- **Deck sizes.** The deck is 5.625×10 in when portrait and 10×5.625 in when landscape, and it prints one notice when the spec's aspect differs from the deck's. Custom aspects apply to the video only; the user chose this.
- **Tests.** node:test on `.mjs` files with `// @ts-check`, importing the compiled `dist/` code. This adds no dependency, which matters because the skills' `npm install` in the engine installs dev dependencies too. The plan is red-green-verify: failing tests first. The user chose both.
- **Reading pptx files in tests.** Through `jszip`, which pptxgenjs already depends on, so no new package.
- **The vertical-deck name stays.** Existing references keep working; its description now covers 16:9.
- **Every skill description names widescreen.** All six descriptions say widescreen, landscape, 16:9 and YouTube video alongside the vertical terms. The model picks a skill from its description alone, and today they all say vertical, so "design a wide screen video" goes to the design canvas or Remotion instead of OnCue. Added after the user asked what that request would do.
- **Version 1.2.0.** The engine's behaviour changes, and `CLAUDE.md` bumps the version for that.
- **No SHIP phase.** The request was for a plan, so committing and opening a PR wait for the user.

## Files

- plugins/oncue/engine/src/spec.ts (modified) — `checkFormat` called from `loadSpec`, `stageFor`, `format` doc comment
- plugins/oncue/engine/src/scenes.ts (modified) — stage sized from `stageFor`, `wide` class, `.head`/`.body` wrappers, landscape CSS with per-kind arrangement classes
- plugins/oncue/engine/src/render.ts (modified) — fit guard at boot, `window.FIT`
- plugins/oncue/engine/src/capture.ts (modified) — return the guard's results from `renderStills` and `renderVideo`
- plugins/oncue/engine/src/cli.ts (modified) — `build/fit.json`, fit warnings, deck snap notice, `check` layout line, portrait-only Shorts warning, help text
- plugins/oncue/engine/src/deck.ts (modified) — slide size by orientation, box-based scene layouts, landscape positions following each kind's arrangement
- plugins/oncue/engine/dist/ (generated) — `npm run build` output, committed per `CLAUDE.md`
- plugins/oncue/engine/test/format.test.mjs (new) — validation unit tests
- plugins/oncue/engine/test/deck.test.mjs (new) — deck slide size and shape bounds
- plugins/oncue/engine/test/landscape.test.mjs (new) — objective test: 16:9 scenes inside the frame
- plugins/oncue/engine/test/fit.test.mjs (new) — guard reports and applies shrinks
- plugins/oncue/engine/package.json (modified) — `test` script, description
- package.json (modified) — `engine:test` script
- .github/workflows/validate.yml (modified) — run `npm run engine:test`
- plugins/oncue/skills/storyboard/references/spec.md (modified) — `format` row: common sizes, layout rule, limits, `fit.json`
- plugins/oncue/skills/storyboard/SKILL.md (modified) — pick the format from where it will be posted; canvas frame follows the aspect
- plugins/oncue/skills/vertical-deck/SKILL.md (modified) — 16:9 supported, snap note, safe zone portrait only
- plugins/oncue/skills/animate-short/SKILL.md (modified) — spec's size instead of 1080×1920, fit warnings
- plugins/oncue/skills/explainer-video/SKILL.md (modified) — stage table and description
- plugins/oncue/skills/voiceover/SKILL.md (modified) — description names widescreen, landscape, 16:9 and YouTube video
- plugins/oncue/skills/setup/SKILL.md (modified) — description names widescreen, landscape, 16:9 and YouTube video
- README.md (modified) — intro, outputs, build tree, skills table, 1.2.0 changelog
- plugins/oncue/.claude-plugin/plugin.json (modified) — version 1.2.0, description
- .claude-plugin/marketplace.json (modified) — plugin description

## Steps

### Phase: RED

1. [x] In `plugins/oncue/engine` run `npm ci`, `npm i --no-save --save-dev playwright` and `npx playwright install chromium`, then `npm run example:stills` and `npm run example:deck` on the untouched `dist/`, and copy `examples/gleaner/build/stills/*.png` plus the deck's slides (`unzip -o examples/gleaner/build/deck.pptx 'ppt/slides/slide*.xml' -d <scratch>/baseline`) into a scratch folder outside the repo. Why: the 9:16 output must not change, and the only proof is a comparison against output captured before any source edit. Verify: the scratch folder holds 9 PNG stills and 9 `slide*.xml` files.
2. [x] Write `plugins/oncue/engine/test/format.test.mjs` (node:test, `// @ts-check`, temp folders removed in `after`). It writes temp copies of the Gleaner spec and expects `loadSpec` to throw an error naming `format` for 1081×1920, 1080.5×1920, `"1080"`×1920, 0×1920, 240×426, 5000×2812 and 1080×3000, and to accept 1080×1920, 1920×1080, 1080×1080 and 3840×2160. Why: `loadSpec` is the trust boundary for hand-written and model-written specs, and the cheapest behaviour to pin first. Verify: `node --test test/format.test.mjs` exits non-zero because `loadSpec` accepts 1081×1920 and the other bad sizes; paste the failing test names.
3. [x] Add `"test": "node --test \"test/*.test.mjs\""` to `plugins/oncue/engine/package.json`, `"engine:test": "cd plugins/oncue/engine && npm test"` to the root `package.json`, and a `- run: npm run engine:test` step after the typecheck step in `.github/workflows/validate.yml`. Why: tests that no script or CI job runs stop being run. Verify: `npm run engine:test` from the repo root runs `format.test.mjs` and fails with the same assertions as step 2.
4. [x] Write `test/deck.test.mjs`. It calls `writeDeck` for the Gleaner spec at 1080×1920, 1920×1080 and 1080×1350 into a temp folder and reads each pptx with `jszip`. It asserts that `p:sldSz` is 5143500×9144000 EMU (5.625×10 in) for 1080×1920 and 1080×1350 and 9144000×5143500 EMU for 1920×1080, and that every `a:off` plus `a:ext` lies inside its slide. Why: shape geometry is the one deck property a test can check without PowerPoint. Verify: the test fails because the 1920×1080 deck is 5.625×3.16 in with shapes below its bottom edge, and the 1080×1350 deck is 7.03 in tall. The 1080×1920 case must pass; if it fails, stop and report it as an existing 9:16 defect.
5. [x] Write `test/landscape.test.mjs`, the objective test. It writes a temp copy of the Gleaner spec at 1920×1080 and builds `scenes.html` with `writeScenes` and an estimated timeline from `dist/`. It opens the page in Playwright Chromium at a 1920×1080 viewport and, for each scene, calls `renderAt` 85% of the way through it and asserts that a Range over the scene's contents lies inside the viewport. It skips with a printed reason when Chromium cannot launch. Why: it proves the objective with a measurement that does not rely on the guard grading itself. Verify: the test fails, with content on most scenes extending past the 1080 px bottom edge; paste the first failing scene.
6. [x] Write `test/fit.test.mjs`. It runs `node dist/cli.js stills` on temp specs and reads `build/fit.json`: (a) the Gleaner spec at 1920×1080 has `scale` 1 for every scene; (b) a 1920×1080 spec with a 2-item list scene and a 6-item list scene gives the 6-item scene a `scale` below 1 with `fits` true, and the 2-item scene `scale` 1; (c) the Gleaner spec at 1080×1080 has `fits` true for every scene. Why: the guard must both report and apply its shrink, and leave scenes that already fit untouched. Verify: the test fails because `build/fit.json` is not written; paste the output.

### Phase: GREEN

7. [x] In `src/spec.ts`, add an exported `checkFormat(format)` and call it from `loadSpec`, enforcing the validation rule in Decisions. Add an exported `stageFor(format)` that returns `{ wide, width, height, scale }` with the short side at 1080 design px, and update the `format` doc comment. Why: one place decides which sizes are valid and what the design canvas is, so `scenes.ts`, `deck.ts` and `cli.ts` can't disagree. Verify: `npm run build && node --test test/format.test.mjs` passes.
8. [x] In `src/scenes.ts`, size `#stage` from `stageFor`, replacing the fixed 1080×1920 and `k`, and add the `wide` class when the frame is landscape. Wrap each scene's kicker and title in `.head` and its body in `.body`: flex columns with the same 34 px gap, so portrait spacing stays the same. Add a `#stage.wide` CSS block with landscape insets (a small bottom inset, no Shorts safe zone) and the arrangement classes from Decisions: `side` and `top` for content scenes, `stack` and `side` for `hook` and `cta`. Then render the Gleaner example at 1920×1080, pick each scene kind's arrangement and tune its sizes (column split, grid columns, player height, logo size) by what reads best, and record each choice in the plan's Decisions. Why: a landscape frame is only 1080 design px tall, so the stacked portrait layout can't fit, and the user wants each kind's arrangement to follow the design rather than one fixed rule. Verify: `node --test test/landscape.test.mjs` passes, Decisions lists an arrangement for all eight scene kinds, and every PNG from `npm run example:stills` is identical to the step 1 baseline (`cmp`).
9. [x] In `src/render.ts`, add the fit guard at boot. First wait for every face in `document.fonts` to load. Then, for each scene, measure a Range over its `.content` or `.center` box against the box's rect clipped to the viewport. When the content overflows, scale it by the smaller of the two ratios around its own centre, move that centre onto the box's centre, and re-measure. Publish the results as `window.FIT = [{ scene, scale, fits }]`, and only then run `setup`, the first `renderAt` and `ready = true`. Why: custom sizes reach layouts that were never drawn for them, and shrinking a scene beats cutting it off; running once before the first frame keeps capture deterministic. Verify: `npm run build` passes, and `npm run example:stills` still matches the baseline byte for byte. If it doesn't, read the step 10 `fit.json`: a shrink there is an existing 9:16 overflow, so report it.
10. [x] In `src/capture.ts`, read `window.FIT` once the page is ready and return it from `renderStills` and `renderVideo`. In `src/cli.ts`, write it to `build/fit.json` and print one `warning:` line, naming the scene number, its kind and its scale, for each scene with `scale` below 1 or `fits` false. Why: people need to see when a scene was shrunk, and tests need a record they can read without parsing log wording. Verify: `node --test test/fit.test.mjs` passes.
11. [x] In `src/deck.ts`, size the slide by orientation only: 5.625×10 in for portrait, 10×5.625 in for landscape. Pass each scene layout a content box `{ x, y, w, h }` in place of the `M`, `CW`, `top` and `bottom` constants; the portrait box reproduces today's numbers exactly. For landscape, place the kicker, title, body, logo and headline using the arrangement step 8 recorded for each scene kind, so the deck matches the video. In `src/cli.ts`, have `deck` print one notice when the deck's aspect differs from the spec's. Why: every position today assumes a 10 in tall slide; a content box makes the layouts independent of orientation, and snapping keeps them at the sizes they were drawn for. Verify: `node --test test/deck.test.mjs` passes, and the 9:16 slide XML from `npm run example:deck` matches the baseline (`diff -r` prints nothing).
12. [x] Update the skill prose for both layouts. In `skills/storyboard/references/spec.md`, the `format` row lists the common sizes (1080×1920, 1920×1080, 1080×1080), the layout rule, the limits and `fit.json`. In `skills/storyboard/SKILL.md`, the format comes from where the video will be posted, the canvas frame sketch follows the aspect, and the safe-zone line is portrait only. In `skills/vertical-deck/SKILL.md`, 16:9 is supported, the redirect is gone, there is a note on snapping, and the safe zone is portrait only. In `skills/animate-short/SKILL.md`, the description, stills check and ffprobe check use the spec's size instead of 1080×1920, and fit warnings are explained. In `skills/explainer-video/SKILL.md`, update the stage table and description. Then rewrite the `description:` of all six skills (explainer-video, storyboard, vertical-deck, animate-short, voiceover and setup) so each names widescreen, landscape, 16:9 and YouTube video next to the vertical terms; the storyboard description opens "Plan a vertical or widescreen explainer". Why: the skills are what the model reads at runtime, and it picks a skill from these descriptions alone, so a request like "design a wide screen video" only reaches OnCue if they name it. Verify: `grep -rn '1080×1920\|9:16' plugins/oncue/skills` shows only lines that present 9:16 as one option; `for f in plugins/oncue/skills/*/SKILL.md; do for w in widescreen landscape 16:9 'YouTube video'; do grep -qi "^description:.*$w" "$f" || echo "$f: no $w"; done; done` prints nothing; and `npm run validate` passes.
13. [x] Bump `plugins/oncue/.claude-plugin/plugin.json` to 1.2.0. Update its description, the `marketplace.json` plugin description and the engine `package.json` description to name 16:9 and custom sizes. In the README, update the intro, outputs table, build tree and skills table, and add a 1.2.0 changelog entry. Why: `CLAUDE.md` keeps the version only in `plugin.json` and the changelog as the README's last section, and the engine's behaviour changed. Verify: `npm run validate` passes, and `grep -n '1.2.0' plugins/oncue/.claude-plugin/plugin.json README.md` finds both files.
14. [x] In `src/cli.ts`, make `check` print the layout it will use (for example `format 1920×1080: landscape layout`), limit the 3-minute Shorts warning to portrait, and reword the header comment and `readHelp` where they say 9:16 only. Then run `npm run build` and the full `npm test`. If tests still fail after 8 GREEN iterations, stop and report the failing assertion, the last diff tried and what was ruled out, and do not report success. Why: `check` is the first command people run, so it should state the layout before anything renders, and the cap keeps the fix loop bounded. Verify: `node dist/cli.js check` on a 1920×1080 copy prints the landscape line and no Shorts warning, and `npm test` exits 0 with 0 skipped.

### Phase: VERIFY

15. [x] From the repo root run `npm run validate`, `npm run engine:typecheck` and `npm run engine:test`. Why: these are the two CI checks plus the new suite, run locally before anyone reviews. Verify: all three exit 0, and the test summary reports 0 failed and 0 skipped; paste the summary.
16. [x] Rerun `npm run example:stills` and `npm run example:deck`, then `cmp` each PNG and `diff -r` the slide XML against the step 1 baseline. Why: it proves portrait didn't drift across all edits together, not just after each one. Verify: `cmp` and `diff` print nothing.
17. [x] Render the Gleaner example at 1920×1080 and 1080×1080 from scratch copies. Combine each size's stills into a contact sheet with ffmpeg's `tile` filter, convert the 16:9 deck to images with LibreOffice when it is installed, and render a silent 16:9 preview (`node dist/cli.js video`, in the background), then check it with `ffprobe`. Look at every frame and slide. Why: `CLAUDE.md` requires running the example end to end and looking at the output, and tests prove geometry, not looks. Verify: `ffprobe` reports 1920×1080, 30/1 fps and an audio stream, and every visual problem is listed with its scene.

## Tests

Tier 1 — This plan changes application code
- Objective: a 1920×1080 short.json renders with every scene inside the frame. File: plugins/oncue/engine/test/landscape.test.mjs; Type: smoke; Asserts: the Gleaner example at 1920×1080, built by `writeScenes` and stepped in headless Chromium, keeps each scene's contents inside the 1920×1080 viewport at its held moment; Run: cd plugins/oncue/engine && node --test test/landscape.test.mjs
- Unit: format validation. File: plugins/oncue/engine/test/format.test.mjs; Targets: loadSpec, checkFormat; Key cases: rejects 1081×1920 (odd), 1080.5 (non-integer), "1080" (string), 0, 240×426 (under 320), 5000×2812 (over 4096), 1080×3000 (beyond 2.4:1); accepts 1080×1920, 1920×1080, 1080×1080, 3840×2160
- Integration: deck geometry. File: plugins/oncue/engine/test/deck.test.mjs; Targets: writeDeck and the written pptx XML; Key cases: 9:16 deck is 5.625×10 in, 16:9 deck is 10×5.625 in, 1080×1350 snaps to 5.625×10 in, every shape inside its slide
- Integration: fit guard. File: plugins/oncue/engine/test/fit.test.mjs; Targets: render.ts guard, capture.ts, cli.ts fit.json; Key cases: Gleaner at 16:9 all scale 1; a 6-item list shrinks with fits true while a 2-item list stays at 1; Gleaner at 1080×1080 every scene fits

## Acceptance Criteria

- [x] A short.json with `format` 1920×1080 renders stills and an MP4 at 1920×1080, with every scene's content inside the frame and no scene shrunk.
- [x] The Gleaner example at 1080×1920 produces stills byte-identical to, and slide XML identical to, the pre-change baseline.
- [x] `node dist/cli.js deck` writes a 10×5.625 in deck with every shape on the slide for a 1920×1080 spec, and a 5.625×10 in deck plus a one-line notice for a 1080×1350 spec.
- [x] Any accepted size, 1080×1080 for example, renders with `fits` true for every scene in `build/fit.json`, and every shrunk scene is named in a warning.
- [x] Decisions records a 16:9 arrangement for each of the eight scene kinds, and the 16:9 deck and video use the same arrangement per scene.
- [x] `loadSpec` rejects odd, non-integer, non-number, under-320, over-4096 and beyond-2.4:1 sizes, with an error naming the `format` field.
- [x] `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0, and the local test run reports 0 skipped.
- [x] No skill, README line or CLI help text still says the engine is portrait only, and `plugin.json` is at 1.2.0 with a matching changelog entry.
- [x] Every `description:` under `plugins/oncue/skills/*/SKILL.md` names widescreen, landscape, 16:9 and YouTube video.

## Completion Report

- Step 17 — LibreOffice is not installed on this machine, so the 16:9 deck was not converted to slide images. Its geometry and text were drawn from the slide XML instead: the same arrangement per scene as the video, every shape on the slide.
- Step 17 visual review — 1920×1080: no problems across the nine scenes, all at scale 1. 1080×1080: every scene fits but shrinks under the portrait layout's Shorts inset (hook 0.569, list 0.522, card 0.47, chat 0.521 and 0.562, steps 0.501, media 0.386, grid 0.457, cta 0.591), the accepted trade-off that the square layout in Next Steps addresses.

## Verification

Copy the Gleaner example to a scratch folder, set `format` to 1920×1080, and run the CLI from the engine folder:

`node dist/cli.js check <copy>/short.json` prints the landscape layout line and no Shorts warning.

`node dist/cli.js stills <copy>/short.json` writes nine 1920×1080 PNGs and a `build/fit.json` with `scale` 1 for every scene. The contact sheet shows each scene in the arrangement recorded for its kind in Decisions, with nothing cut off.

`node dist/cli.js video <copy>/short.json` writes an MP4 that `ffprobe` reports as 1920×1080 at 30/1 fps with an audio stream.

`node dist/cli.js deck <copy>/short.json` writes a 10×5.625 in deck. `test/deck.test.mjs` confirms every shape is on the slide, and the LibreOffice images show the same arrangement per scene as the video.

Repeat the stills at 1080×1080: every `fits` entry is true. Then rerun the untouched example at 1080×1920: `cmp` and `diff -r` against the step 1 baseline print nothing. Finally, `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` all exit 0 from the repo root.

## Previews

- Portrait layout and the 16:9 candidate arrangements, and the fit guard (steps 8, 9)
  Candidates, not a fixed rule: step 8 picks `side` or `top` for each content scene kind and `stack` or `side` for `hook` and `cta` from real 1920×1080 stills. Scene colours copied from `plugins/oncue/engine/examples/gleaner/short.json` (`ground`, `card`, `chip`, `rule`, `ink`, `muted`, `accent`, `highlight`); portrait sizes from the `#stage` CSS in `src/scenes.ts`, landscape sizes are starting values. Frames are drawn at design size and scaled to 15%; system fonts stand in for Plus Jakarta Sans and JetBrains Mono. Contrast measured with the WCAG (web accessibility guidelines) relative-luminance script on 11 pairs. Lowest text pair: 7.27:1 (`muted` on `card`). The safe-zone line is 6.41:1 (`highlight` on `ground`). The card outline (`rule` on `ground`) measures 1.74:1, which is decorative and comes from the brand palette, outside this plan. Page labels measure 7.36:1 in the light theme and 7.80:1 in the dark theme.
  ```html
  <!doctype html>
  <html lang="en">
  <head>
  <meta charset="utf-8">
  <title>Portrait and landscape scenes</title>
  <style>
  :root{--bg:#ffffff;--fg:#1b1b1f;--muted:#55555f}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141417;--fg:#ececf0;--muted:#a8a8b3}}
  :root[data-theme="dark"]{--bg:#141417;--fg:#ececf0;--muted:#a8a8b3}
  body{margin:0;padding:12px;background:var(--bg);color:var(--fg);font:13px/1.4 system-ui,sans-serif}
  .row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
  figure{margin:0}figcaption{color:var(--muted);margin-top:4px;max-width:288px}
  .f{position:relative;overflow:hidden;width:288px;height:162px}.f.p{width:162px;height:288px}
  .s{position:absolute;left:0;top:0;width:1920px;height:1080px;transform:scale(.15);transform-origin:0 0;background:#0e1d1a;color:#e4efeb;font-family:system-ui,sans-serif}
  .p .s{width:1080px;height:1920px}
  .b{position:absolute;left:90px;top:60px;display:flex;gap:20px;align-items:center;font-size:44px;font-weight:700}.p .b{top:96px}
  .lg{width:76px;height:76px;border-radius:18px;background:#9ed9c8}.xl{width:260px;height:260px;border-radius:60px}
  .c{position:absolute;left:90px;right:90px;top:180px;bottom:120px;display:flex;gap:80px;align-items:center}
  .p .c{top:230px;bottom:360px;flex-direction:column;justify-content:center;align-items:stretch;gap:34px}
  .h{flex:0 0 38%;display:flex;flex-direction:column;gap:34px}.y{flex:1;display:flex;flex-direction:column;gap:30px}.p .h,.p .y{flex:none}
  .k{font:32px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#9ed9c8}
  h1,h2{margin:0;font-weight:800;line-height:1.08}h2{font-size:80px}h1{font-size:104px}.a{color:#9ed9c8}
  .r{display:flex;gap:34px;align-items:center;padding:34px 38px;background:#152b27;border:2px solid #2b4842;border-radius:36px}
  .i{width:110px;height:110px;flex:none;border-radius:50%;background:#234240}
  .t{font-size:46px;font-weight:700}.d{font-size:34px;color:#a3bab3}
  .m{position:absolute;left:90px;right:90px;top:120px;bottom:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center}
  .sub{font-size:46px;color:#a3bab3}
  .z{position:absolute;left:0;right:0;bottom:360px;border-top:6px dashed #d98a62}
  .fit .c{transform:scale(.7)}
  .top .c{flex-direction:column;align-items:stretch;justify-content:center;gap:34px}.top .h,.top .y{flex:none}.top .y{flex-direction:row}.top .r{flex:1;flex-direction:column;align-items:flex-start}
  .hs .m{display:grid;grid-template-columns:auto 1fr;gap:44px 80px;align-content:center;justify-items:start;text-align:left}.hs .xl{grid-row:span 2}
  </style>
  </head>
  <body>
  <div class="row" id="row"></div>
  <script>
  var items=[["Too many tabs","Kept open “for later” until the browser crashes"],["Dead bookmarks","A link with no idea why you saved it"],["Messy notes","Pasted text with no source or summary"],["Placeholder item","Extra row to force an overflow"],["Placeholder item","Extra row to force an overflow"]];
  function list(n){return '<div class="b"><div class="lg"></div>Gleaner</div><div class="c"><div class="h"><div class="k">The problem</div><h2>Saving things is easy. <span class="a">Finding them isn’t.</span></h2></div><div class="y">'+items.slice(0,n).map(function(x){return '<div class="r"><div class="i"></div><div><div class="t">'+x[0]+'</div><div class="d">'+x[1]+'</div></div></div>';}).join('')+'</div></div>';}
  var hook='<div class="m"><div class="lg xl"></div><h1>Stop losing the best parts of the <span class="a">web.</span></h1><div class="sub">Gleaner · a plugin for Claude</div></div>';
  var figs=[["p","9:16 portrait, unchanged; dashed line marks the Shorts safe zone",list(3)+'<div class="z"></div>'],["","16:9 content, side: header beside the body",list(3)],["top","16:9 content, top: header above a body across the width",list(3)],["","16:9 hook, stack: logo above the headline",hook],["hs","16:9 hook, side: logo beside the headline",hook],["fit","Fit guard: a five-row body scaled into its box",list(5)]];
  document.getElementById('row').innerHTML=figs.map(function(f){return '<figure><div class="f '+f[0]+'" aria-hidden="true"><div class="s">'+f[2]+'</div></div><figcaption>'+f[1]+'</figcaption></figure>';}).join('');
  </script>
  </body>
  </html>
  ```

## Next Steps

- Add a square layout for 1:1 and 4:5
  Portrait plus the fit guard covers these sizes, but dense scenes come out small. A third layout would give them room.
  ```text
  In the oncue repo (plugins/oncue/engine), add a third layout for frames whose aspect is between 4:5 and 5:4. Extend `stageFor` in src/spec.ts to return the layout name, add a `#stage.square` CSS block in src/scenes.ts (smaller insets, 2-column grid, header above a tighter body), and add square positions to src/deck.ts, making the deck 7.5×7.5 in for square specs. Add cases to test/fit.test.mjs so the Gleaner example at 1080×1080 has `scale` 1 for every scene. Run npm run build, npm test, and npm run example:stills against a 1080×1080 copy, and look at the contact sheet. Bump plugins/oncue/.claude-plugin/plugin.json by a minor version and add a README changelog entry. Done when npm test exits 0 with 0 skipped and every 1080×1080 scene has `scale` 1.
  ```
- Add a --format WxH override to the CLI
  This would render one storyboard at several sizes without editing short.json; each size would write to its own build folder.
  ```text
  In the oncue repo (plugins/oncue/engine/src/cli.ts), add a `--format 1920x1080` flag to `stills`, `video` and `deck` that overrides `spec.format` after `loadSpec` (re-validated with `checkFormat`) and writes outputs to `build/<width>x<height>/` instead of `build/`. Document it in skills/animate-short/SKILL.md and skills/vertical-deck/SKILL.md. Add a test in test/format.test.mjs (or a new test/cli.test.mjs) for an odd override being rejected and for the output folder name. Run npm run build and npm test. Done when `node dist/cli.js stills examples/gleaner/short.json --format 1920x1080` writes 1920×1080 PNGs under build/1920x1080/stills/ and npm test exits 0.
  ```
- Let short.json pick a scene's 16:9 arrangement
  The engine picks one arrangement per scene kind; this would let an author override it for a single scene.
  ```text
  In the oncue repo (plugins/oncue/engine), add an optional `layout` field to each scene in short.json: "side" or "top" for content scenes, "stack" or "side" for hook and cta. Add it to the scene types in src/spec.ts and validate it in loadSpec, with the error naming lines[i].scene.layout. Have src/scenes.ts use it in place of the kind's default arrangement class and src/deck.ts mirror it. Add a row to skills/storyboard/references/spec.md. Add a test that a list scene with layout "top" renders with its header above the body in both the video (test/landscape.test.mjs) and the deck (test/deck.test.mjs). Bump plugins/oncue/.claude-plugin/plugin.json by a minor version and add a README changelog entry. Run npm run build and npm test. Done when npm test exits 0 with 0 skipped and an invalid layout value fails check with that field named.
  ```
- Letterbox custom aspects in the deck (wish list)
  Today the deck snaps to 9:16 or 16:9. This would size the slide to the spec and shrink the drawn layout into it.
  ```text
  In the oncue repo (plugins/oncue/engine/src/deck.ts), size the slide to the spec's exact aspect and draw the nearest layout (portrait 5.625×10 in or landscape 10×5.625 in) shrunk and centred inside it. Route every addText, addShape and addImage call through one wrapper that scales x, y, w, h, fontSize, line width and rectRadius and adds the centring offset, and fill the margins with brand.colors.ground. Remove the snap notice from src/cli.ts. Extend test/deck.test.mjs so a 1080×1350 deck is 5.625×7.03 in with every shape inside it. Run npm run build and npm test, render the deck with LibreOffice, and look at every slide. Done when npm test exits 0 and the 1080×1350 slides show the portrait layout centred with ground-colour bars.
  ```
