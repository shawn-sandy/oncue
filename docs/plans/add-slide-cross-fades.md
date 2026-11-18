---
status: todo
type: feature
created: 2026-11-18
repo-name: oncue
workflow: never
artifact-url: https://claude.ai/artifact/1C3a7umqSzU2znwKD6bLM1
issue: https://github.com/shawn-sandy/oncue/issues/38
glance: Slides in a deck-to-video MP4 snap from one to the next today, which reads as a slideshow, not a video. A half-second fade on each slide change fixes that without touching the sound, and we will know it worked when a frame taken on a slide change is a blend of both slides while the video is exactly as long as before.
---

# Plan: Fade between slides in deck-to-video instead of cutting

## Objective

Make `assemble` cross-fade from each slide to the next for 0.5 s, centred on the moment it cuts today, on by default, with `--fade <seconds>` to change its length and `--fade 0` to keep hard cuts. The video's length and soundtrack do not change.

## Context

`assemble` (`plugins/oncue/engine/src/assemble.ts`) gives each slide one looped still, trims it to the slide's span and joins the stills with the ffmpeg `concat` filter, so every slide change is a hard cut. The cut times come from `layout`, which holds each slide from its first spoken word to the next slide's.

`docs/proposals/animate-deck-to-video.md` explored animating this route and recommends cross-fades as the first step. Its experiments measured: the same three stills with `xfade` in place of `concat` came out the same length (16.27 s), and twelve 0.5 s fades on a 150 s video encoded in 5.79 s against 3.82 s for cuts.

How the fade fits. A fade occupies the 0.25 s before and after each cut. Each still is held 0.25 s longer on each side that has a fade, and each `xfade` starts 0.25 s before its cut on the output timeline. The stills are static, so holding one longer shows nothing new, and the total length is the same as today. The soundtrack half of the filter graph is untouched.

Risks:

- A slide shorter than the fade. Two fades would overlap inside it. The fade on each side of a short slide is shortened so the two never meet.
- Existing tests sample frames near cuts. `test/deck-to-video.test.mjs` checks each slide is on screen on its words; a sample inside a fade window would now see a blend. Those samples move outside the window, or the test passes `--fade 0` where the fade is not what it is testing.
- Base branch. Deck-to-video reached `main` when pull request 29 merged on 2026-11-18. Implement this on a new branch from `main`, as its own small pull request.

Out of scope: reading the deck's own `<p:transition>`, build states, and any effect other than a plain fade. They are steps 2 and later in the proposal.

## Decisions

- Fades are on by default. Decided by the owner on 2026-11-18.
- The option is `--fade <seconds>`, default 0.5; `--fade 0` gives hard cuts. Chosen by the owner over a bare `--no-fade` flag, so the length can be tuned. It takes a value like every other option, so `flags` in `cli.ts` needs no special case.
- `--fade` must be a number from 0 to 5. Anything else is an error that names the value, not a silent fallback: `Number("abc")` is `NaN` and would otherwise reach ffmpeg.
- An empty or whitespace-only `--fade` value is rejected before `Number` sees it. `flags` stores `""` when an option is the last argument, and `Number("")` is `0`, so a bare `--fade` would otherwise silently mean hard cuts.
- Implement on a branch from `main`, now that pull request 29 has merged. Decided by the owner on 2026-11-18.
- The fade is centred on the existing cut. Confirmed by the owner on 2026-11-18. Centring keeps the video's length and every cut time the engine already computes; the proposal measured it.
- `--fade 0` keeps today's `concat` graph unchanged, not an `xfade` of zero length. `xfade` does not accept a zero duration, and keeping the old path means the option is a true fallback.
- The frame arithmetic lives in one exported pure function, `fadePlan`. It can be tested without ffmpeg, which the engine's other timing code already is.
- The plan is red-green-verify. The engine has a `node --test` suite and this changes application source.
- No SHIP phase. Committing and opening a pull request were not asked for.

## Files

- plugins/oncue/engine/test/crossfade.test.mjs (new) — unit tests for `fadePlan` and the end-to-end fade test
- plugins/oncue/engine/src/assemble.ts (modified) — `FADE`, `fadePlan`, and the `xfade` video graph behind a `fade` option
- plugins/oncue/engine/src/cli.ts (modified) — `--fade <seconds>` on `assemble` with validation, header comment and usage line
- plugins/oncue/engine/test/deck-to-video.test.mjs (modified) — move frame samples out of the fade windows
- plugins/oncue/engine/dist/assemble.js (generated) — rebuilt by `npm run build`
- plugins/oncue/engine/dist/cli.js (generated) — rebuilt by `npm run build`
- plugins/oncue/skills/deck-to-video/SKILL.md (modified) — say slides fade, document `--fade`
- plugins/oncue/.claude-plugin/plugin.json (modified) — version 1.11.0 to 1.12.0
- README.md (modified) — `### 1.12.0` changelog entry

## Steps

### Phase: RED

1. Create `plugins/oncue/engine/test/crossfade.test.mjs` with unit tests that import `fadePlan` and `FADE` from `dist/assemble.js` and cover the cases listed under Tests. Why: the frame arithmetic is where a fade can drift the picture away from the sound, and it can be proven without ffmpeg. Verify: `npm run build && node --test test/crossfade.test.mjs` in `plugins/oncue/engine` exits non-zero because `fadePlan` is not exported (`fadePlan is not a function` or an undefined import), not because of a syntax error in the test; paste the output.
2. Add the end-to-end tests to the same file, using `makeProject` and `COLOURS` from `test/helpers/make-deck.mjs` and the `skip` guard pattern from `test/deck-to-video.test.mjs`: assemble a three-slide silent preview, then assert the frame on the first slide change is a blend, the frame 0.4 s later is the second slide's colour, the length equals the `--fade 0` run's, the `--fade 0` run shows no blend, a `--fade 1` run is still blended 0.4 s after the change, and `--fade abc`, `--fade -1` and a bare `--fade` as the last argument exit non-zero naming the value. Why: this is the objective, checked in the real MP4. Verify: `node --test test/crossfade.test.mjs` fails on the blend assertion with the pixel equal to one slide's solid colour, and on `--fade abc` and the bare `--fade` exiting 0; paste the output.

### Phase: GREEN

3. In `src/assemble.ts` add `export const FADE = 0.5` (the default) and `export function fadePlan(video, fade, fps)` returning, for each still, its whole frame count and, for each slide change, the fade's start frame and length in frames, with frames taken from the running total as the existing loop does and each fade shortened so two fades never overlap inside one slide. Why: one tested function owns the timing. Verify: the unit tests in `test/crossfade.test.mjs` pass after `npm run build`; the end-to-end tests still fail.
4. Change `assemble(dir, out)` to `assemble(dir, out, fade = FADE)`: when `fade` is above 0 and there is more than one slide, build each still's input and `trim` from `fadePlan` and chain `xfade=transition=fade` filters with the planned offsets in place of the video `concat`; otherwise keep the existing `concat` graph exactly. Leave the audio half alone. Why: the fade replaces only how stills are joined. Verify: `node dist/cli.js assemble <a test project>` writes an MP4 whose `ffprobe` duration is within one frame (0.034 s) of the same project's MP4 assembled before this step, with the old `concat` graph.
5. In `src/cli.ts` read `opt["fade"]` in `deckCommand`: when present, throw `--fade must be a number of seconds from 0 to 5, got "<value>"` if the value is empty or only whitespace, then parse it with `Number` and throw the same error unless it is finite and in range, and pass it to `assemble`; add `[--fade seconds]` to the header comment and both usage lines. Why: a mistyped value must stop the command, not reach ffmpeg as `NaN`, and a missing one must not become `0`. Verify: `node --test test/crossfade.test.mjs` passes in full; if it still fails after 8 edit-and-rerun iterations, stop and report the failing assertion, the last diff tried and what was ruled out, and do not report success.
6. Update `test/deck-to-video.test.mjs` so every frame sample that falls within 0.25 s of a slide change moves at least 0.3 s clear of it, keeping each assertion's meaning (the slide is on screen while its words are spoken). Why: those samples would now read a blend and fail for a reason that is not a bug. Verify: `node --test test/deck-to-video.test.mjs` passes, and temporarily running it with `--fade 0` still passes, showing the moved samples are valid for both paths.
7. Update `plugins/oncue/skills/deck-to-video/SKILL.md`: in section 6 (Assemble) say each slide fades into the next over half a second around its first spoken word and that `--fade <seconds>` changes the length and `--fade 0` keeps hard cuts; in "What is not carried over" say the deck's own transitions are replaced by a plain fade. Why: the skill is what the model reads at run time and it currently says each slide appears on its first word. Verify: `grep -n -e "--fade" plugins/oncue/skills/deck-to-video/SKILL.md` prints the new line and `npm run validate` at the repo root exits 0.
8. Set `"version": "1.12.0"` in `plugins/oncue/.claude-plugin/plugin.json` and add a `### 1.12.0 (<date>)` entry above `### 1.11.0` at the end of `README.md` describing the fade and `--fade`. Why: the engine's behaviour changes, and the release workflow reads the version and that changelog heading. Verify: `npm run validate` exits 0 and `grep -n "### 1.12.0" README.md` prints one line.

### Phase: VERIFY

9. Run `npm run build` in `plugins/oncue/engine` and confirm `dist/assemble.js` and `dist/cli.js` are the only changed files under `dist/`. Why: `dist/` is committed so the skills run with no build. Verify: `git status --short plugins/oncue/engine/dist` lists exactly those two files.
10. Run `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` at the repo root. Why: these are the project's stated checks. Verify: all three exit 0 with their output read, and the test summary shows no skipped video tests on a machine with ffmpeg.
11. Run the example end to end in the engine folder: `npm run example:deck` and `npm run example:stills`, and open one still. Why: CLAUDE.md requires it before calling an engine change done, and it confirms the short.json route is unaffected. Verify: both exit 0 and the still shows the expected scene.
12. Assemble a real project twice, with the default and with `--fade 0`, and pull a frame on a slide change from each with `ffmpeg -ss <cut> -i deck.mp4 -frames:v 1 check.png`. Why: a person should see the fade once, not only read a pixel value. Verify: the default frame shows both slides blended, the `--fade 0` frame shows one slide, and the two files' `ffprobe` durations are equal.

## Tests

Tier 1 — This plan changes application code
- Objective: a slide change in the assembled MP4 is a half-second fade, the length is unchanged, and `--fade 0` restores the cut. File: plugins/oncue/engine/test/crossfade.test.mjs; Type: smoke; Asserts: on a three-slide solid-colour project assembled through `dist/cli.js`, the frame at the first slide change has every channel strictly between the two slides' colours, the frame 0.4 s later equals the second slide's colour within encoding tolerance, the duration equals the `--fade 0` run's within one frame, the `--fade 0` frame 0.1 s after the change equals the second slide's colour, a `--fade 1` frame 0.4 s after the change is still a blend, and `--fade abc`, `--fade -1` and a bare `--fade` as the last argument exit non-zero with the value in the message; Run: cd plugins/oncue/engine && npm run build && node --test test/crossfade.test.mjs
- Unit: fade frame arithmetic. File: plugins/oncue/engine/test/crossfade.test.mjs; Targets: `fadePlan`; Key cases: total output frames equal `round(duration * fps)` for fades of 0, 0.5 and 2 s; each fade starts `fade / 2` before its cut and never before frame 0; a one-slide deck has no fades; a slide shorter than the fade gets shortened fades that do not overlap; rounding does not drift across 40 slides of uneven length
- Integration: the existing narrated-deck test still holds. File: plugins/oncue/engine/test/deck-to-video.test.mjs; Targets: `assemble` with recordings, a fallback clip and a silent slide; Key cases: each slide's colour is on screen while its words are spoken, sampled clear of the fade windows; total length unchanged

## Acceptance Criteria

- [ ] `node dist/cli.js assemble <folder>` writes an MP4 in which each slide change is a 0.5 s fade centred on the time it cut at before.
- [ ] The MP4's duration is the same for the default, `--fade 0` and `--fade 1`, to within one frame.
- [ ] `--fade 0` produces hard cuts, and `--fade 1` produces a one-second fade.
- [ ] `--fade abc`, `--fade -1`, `--fade 6` and a bare `--fade` with no value exit non-zero with a message naming the value, and write no MP4.
- [ ] A deck with one slide, and a deck with a slide shorter than the fade, both assemble without error.
- [ ] The soundtrack half of the filter graph in `assemble.ts` is unchanged in the diff.
- [ ] `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0.
- [ ] `SKILL.md` describes the fade and `--fade`, the version is 1.12.0, and `README.md` has a `### 1.12.0` entry.
- [ ] `dist/assemble.js` and `dist/cli.js` are rebuilt and match `src/`.

## Verification

In `plugins/oncue/engine`, run `npm run build && npm test`: every test passes, including `test/crossfade.test.mjs`. Then import any deck, run `node dist/cli.js assemble <folder>` and `node dist/cli.js assemble <folder> --fade 0 --out <folder>/cuts.mp4`. `ffprobe -v error -show_entries format=duration -of csv=p=0` prints the same duration for both files. A frame taken with `ffmpeg -ss <a slide change time> -i <file> -frames:v 1 frame.png` shows two slides blended in the first file and a single slide in the second.

## Next Steps

- Use the deck's own transition kind
  Read `<p:transition>` at import and map fade, push and wipe to ffmpeg `xfade` kinds. The proposal has the mapping and the XML.
  ```text
  In the oncue repo, read docs/proposals/animate-deck-to-video.md, then write a plan (do not implement) for reading each slide's <p:transition> in plugins/oncue/engine/src/slides.ts at import, storing its kind in slides.json, and choosing the matching ffmpeg xfade transition in plugins/oncue/engine/src/assemble.ts, falling back to a plain fade. Before reporting done, confirm the plan names a test that fails when a push transition is rendered as a fade.
  ```
- Build states on spoken words
  Step 2 of the proposal. It needs a deck with builds written by PowerPoint or exported from Google Slides before it is planned.
  ```text
  In the oncue repo, read docs/proposals/animate-deck-to-video.md. Using the animated deck at <path the user gives>, repeat the proposal's experiment 5 (parse click steps from <p:timing>, render one still per build state through LibreOffice) and report whether the linear scan and the transparent-paragraph hiding hold on a PowerPoint-written file. Do not change engine code. Before reporting done, show a contact sheet of the rendered states.
  ```

## Resources

- docs/proposals/animate-deck-to-video.md — the exploration this plan implements step 1 of, with the measured encode times and the `xfade` offset arithmetic
- plugins/oncue/engine/src/assemble.ts — `layout` and the current `concat` graph
- plugins/oncue/engine/test/deck-to-video.test.mjs — the frame-sampling and `skip` patterns the new test follows
