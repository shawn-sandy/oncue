---
status: in-progress
modified: 2026-11-19
type: feature
created: 2026-11-19
repo-name: oncue
workflow: never
effort: high
artifact-url: https://claude.ai/artifact/WC78AvVopXN2B4ahfGkaWr
issue: https://github.com/shawn-sandy/oncue/issues/40
glance: A deck-to-video MP4 today snaps from slide to slide and shows every bullet from the first frame, even while the narrator is still on the first one. This plan adds three things in order, each shipped on its own: fades between slides, the deck's own transition styles, and bullets that appear on the word that names them. We know it worked when a frame sampled just before a bullet's word is spoken does not show that bullet.
---

# Plan: Animate deck-to-video, from slide fades to bullets that build on the spoken word

## Objective

Make `deck-to-video` output move like the deck was presented: slides fade (or push, or wipe, as the deck says) into each other, and click builds reveal each element on the word that names it, without ever changing the video's length or soundtrack.

## Context

`deck-to-video` renders one PNG per slide at import (`renderPages` in `plugins/oncue/engine/src/slides.ts`), and `assemble` (`src/assemble.ts`) loops each still for its slide's span and joins them with the ffmpeg `concat` filter. Every slide change is a hard cut, and a slide that builds five bullets one click at a time shows all five from its first frame.

`docs/proposals/animate-deck-to-video.md` explored this on 2026-11-18 with seven measured experiments. Its findings this plan rests on:

- A `.pptx` stores transitions (`<p:transition>`) and click builds (`<p:timing>` with a `mainSeq` of `clickEffect` steps) as instructions, not pictures. Nothing installed renders them to video.
- An ffmpeg `xfade` between two stills of the same slide, one with an element and one without, looks like that element fading or wiping in.
- Rendering one still per build state through the existing LibreOffice path (remove later shapes; give later paragraphs a transparent fill) held layout and took 4.3 s for 3 slides.
- Matching each build's text against the narrator's words, the way `buildTimeline` matches cue words, placed all 5 test builds on the right word.

That proposal already spawned a detailed plan for the first slice, `docs/plans/add-slide-cross-fades.md` (tracking issue https://github.com/shawn-sandy/oncue/issues/38). Nothing from it is implemented yet: `assemble.ts` still uses `concat` and the plugin is at 1.11.0. This umbrella plan sequences that slice with the two that follow it and adds the gate the owner set on builds.

Risks carried from the proposal review:

- **Hand-written test XML.** Every `<p:timing>` the proposal parsed was written by hand. PowerPoint adds wrappers, `p14` extensions and `mc:AlternateContent`. No real animated deck is available (owner, 2026-11-18), so Phase 3 is a gate: builds code waits for one.
- **Build versus transition collision.** On test slide 3 the first build matched a word at 9.41 s while the slide's own fade ran until 9.43 s. A build must start no earlier than its slide's incoming fade ends.
- **Filter-graph size.** A 40-slide deck with five builds a slide is about 240 still inputs and 239 `xfade` filters in one ffmpeg command. Unmeasured. Phase 4 measures it before shipping and falls back to chunked encodes if it fails.
- **Notes that are not a script.** Real speaker notes often are reminders, so more builds will fall back to even spacing. The match rate on real notes is unmeasured.

## Decisions

- Ship as three pull requests, one per working phase (1.12.0, 1.13.0, 1.14.0) — each is independently useful and the later ones carry more risk.
- Phase 1 is `docs/plans/add-slide-cross-fades.md` as written — it was reviewed against current `main` on 2026-11-19 and still matches; repeating its steps here would let the two drift.
- Fades are on by default, `--fade <seconds>`, `--fade 0` for hard cuts — owner, 2026-11-18.
- Transitions map `fade` to `fade`, `push` to `slide<dir>`, `wipe` to `wipe<dir>`, everything else to `fade` — the proposal's tested mapping; anything richer is below the cut line.
- The transition's length still comes from `--fade`, not the deck's `spd` — one knob keeps the video's timing predictable; `spd` is recorded in `slides.json` for later.
- Builds wait for a real PowerPoint- or Google-Slides-written deck — owner, 2026-11-18; the gate is Phase 3 and stops the plan if the parse fails.
- A build whose words are never spoken is spaced evenly across the slide's span with a warning — owner, 2026-11-18, matching `buildTimeline`.
- A build starts no earlier than the end of its slide's incoming fade — fixes the collision the proposal measured.
- Entrances only: Appear is a cut, Fade a fade, Wipe a directional wipe, any other entrance a fade; exits, emphasis, motion paths, charts, SmartArt, groups, triggers, `advTm` and `.odp` builds are out — the proposal's cut line.
- `--builds off` on `import` renders finished slides only — a person whose deck builds badly needs a way back to today's behaviour without editing the deck.
- Steps are red-green-verify inside each working phase — the engine has a `node --test` suite and every phase changes application source.
- No SHIP phase — committing and pull requests were not asked for in this plan; each phase ends at a passing VERIFY.

## Files

- docs/plans/add-slide-cross-fades.md (modified) — Phase 1, marked completed when built
- plugins/oncue/engine/src/assemble.ts (modified) — `fadePlan`, `xfade` graph, per-change transition kind, build-state stills
- plugins/oncue/engine/src/cli.ts (modified) — `--fade` on `assemble`, `--builds off` on `import`
- plugins/oncue/engine/src/slides.ts (modified) — read `<p:transition>` and `<p:timing>` entrances, render build-state stills
- plugins/oncue/engine/src/builds.ts (new) — parse click steps, hide later elements in the working copy, place steps on cue words
- plugins/oncue/engine/test/crossfade.test.mjs (new) — Phase 1 tests
- plugins/oncue/engine/test/transitions.test.mjs (new) — Phase 2 tests
- plugins/oncue/engine/test/builds.test.mjs (new) — Phase 4 unit and end-to-end tests
- plugins/oncue/engine/test/helpers/make-deck.mjs (modified) — optional transitions and builds on fixture slides
- plugins/oncue/engine/test/fixtures/animated-real.pptx (new) — the real animated deck from the Phase 3 gate
- plugins/oncue/engine/test/deck-to-video.test.mjs (modified) — samples moved clear of fade windows
- plugins/oncue/engine/dist/assemble.js (generated) — rebuilt by `npm run build` after every phase
- plugins/oncue/skills/deck-to-video/SKILL.md (modified) — fades, transitions, builds, the flags, what is still not carried over
- plugins/oncue/.claude-plugin/plugin.json (modified) — 1.12.0, 1.13.0, 1.14.0
- README.md (modified) — one changelog entry per version
- docs/proposals/animate-deck-to-video.md (modified) — Phase 3 gate result appended

## Steps

### Phase: 1 Cross-fades

1. [x] Implement `docs/plans/add-slide-cross-fades.md` end to end with `/plan-agent:build docs/plans/add-slide-cross-fades.md`, on its own branch from `main`, ending at version 1.12.0. Why: it is the low-risk slice every later phase builds on (`fadePlan` and the `xfade` graph), and it is already planned in detail. Verify: that plan's frontmatter reads `status: completed`, `node --test test/crossfade.test.mjs` passes in `plugins/oncue/engine`, and `git grep -n "xfade" plugins/oncue/engine/src/assemble.ts` prints at least one line.

### Phase: 2 RED — deck transitions

2. [x] Extend `test/helpers/make-deck.mjs` so a fixture slide can carry a `<p:transition>` child (`fade`, `push dir="l"`, `wipe dir="r"`, `zoom`), and create `test/transitions.test.mjs` with unit tests for a new `readTransition(slideXml)` and `xfadeKind(transition)` plus an end-to-end test that imports a three-slide deck (fade, push left, zoom) and asserts slide 2's change is a left slide: halfway through it the left half of the frame shows slide 2's colour and the right half slide 1's. Why: the push must be proven as a push in the MP4, not just in the parse. Verify: `npm run build && node --test test/transitions.test.mjs` fails because `readTransition` is not exported and the halfway frame is a uniform blend; paste the output.

### Phase: 2 GREEN — deck transitions

3. [x] In `src/slides.ts` add `export function readTransition(xml)` returning `{ kind, dir, spd } | undefined` from the slide part's `<p:transition>` (tolerating `mc:AlternateContent` by reading its `mc:Fallback`), and store it as an optional `transition` on each `Slide` in `slides.json`; `.odp` and PDF slides leave it absent. Why: import is the only step that reads the deck, and `slides.json` is how it hands facts to `assemble`. Verify: the `readTransition` unit tests pass and an imported fixture's `slides.json` shows `"transition": { "kind": "push", "dir": "l" }` on slide 2.
4. [x] In `src/assemble.ts` add `export function xfadeKind(t)` mapping `fade` to `fade`, `push` to `slideleft`/`slideright`/`slideup`/`slidedown`, `wipe` to `wipeleft`/`wiperight`/`wipeup`/`wipedown`, and anything else or absent to `fade`, and use the incoming slide's kind in each `xfade` the Phase 1 graph builds. Why: one mapping function is testable without ffmpeg and keeps the graph code unchanged in shape. Verify: `node --test test/transitions.test.mjs` passes in full; if it still fails after 8 edit-and-rerun iterations, stop and report the failing assertion and what was ruled out.
5. [x] Update `skills/deck-to-video/SKILL.md` to say fade, push and wipe transitions are kept and others become a fade, set version 1.13.0 in `plugin.json`, and add a `### 1.13.0` README entry. Why: the skill text is what the model reads at run time, and the engine's behaviour changed. Verify: `npm run validate` exits 0 and `grep -n "### 1.13.0" README.md` prints one line.

### Phase: 2 VERIFY — deck transitions

6. [x] Run `npm run build`, then `npm run validate`, `npm run engine:typecheck`, `npm run engine:test`, `npm run example:deck` and `npm run example:stills` from the right folders, and pull one frame mid-push from a real assemble. Why: the project's stated checks plus one look by a person. Verify: all exit 0 with output read, no video tests skipped, and the frame visibly shows two slides side by side, not blended.

### Phase: 3 Gate — real animated deck

7. Obtain a `.pptx` with click builds saved by PowerPoint or downloaded from Google Slides, and before any engine code repeat the proposal's experiment 5 on it in a scratch folder: parse every `mainSeq` click step, render one still per build state through LibreOffice, and make a contact sheet. Why: every build parse so far ran on hand-written XML, and the owner made a real deck the condition for building this. Verify: every click step the deck has in PowerPoint is listed with its target, each state's still shows exactly the elements entered so far, and visible text does not move between states; if any of these fail, append the failure to the proposal, stop the plan here, and report it.
8. Copy the deck (or a reduced copy with no private content) to `plugins/oncue/engine/test/fixtures/animated-real.pptx` and append the gate's result, with the parse output and contact sheet description, to `docs/proposals/animate-deck-to-video.md`. Why: Phase 4's tests need a real file, and the proposal should record that its open risk was retired. Verify: `unzip -l test/fixtures/animated-real.pptx | grep -c "slides/slide"` is 1 or more and `grep -c "<p:timing" ` across its slide parts is 1 or more.

### Phase: 4 RED — build states

9. Create `test/builds.test.mjs` with unit tests for `readBuilds(slideXml)` (on the real fixture and on hand-written shape, paragraph, `withEffect` and `afterEffect` cases), `placeBuilds(steps, words, span, fadeEnd)` (cue match, word after previous cue, even-spacing fallback with a warning, an `afterEffect` keeping its delay, no step before `fadeEnd`), and an end-to-end test that imports a fixture slide whose three bullets build on click with notes naming each bullet, assembles a silent preview, and asserts the frame 0.2 s before the second bullet's word does not show the second bullet while the frame 0.6 s after does. Why: the last assertion is the objective — nothing on screen before it is said. Verify: `node --test test/builds.test.mjs` fails on the missing exports and on the second bullet being visible early; paste the output.

### Phase: 4 GREEN — build states

10. Create `src/builds.ts` with `readBuilds(xml)` returning, per click step, its targets (`spid`, optional paragraph range), effect (`appear`, `fade`, `wipe` with direction, else `fade`), delay and the target text; exits, emphasis and paths are skipped with a warning. Why: parsing is the risky part and belongs in one tested module. Verify: the `readBuilds` unit tests pass, including on `animated-real.pptx`.
11. In `src/slides.ts` and `src/builds.ts`, when the source is a `.pptx` with builds and `--builds off` is not set, write one working copy with each building slide repeated once per state (later shapes removed, later paragraphs given a transparent fill), convert it once, and record each slide's states as `builds: [{ page, text, effect }]` in `slides.json`; `guardSource` still protects the original. Why: one LibreOffice conversion instead of one per state, and the person's deck is never written. Verify: importing the fixture writes `slide-02-b0.png` to `-b3.png`, `slides.json` lists three builds on slide 2, and the source manifest's sha256 is unchanged.
12. Add `placeBuilds` to `src/builds.ts` reusing `norm` and the cue-matching approach of `buildTimeline` in `src/timeline.ts`, then extend `fadePlan` and the `assemble` graph so a slide with builds contributes one still per state, joined by `concat` for Appear and `xfade` of the step's kind otherwise, with no build starting before the incoming fade ends. Why: the timing must reuse the code that already places slides on words, and the collision rule is enforced in one place. Verify: `node --test test/builds.test.mjs` passes in full and the assembled duration equals the same project's `--builds off` duration within one frame; stop and report after 8 failed iterations.
13. Add `--builds off` to `import` in `src/cli.ts` with usage text, and update `SKILL.md` to say builds now play on the narrator's word, that steps never spoken are spaced evenly, what is still not carried over, and how to turn builds off; set version 1.14.0 and add a `### 1.14.0` README entry. Why: the escape hatch and the skill's promise must ship with the behaviour. Verify: `node dist/cli.js import <deck> --builds off` writes one still per slide, `npm run validate` exits 0, and `grep -n "### 1.14.0" README.md` prints one line.

### Phase: 4 VERIFY — build states

14. Generate a 40-slide deck with five builds per slide via `make-deck.mjs`, assemble a silent preview, and record wall time, peak memory (`/usr/bin/time -l`) and whether ffmpeg accepted the command line. Why: 240 inputs in one filter graph is the proposal's unmeasured risk. Verify: the encode exits 0 and the measured numbers are written into the PR description; if it fails, switch `assemble` to encode per-slide segments and `concat` them, then re-run this step.
15. Run `npm run build`, `npm run validate`, `npm run engine:typecheck`, `npm run engine:test`, `npm run example:deck` and `npm run example:stills`, then assemble `animated-real.pptx` with its notes and watch the result. Why: CLAUDE.md requires the full checks and a look at real output before calling an engine change done. Verify: all exit 0 with output read, no skipped video tests, and in the watched video each bullet appears on or just after the word that names it.

## Tests

Tier 1 — This plan changes application code

- Objective: a built bullet is not on screen before the narrator names it, and the video's length is unchanged. File: plugins/oncue/engine/test/builds.test.mjs; Type: smoke; Asserts: on an imported fixture slide whose three bullets build on click, the silent-preview frame 0.2 s before the second bullet's cue word lacks the second bullet's colour and the frame 0.6 s after shows it, and the duration equals the `--builds off` run's within one frame; Run: cd plugins/oncue/engine && npm run build && node --test test/builds.test.mjs
- Unit: cross-fade arithmetic. File: plugins/oncue/engine/test/crossfade.test.mjs; Targets: `fadePlan`; Key cases: as listed in `docs/plans/add-slide-cross-fades.md`
- Unit: transition parse and mapping. File: plugins/oncue/engine/test/transitions.test.mjs; Targets: `readTransition`, `xfadeKind`; Key cases: fade, push in four directions, wipe in four directions, `mc:AlternateContent` with a `p14` transition reads its fallback, an unknown kind maps to `fade`, no transition element returns undefined
- Unit: build parse and placement. File: plugins/oncue/engine/test/builds.test.mjs; Targets: `readBuilds`, `placeBuilds`; Key cases: the real fixture's click steps in order; shape and paragraph targets; `withEffect` joins the current step; `afterEffect` keeps its delay; exits and emphasis skipped with a warning; cue found after the previous cue; no cue gives even spacing and a warning; no step before the incoming fade ends
- Integration: transitions in the MP4. File: plugins/oncue/engine/test/transitions.test.mjs; Targets: import plus assemble; Key cases: a push left shows slide 2 on the left half and slide 1 on the right halfway through; a zoom falls back to a blend; `--fade 0` still gives hard cuts
- Integration: existing narrated-deck test. File: plugins/oncue/engine/test/deck-to-video.test.mjs; Targets: `assemble` with recordings; Key cases: each slide on screen during its words, sampled clear of fade windows; length unchanged

## Acceptance Criteria

- [x] Each slide change in a default `assemble` is a 0.5 s fade centred on the old cut, and `--fade 0` restores hard cuts.
- [x] A `.pptx` slide with a push or wipe transition is entered with that motion and direction; any other transition is a fade.
- [ ] A PDF or `.odp` input assembles exactly as after Phase 1, with fades and no builds.
- [ ] On a `.pptx` with click builds, an element whose text is spoken does not appear before that word.
- [ ] A build whose text is never spoken appears at an evenly spaced time and the command prints a warning naming it.
- [ ] No build begins before its slide's incoming transition has finished.
- [ ] `import --builds off` renders one still per slide, as today.
- [ ] The source deck's sha256 is unchanged after import in every phase.
- [ ] The video's duration is identical with and without fades and builds, to within one frame.
- [ ] A 40-slide, 200-build deck assembles without error, and its measured time and memory are recorded.
- [ ] `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0 at the end of every phase.
- [ ] The plugin is at 1.14.0 with `### 1.12.0`, `### 1.13.0` and `### 1.14.0` README entries, and `SKILL.md` describes fades, transitions, builds and `--builds off`.

## Completion Report

- Phases 1 and 2 on one branch at 1.13.0 — the plan's three-PR split was not followed; README has `### 1.12.0` and `### 1.13.0`.
- Checks pass on 2026-11-19 — validate and typecheck exit 0, engine:test 169 pass, 0 fail, 1 skipped (LibreOffice-only import render, unrelated), example:deck and example:stills exit 0; ffmpeg was installed with Homebrew for `xfade`.
- Push direction reversed in the test — a `push dir="l"` enters from the right, so mid-change the old slide is on the left and the new one on the right; a viewed frame confirmed it.
- `--fade 1` sampled at 0.3 s, not 0.4 s — at 0.4 s a one-second fade is 90 % settled and reads as the new slide.
- Blocked at step 7 — no real animated `.pptx` exists, so Phases 3 and 4 have not started.

## Verification

In `plugins/oncue/engine`, run `npm run build && npm test`: every test passes, including `crossfade`, `transitions` and `builds`. Import `test/fixtures/animated-real.pptx` twice, once plain and once with `--builds off`, write a narration for each, and run `node dist/cli.js assemble <folder>` on both. `ffprobe -v error -show_entries format=duration -of csv=p=0` prints the same duration for both MP4s. In the builds video, a frame taken with `ffmpeg -ss <time just before a bullet's word> -i deck.mp4 -frames:v 1 before.png` does not show that bullet and one taken 0.6 s later does; in the `--builds off` video the same frames both show it.

## Next Steps

- Builds for `.odp` decks
  LibreOffice's model (`anim:par`, `presentation:node-type`) is equivalent but needs a second parser.
  ```text
  In the oncue repo, read docs/plans/add-deck-animation.md and plugins/oncue/engine/src/builds.ts, then write a plan (do not implement) for reading click builds from an .odp content.xml into the same steps readBuilds returns. Before reporting done, confirm the plan names a test that fails when an .odp slide's second bullet is visible before its cue word.
  ```
- Cue words in narration.md
  Let a person name a build's cue word when the automatic match is wrong.
  ```text
  In the oncue repo, read docs/proposals/animate-deck-to-video.md ("Let the person override") and plugins/oncue/engine/src/narration.ts, then propose (do not implement) a syntax in narration.md for naming a build step's cue word, and how placeBuilds would read it. Before reporting done, show one example narration.md with an override and the resulting build time.
  ```

## Unresolved Questions

- Which real animated deck
  None exists yet; Phase 3 cannot start until one does.
  ```text
  In the oncue repo, help me make a small test deck in Google Slides with three slides: a fade transition, a push transition, and one slide whose three bullets appear on click one by one, with speaker notes that mention each bullet. Give me exact click-by-click steps, then tell me how to download it as .pptx and where to put it for docs/plans/add-deck-animation.md step 7.
  ```

## Resources

- docs/proposals/animate-deck-to-video.md — the measured exploration this plan sequences
- docs/plans/add-slide-cross-fades.md — Phase 1 in full detail
- https://github.com/shawn-sandy/oncue/issues/38 — Phase 1 tracking issue
- plugins/oncue/engine/src/assemble.ts — `layout` and the `concat` graph every phase changes
- plugins/oncue/engine/src/timeline.ts — `buildTimeline` cue matching that `placeBuilds` reuses
