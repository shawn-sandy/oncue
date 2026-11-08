---
status: todo
type: feature
created: 2026-11-08
repo-name: oncue
effort: high
workflow: auto
source: docs/prompts/proposal-add-narrate-deck-skill.md
artifact-url: https://claude.ai/artifact/8B2SZdFKJn6oiyknWrXLJn
glance: People already have decks with speaker notes, and OnCue can only start from a topic. After this, a PowerPoint or Google Slides deck becomes a narrated, word-timed video with each slide shown exactly as designed. We will know it worked when a real four-slide deck renders full-frame at 1920x1080, as a centred band at 1080x1920, and every engine check passes.
---

# Plan: Turn any slide deck into a narrated OnCue video

## Objective

Ship a `narrate-deck` skill that turns a PowerPoint or Google Slides deck into an OnCue video, backed by a new full-bleed `slide` scene kind in the engine, as OnCue 1.9.0.

## Context

OnCue (`plugins/oncue/`, version 1.8.0) starts from a topic, writes `short.json`, and renders a voiceover, a deck and an MP4. Nothing accepts an existing deck as input. A deck is already most of a storyboard: each slide is a beat (one narrated moment of the video) and its speaker notes are draft narration. The voiceover, word timing and video stages work unchanged.

The one engine gap: the only picture scene, `image`, puts the picture in a bordered card under a kicker and title (`engine/src/scenes.ts:81-83`, `:192-196`), so a whole slide would shrink and repeat its own title. A full-bleed `slide` kind closes it. The proposal at `docs/prompts/proposal-add-narrate-deck-skill.md` holds the research and the decisions settled on 2026-11-08; this plan treats them as inputs.

Risk found while planning: every scene enters with a push-in from 50 px below and leaves with a lift of up to 60 px and a scale that dips to 0.998 (`engine/src/render.ts:86-97`). Ordinary scenes are transparent over the shared background, so this never shows. A full-bleed picture moving that far exposes a strip of background at the top or bottom during each transition. Covering it fully with an oversized picture would crop about 11% of every slide. Step 10 handles this by changing how `slide` beats move (see Decisions).

Other risks, with mitigations, are in the proposal: speaker notes are rarely narration (approval gate), small text in 9:16 (a `check` warning), PowerPoint's default 1280 px export (an upscale warning plus export instructions), and Google Slides thumbnails possibly not downloading in a sandbox (spike first, PowerPoint path as fallback).

## Decisions

- Approach is Narrate: each slide is shown as a picture, its notes become the voiceover. Settled in the proposal over Narrate + rebuild, Rebuild only, and keeping the current approach.
- Notes are rewritten for the ear and shown in full; nothing is recorded before the person approves the script. Same gate as explainer-video.
- 1920x1080 is the primary shape; 1080x1920 is supported with the slide letterboxed (fitted inside the frame) as a band across the middle on the ground colour.
- The skill lives in its own folder, `plugins/oncue/skills/narrate-deck/`, so explainer-video stays about topics.
- The engine stays offline: Google Slides is reached through its connector from skill prose; PowerPoint notes are read with `unzip -p`. No new dependency.
- Work is split into lanes: the spikes and the engine run in parallel because the engine does not depend on the import path; the skill waits for both; the lead lane bumps the version last.
- The engine lane is red-green-verify: the engine has a `node --test` runner and its tests import `dist/`, so a test for the new kind fails for the right reason (unknown kind) before any code exists.
- The glow is hidden behind slide beats by giving the slide section an opaque ground background, not by a per-beat switch in `render.ts`: the glow blobs are shared layers of the whole stage (`scenes.ts:129`).
- `test/theme.test.mjs` stays unchanged: its count of content scenes comes from the gleaner example, which has no slide beats. The new scene test asserts that slide beats carry no brand row instead.
- Spike findings are written straight into `skills/narrate-deck/references/intake.md`, which the skill links, so the research becomes the skill's instructions without a copy.
- No committed example deck: tests generate pictures with `sharp` as the image tests do, and the end-to-end run uses the person's real deck in a scratch folder, since a real deck may be private.
- End-to-end stills use estimated timing (no `--words`/`--audio`), so the check spends no ElevenLabs credits.
- Slide beats keep the fade and the slow hold zoom but skip the entry push and exit lift, with scale kept at or above 1, so nothing is cropped and no edge shows. Chosen 2026-11-08 over oversizing the picture (crops about 11%) and accepting a brief edge strip.
- Hidden and skipped slides are left out by default, and the skill lists which ones it skipped. Chosen 2026-11-08 over including them with a warning.
- The person supplies the four-slide test deck: a Google Slides link plus the same deck as `.pptx` with its slides exported as PNG. Chosen 2026-11-08 over using OnCue's own gleaner deck, which would skip the Google Slides check.
- Version 1.9.0, assuming this lands before the reel proposal (see Unresolved Questions).
- No `## Previews`: the frame is the person's own slide, so there is nothing new to design; the stills in Step 21 are the visual proof.

## Files

- plugins/oncue/skills/narrate-deck/references/intake.md (new) — verified intake steps per source, written by the spikes
- plugins/oncue/engine/test/slide-spec.test.mjs (new) — contract tests: validation, warnings, cue slots, timeline
- plugins/oncue/engine/test/slide-scene.test.mjs (new) — scenes page and deck output for slide beats
- plugins/oncue/engine/test/slide-stills.test.mjs (new) — real frames: no exposed edge, letterbox band
- plugins/oncue/engine/src/spec.ts (modified) — SlideScene type, kind list, "full" arrangement, picture checks, slideWarnings
- plugins/oncue/engine/src/cues.ts (modified) — no animated slots for slide
- plugins/oncue/engine/src/scenes.ts (modified) — full-bleed slide section, no brand row, picture copy, CSS
- plugins/oncue/engine/src/render.ts (modified) — slide motion rule from Step 10
- plugins/oncue/engine/src/deck.ts (modified) — full-bleed picture slide with the voiceover in the notes
- plugins/oncue/engine/src/cli.ts (modified) — check prints the slide warnings
- plugins/oncue/engine/dist/ (generated) — rebuilt with npm run build
- plugins/oncue/skills/storyboard/references/spec.md (modified) — slide row in the scene kinds table
- plugins/oncue/evals/research-topics/fixtures/README.md (modified) — current scene kinds list
- plugins/oncue/skills/narrate-deck/SKILL.md (new) — the skill
- plugins/oncue/skills/explainer-video/SKILL.md (modified) — cross-link to narrate-deck
- plugins/oncue/skills/vertical-deck/SKILL.md (modified) — cross-link to narrate-deck
- plugins/oncue/.claude-plugin/plugin.json (modified) — version 1.9.0
- README.md (modified) — kinds list, skills table, nine skills, deck section, changelog

## Steps

### Lane: spikes (owns: plugins/oncue/skills/narrate-deck/references/intake.md)

1. Run the Google Slides intake spike on the test deck: call the connector's `read_presentation` with fields `slides(objectId,slideProperties(isSkipped,notesPage))`, read each slide's notes through `notesProperties.speakerNotesObjectId`, call `read_slide_page_thumbnail` at `WIDTH2000_PX`, and download each `contentUrl` inside the sandbox with `node -e "fetch(url).then(...)"`; record the exact calls, the picture size received, and whether the download worked under a "Google Slides" heading in `plugins/oncue/skills/narrate-deck/references/intake.md` Why: the connector path has never run on a real deck, and a blocked download moves Google Slides onto the PowerPoint fallback Verify: the section names the picture width received and says "download worked" or quotes the exact error.
2. Run the PowerPoint intake spike on the same deck saved as `.pptx`: list slide order from `ppt/presentation.xml` through `ppt/_rels/presentation.xml.rels`, read notes with `unzip -p deck.pptx ppt/notesSlides/notesSlideN.xml` matched to slides through `ppt/slides/_rels/slideN.xml.rels`, join the `<a:t>` runs per paragraph, and check whether a hidden slide carries `show="0"` on `<p:sld>`; record the commands and rules under a "PowerPoint" heading Why: notes are matched to slides through relationship files, not by file number, and the hidden-slide flag is unverified Verify: running the recorded commands on the deck prints four notes in the order PowerPoint shows them.
3. Ask the person to export the deck from PowerPoint for Mac (File, Export, PNG) and report the size options the dialog offers and the pixel width produced; write per-platform export instructions (Mac dialog, Windows `ExportBitmapResolution` registry value, Google Slides thumbnails) under an "Exporting pictures" heading Why: PowerPoint's default export is 1280 px wide, and the Mac options are unverified Verify: each of the three headings ends with a "Verified 2026-..." line or an "Unverified:" line saying why.

### Lane: engine (owns: plugins/oncue/engine/**, plugins/oncue/skills/storyboard/references/spec.md, plugins/oncue/evals/research-topics/fixtures/README.md)

### Phase: RED

4. Write `plugins/oncue/engine/test/slide-spec.test.mjs`, following `test/image-spec.test.mjs`: `loadSpec` accepts `{ kind: "slide", src, alt }`; it rejects a missing `alt`, a `.webp` `src` and a missing file, naming the field; `checkPictures` rejects a WebP renamed to `.png` on a slide beat; `slideWarnings` warns "letterboxed" for a 1920x1080 picture in a 1080x1920 frame, warns "upscaled" for a 1280x720 picture in a 1920x1080 frame, and returns nothing for 1920x1080 in 1920x1080; `slots()` returns `[]` for a slide; `buildTimeline` on an all-slide spec returns no warnings Why: these pin the contract from the proposal's Appendix A before any code exists Verify: `npm --prefix plugins/oncue/engine test` fails with `scene.kind: must be one of hook, list, ...` (the kind is unknown, the right reason) — paste the output.
5. Write `plugins/oncue/engine/test/slide-scene.test.mjs`, following `test/image-scene.test.mjs`: `writeScenes` on one filling and one letterboxed slide beat gives sections with no `.brand` row, an `img` that covers and one that is contained, and a downscaled copy in `images/`; `writeDeck` gives one picture per slide, the filling one at full slide size (`a:ext cx` equals the slide width in EMU), no kicker or title text, and the beat's `vo` in its notes slide, read through JSZip Why: proves both renderers draw the slide full-bleed and keep the narration in the notes Verify: the suite fails on the unknown kind — paste the output.
6. Write `plugins/oncue/engine/test/slide-stills.test.mjs`, following `test/image-stills.test.mjs` (it skips with the reason when Chromium cannot launch): two solid-colour slide beats at 1920x1080; capture stills mid-hold and mid-transition with `--at`; assert the top and bottom pixel rows are slide colour and never the ground colour; at 1080x1920 assert a centred band of slide colour with ground colour above and below Why: the scene motion can expose the frame edge behind a full-bleed picture, and only real frames show it Verify: the test fails on the unknown kind (or reports its Chromium skip reason) — paste the output.

### Phase: GREEN

7. In `plugins/oncue/engine/src/spec.ts`: add `SlideScene { kind: "slide"; src: string; alt: string }` to `Scene`, `"slide"` to `KINDS`, `"full"` to `Arrangement` and `slide: "full"` to `WIDE` (widening its mapped type), run the `image` checks for `src` and `alt` in `loadSpec` and the decode check in `checkPictures` for both kinds, and export `async function slideWarnings(loaded)` returning the 2% shape-mismatch and narrower-than-frame warnings Why: one contract both renderers read, and one rule for every picture Verify: after `npm --prefix plugins/oncue/engine run build`, the validation, warning and timeline cases in `slide-spec.test.mjs` pass.
8. In `plugins/oncue/engine/src/cues.ts`, return `[]` for `slide` in `slots()`; in `plugins/oncue/engine/src/scenes.ts`, render `slide` as one full-bleed picture with no `content()` wrapper, skip the brand row for it beside hook and cta (`:133`), extend the sharp copy (`:117-122`) to slide beats, use `object-fit: cover` when the picture and frame shapes match within 2% and `contain` otherwise, and give the slide section an opaque `var(--ground)` background Why: the whole slide enters at its beat's start with nothing drawn over it, and the opaque ground hides the glow for letterboxed slides Verify: `slide-scene.test.mjs` scenes-page cases and the `slots()` case pass.
9. In `plugins/oncue/engine/src/deck.ts`, skip `header()` for `slide` (`:258`) and add `case "slide"` that re-encodes the picture through sharp as the image case does (no EXIF) and places it at 0,0,W,H when shapes match within 2%, or centred and contained on the ground colour otherwise, with `alt` as its alt text Why: the deck must show the slide as designed with the narration in the notes Verify: the deck cases in `slide-scene.test.mjs` pass.
10. Apply the slide motion rule in `plugins/oncue/engine/src/render.ts` (see Decisions): mark slide sections (for example `data-still`), keep the fade and the slow hold zoom, skip the entry push and exit lift for them, and keep their scale at or above 1, so no overscan is needed and nothing is cropped; keep animation a pure function of time Why: the default push and lift expose a strip of background behind a full-bleed picture (see Context) Verify: `slide-stills.test.mjs` passes, and `git diff` shows the gleaner scenes' transform untouched.
11. In `plugins/oncue/engine/src/cli.ts`, print `slideWarnings` with the other `check` warnings (`:87`) Why: the person learns about small or soft slides before recording Verify: `node plugins/oncue/engine/dist/cli.js check` on a 1080x1920 slide spec prints a `warning:` line with "letterboxed".
12. Add a `slide` row to the kinds table and the arrangement sentence in `plugins/oncue/skills/storyboard/references/spec.md`, and replace the old kinds list in `plugins/oncue/evals/research-topics/fixtures/README.md:126`; if any engine test still fails after 8 edit-and-rerun iterations across Steps 7-11, stop and report the failing assertion, the last diff tried and what was ruled out — do not report success Why: CLAUDE.md requires a spec.md row for every new `short.json` field Verify: `grep -n '"slide"\|slide' plugins/oncue/skills/storyboard/references/spec.md` shows the row.

### Phase: VERIFY

13. Run `npm --prefix plugins/oncue/engine run build`, then `npm run engine:typecheck` and `npm run engine:test` from the repo root Why: `dist/` is committed and the skills run it without a build Verify: all three exit 0 and `git status` shows `dist/` changed alongside `src/`.
14. Run `npm run example:deck` and `npm run example:stills` in `plugins/oncue/engine`, and compare the gleaner stills with the ones from `main` Why: the motion and deck changes must not move any existing scene Verify: the stills match `main` frame for frame by eye, and `build/fit.json` shows no new shrunk scenes.

### Lane: skill (owns: plugins/oncue/skills/narrate-deck/SKILL.md, plugins/oncue/skills/explainer-video/SKILL.md, plugins/oncue/skills/vertical-deck/SKILL.md; after: spikes, engine)

15. Write `plugins/oncue/skills/narrate-deck/SKILL.md`: frontmatter with `name: narrate-deck`, a description of at most 1024 characters with no angle brackets, and a single-quoted one-line `compatibility`; an opening line saying builds, animations and embedded video are lost; then intake (linking `references/intake.md`), one beat per visible slide in deck order, hidden and skipped slides left out with a list of what was skipped, narration rewritten for the ear with `[YOUR FACT]` for missing facts, the full script shown and nothing recorded before approval, shape choice with a small-text warning before 9:16, `short.json` with every beat a `slide` beat and `brand` filled from the deck (a logo file is required, `spec.ts:200-212` and `scenes.ts:115`), `check`, then hand-off to voiceover, stills and video with the deck stage skipped, and delivery as explainer-video does Why: the skill is the workflow; the engine only renders what it writes Verify: `npm run validate` exits 0.
16. Add one line, "Have a deck already? Use narrate-deck.", near the top of `plugins/oncue/skills/explainer-video/SKILL.md` and `plugins/oncue/skills/vertical-deck/SKILL.md` Why: people who start in those skills with a deck in hand should find the right one Verify: `grep -l narrate-deck plugins/oncue/skills/*/SKILL.md` lists both files and `npm run validate` exits 0.
17. Dry-run the skill on the test deck by following `SKILL.md` step by step into a scratch folder, producing `short.json` and `slides/slide-NN.png`, then run `node plugins/oncue/engine/dist/cli.js check <scratch>/short.json` Why: proves the written instructions produce a spec the engine accepts Verify: `check` exits 0 and prints only the expected slide warnings.

### Lane: lead (after: spikes, engine, skill)

18. Bump `plugins/oncue/.claude-plugin/plugin.json` to `1.9.0` and update `README.md`: the kinds list (`:138`), a `narrate-deck` row in the skills table (`:127-134`), "All nine skills" (`:199`), a short "Turn a deck into a video" section, and a `### 1.9.0` changelog entry Why: the release workflow tags from `plugin.json` and publishes the matching changelog entry Verify: `grep '"version": "1.9.0"' plugins/oncue/.claude-plugin/plugin.json` and `grep '### 1.9.0' README.md` both match, and `npm run validate` exits 0.
19. Run `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` on the merged branch Why: each lane passed alone; this proves they pass together Verify: all three exit 0.
20. Render the test deck at 1920x1080: from the Step 17 scratch spec, run `deck` and `stills` (estimated timing), and open every still Why: the objective is a real deck as a video, not passing unit tests Verify: each still shows its slide filling the frame with no background strip at any edge, and the deck has one full-frame slide per beat with the narration in the notes.
21. Switch the scratch spec's `format` to 1080x1920, run `check` and `stills`, and open every still Why: 9:16 is a supported shape and its readability is the known risk Verify: `check` prints the letterboxed warning, and each still shows the slide as a centred band on the ground colour with no brand row.

## Tests

Tier 1 — This plan changes application code
- Objective: slide beats render full-bleed in real video frames. File: plugins/oncue/engine/test/slide-stills.test.mjs; Type: smoke; Asserts: at 1920x1080 the top and bottom pixel rows are slide colour at mid-hold and mid-transition, and at 1080x1920 the slide is a centred band on the ground colour; Run: npm run engine:test
- Unit: the slide contract. File: plugins/oncue/engine/test/slide-spec.test.mjs; Targets: loadSpec, checkPictures, slideWarnings, slots, buildTimeline; Key cases: valid slide, missing alt, .webp src, missing file, renamed WebP, letterbox warning, upscale warning, exact fit with no warning, empty cue slots, all-slide timeline with no warnings
- Integration: both renderers on slide beats. File: plugins/oncue/engine/test/slide-scene.test.mjs; Targets: writeScenes, writeDeck; Key cases: no brand row, cover versus contain, downscaled picture copy, full-size deck picture, no kicker or title in the deck, vo in the notes slide

## Acceptance Criteria

- [ ] `node dist/cli.js check` accepts a `short.json` whose beats are all `{ "kind": "slide", "src", "alt" }` and rejects a slide beat without `alt`, naming `lines[i].scene.alt`.
- [ ] `check` prints a letterboxed warning when the picture and frame shapes differ by more than 2%, an upscaled warning when the picture is narrower than the frame, and neither for a 1920x1080 picture in a 1920x1080 frame.
- [ ] In 1920x1080 stills, a slide beat fills the frame with no ground colour along any edge, at hold and mid-transition.
- [ ] In 1080x1920 stills, a slide beat shows as a centred band on the ground colour with no brand row.
- [ ] The deck has one full-frame picture slide per slide beat, with that beat's `vo` in its notes and no kicker or title.
- [ ] The gleaner example's deck and stills are unchanged from `main`.
- [ ] `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0.
- [ ] `plugins/oncue/skills/narrate-deck/SKILL.md` states that no audio is recorded before the person approves the script.
- [ ] `references/intake.md` records a verified or explicitly unverified result for Google Slides, PowerPoint and picture export.
- [ ] `plugin.json` says `1.9.0`, and `README.md` has a `### 1.9.0` entry and lists nine skills.

## Verification

Run `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` from the repo root; all three exit 0, and the stills test reports a pass rather than a Chromium skip. Then take a real four-slide deck through the skill into a scratch folder, run `check`, `deck` and `stills` at 1920x1080, and open every still: each slide fills the frame, nothing shows at the edges, and the deck has the narration in each slide's notes. Switch the format to 1080x1920, run `check` and `stills` again: `check` prints the letterboxed warning and each still shows the slide as a centred band on the ground colour. Finally run `npm run example:deck` and `npm run example:stills` in the engine and confirm the gleaner output is unchanged.

## Next Steps

- Record a voiceover and render the full MP4 for the test deck
  The end-to-end check uses estimated timing to spend no credits; a real take proves the word timing on slide beats.
  ```text
  In the oncue repo, take the scratch short.json from the narrate-deck end-to-end run, record its voiceover with the oncue voiceover skill (ElevenLabs connector), then run `node plugins/oncue/engine/dist/cli.js video <short.json> --words words.json --audio voiceover.mp3`. Watch the MP4 and confirm each slide appears on its beat and no background strip shows during transitions. Report the file path and any timing warnings from the run.
  ```
- Fix the skill count in CLAUDE.md
  CLAUDE.md line 7 says six skills; there are nine after this plan.
  ```text
  In the oncue repo, change "six skills" in CLAUDE.md line 7 to the actual count of folders under plugins/oncue/skills/. Verify with `ls plugins/oncue/skills | wc -l`. No version bump: this is a wording fix.
  ```

## Unresolved Questions

- Ship before or after the reel proposal? Both claim the next minor version and a full-bleed layer; this plan assumes 1.9.0 and that it lands first.
  ```text
  In the oncue repo, compare docs/plans/add-narrate-deck-skill.md with docs/proposals/add-reel-runway-skill.md. Recommend which should ship first, given both need a full-bleed layer and the next minor version in plugins/oncue/.claude-plugin/plugin.json. Name the version each would take.
  ```

## Resources

- `docs/prompts/proposal-add-narrate-deck-skill.md` — the converged proposal this plan executes; Appendices A to C hold the slide contract, intake per source and a worked example.
- Google Slides API, `presentations.pages.getThumbnail` and `SlideProperties` — https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages
- Google Slides speaker notes guide — https://developers.google.com/workspace/slides/api/guides/notes
- Microsoft Learn, export high-resolution slides from PowerPoint — https://learn.microsoft.com/en-us/office/troubleshoot/powerpoint/change-export-slide-resolution
