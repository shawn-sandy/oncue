---
status: todo
type: feature
created: 2026-11-18
repo-name: oncue
effort: high
workflow: never
artifact-url: https://claude.ai/artifact/4Q8SSYN4MXChq5BU33cQBr
issue: https://github.com/shawn-sandy/oncue/issues/37
glance: Today OnCue only makes videos from its own short.json storyboards, so a finished PowerPoint or Google Slides deck cannot become a narrated video. After this, a person hands over a .pptx or a PDF export, approves a narration script drafted from their speaker notes and slide text, and gets an MP4 with a voiceover timed to each slide, while the original file is provably byte-for-byte unchanged (a recorded checksum before and after every run).
---

# Plan: Turn any PowerPoint or Google Slides export into a narrated video with a new OnCue skill, without touching the original file

## Context

OnCue (`plugins/oncue/`) turns a `short.json` storyboard into a PowerPoint deck and a word-synced MP4. Every skill starts from `short.json`, which has nine fixed scene kinds. A deck made elsewhere does not fit them, and rebuilding it as scenes would re-theme the author's design. This plan therefore adds a second route that bypasses `short.json`: render each slide to a picture, narrate it, and stitch pictures and audio with ffmpeg.

What already exists and is reused:

- The voiceover stage (`skills/voiceover/SKILL.md`): ElevenLabs generates one continuous read, a transcript gives word times, `words.json` is saved. Reference cost from the repo: about 1,100 credits per 75-second take and about 600 per transcription.
- The word-to-beat split in `engine/src/timeline.ts` (`lineStarts`, `estimateWords`, `splitWarnings`, `LEAD` 0.3 s, `TAIL` 1.6 s). These only read each line's `vo` text, so they can serve slides without a `Spec`.
- The ffmpeg encoding pattern in `engine/src/capture.ts` (H.264, AAC, 30 fps, silent track when there is no audio).
- The existing habit in `skills/vertical-deck/SKILL.md` of using LibreOffice (`soffice`) and `pdftoppm` to turn a .pptx into images.

Inputs: a .pptx (including one downloaded from Google Slides), a PDF exported from Google Slides or any other tool, or an .odp. Speaker notes exist only in .pptx and .odp. A Google Slides export as .pptx is expected to keep notes, but that is unverified (see Unresolved Questions). A PDF carries no notes, so its narration is drafted from the page pictures.

Narration rule, decided with the requester: voiceover is core, not optional. A slide with speaker notes uses them as written. A slide without notes gets a line drafted from its own text, and every line waits in `narration.md` for the person's approval before any audio is recorded.

The requirement that the source stays unedited is the load-bearing constraint. Three mechanisms enforce it: work only on a copy, record a SHA-256 checksum and modified time of the source before and after, and fail the run if they differ.

Risks and mitigations:

**Slide boundaries in one continuous read.** The split finds each slide by its first spoken word at a sentence start. Notes often open with "So," or repeat an opening word. Mitigation: `narration` runs `splitWarnings` on the script and lists each flagged opening. A slide is unplaceable when its first word is not found at a sentence start after the previous slide's start, or when the chosen split lands inside an earlier slide's own text: the planner checks each candidate against the previous slide's estimated span (`estimateWords`) and treats any sentence-initial repeat of the word within that span as ambiguous, so "Hello world. So we start." followed by a slide opening "So we continue." is unplaceable, not split at the inner "So". Speaker notes are never rewritten to fix this: an unplaceable slide that has notes is recorded as its own per-slide clip with its notes unchanged, while every slide that places cleanly stays in the one continuous read (contiguous clean slides form a run, one take per run). Only a slide whose line was drafted may be reworded instead. The skill states the extra takes, and their credit cost, before recording.

**Slides with no narration.** One continuous audio file has no gap for a silent slide. Mitigation: `assemble` cuts the audio at the boundary and inserts a fixed silent dwell.

**Rendering tools are missing on this machine.** `soffice` and `pdftoppm` are not installed here, while `ffmpeg`, `ffprobe` and Playwright browsers are. Rendering is therefore verified only where they exist. The tests for the source guard, notes, narration and assembly do not need them, and the rendering smoke test reports itself skipped, never passed, when they are absent.

**Rendering fidelity.** LibreOffice substitutes missing fonts and can misdraw SmartArt, and slide animations and transitions are not carried over. A PDF export from Google Slides is the most faithful input. The skill says so up front.

**Accidental writes to the source.** LibreOffice drops lock files beside any file it opens, and Google connectors can write. Mitigation: the converter only ever opens the copy, and the skill names the write-capable Google tools it must never call.

## Objective

Ship a `deck-to-video` OnCue skill that turns a .pptx, a Google Slides export or a PDF into an MP4 narrated slide by slide from an approved script, and leaves the original file byte-for-byte unchanged.

## Decisions

- The skill bypasses `short.json`, so no new spec field is added and `src/spec.ts` and `skills/storyboard/references/spec.md` do not change. Why: rebuilding arbitrary decks as nine scene kinds would re-theme the author's design.
- Pictures plus ffmpeg, no Playwright. Why: slides are static images, so a plain ffmpeg stitch is the smallest thing that works, and it keeps video possible wherever ffmpeg exists.
- Voiceover is generated as one continuous read and split by first word. Why: the existing voiceover skill chose this for a consistent voice and pace; per-slide clips are a fallback only.
- A mechanical approval gate: `narration --approved` exits non-zero until `narration.md` says `approved: true`. Why: a rule that lives only in prose gets skipped, and recording spends credits.
- Output keeps the deck's own aspect, scaled to fit 1920×1080 with even dimensions. Why: the lowest-risk default; letterboxing to portrait targets is a follow-up.
- The plan is red-green-verify with no SHIP phase. Why: it changes application code and the engine has a test runner (`node --test`); the requester did not ask to commit or open a pull request.
- The sequence is one chain (guard, notes, narration, assembly, skill, docs), so there are no lanes and `workflow: never`.
- `jszip` is declared as an explicit engine dependency. Why: it is installed today only through pptxgenjs, which can change under it.

## Files

- plugins/oncue/engine/src/slides.ts (new) — source guard, page rendering, slide order, hidden slides, notes and slide text
- plugins/oncue/engine/src/narration.ts (new) — read and write `narration.md`, approval flag, script and warnings
- plugins/oncue/engine/src/assemble.ts (new) — merge slide durations and silent dwells, encode the MP4 with ffmpeg
- plugins/oncue/engine/src/timeline.ts (modified) — accept any `{ lines: { vo }[] }`, add `buildSlideTimeline`
- plugins/oncue/engine/src/cli.ts (modified) — `import`, `narration` and `assemble` commands that run before `loadSpec`
- plugins/oncue/engine/package.json (modified) — declare `jszip`
- plugins/oncue/engine/package-lock.json (modified) — lockfile for `jszip`
- plugins/oncue/engine/dist/slides.js (generated) — compiled output, committed per the repo rule
- plugins/oncue/engine/dist/narration.js (generated) — compiled output
- plugins/oncue/engine/dist/assemble.js (generated) — compiled output
- plugins/oncue/engine/dist/timeline.js (generated) — compiled output
- plugins/oncue/engine/dist/cli.js (generated) — compiled output
- plugins/oncue/engine/test/helpers/make-deck.mjs (new) — builds a fixture .pptx
- plugins/oncue/engine/test/slides-source.test.mjs (new) — source-unchanged guard
- plugins/oncue/engine/test/slides-notes.test.mjs (new) — order, hidden slides, notes, text
- plugins/oncue/engine/test/narration.test.mjs (new) — file format, approval gate, warnings
- plugins/oncue/engine/test/slide-timeline.test.mjs (new) — slide timing and silent dwell
- plugins/oncue/engine/test/deck-to-video.test.mjs (new) — end-to-end objective test with the Gleaner audio
- plugins/oncue/engine/test/slides-render-smoke.test.mjs (new) — real `soffice` and `pdftoppm` run, skipped when absent
- plugins/oncue/skills/deck-to-video/SKILL.md (new) — the skill
- plugins/oncue/skills/voiceover/SKILL.md (modified) — step 1 accepts deck narration
- plugins/oncue/skills/setup/SKILL.md (modified) — check `soffice` and `pdftoppm`
- plugins/oncue/skills/explainer-video/SKILL.md (modified) — one line pointing to the deck route
- plugins/oncue/.claude-plugin/plugin.json (modified) — version 1.11.0
- README.md (modified) — skills list, usage, changelog 1.11.0

## Steps

### Phase: RED

1. Write the fixture builder `engine/test/helpers/make-deck.mjs` with pptxgenjs: four slides, notes on slides 1 and 4, none on 2, slide 3 hidden by setting `show="0"` on its `<p:sld>` through jszip. Why: every later test needs a deck whose notes, order and hidden slide are known. Verify: running it writes a .pptx whose zip lists `ppt/notesSlides/notesSlide1.xml` and whose `ppt/slides/slide3.xml` contains `show="0"`.
2. Add stub modules `src/slides.ts`, `src/narration.ts`, `src/assemble.ts` and the `buildSlideTimeline` signature in `src/timeline.ts`, each export throwing `not implemented`, then run `npm run build`. Why: a test that fails on a missing import has not run, so the RED failures must come from the stubs. Verify: `npx tsc -p . --noEmit` exits 0 and `dist/slides.js` exists.
3. Write `test/slides-source.test.mjs`: after `guardSource` runs a callback on a read-only fixture, assert the SHA-256 and modified time are equal; a callback that appends a byte makes `guardSource` throw; an output folder equal to the source's own folder is refused. Why: unchanged source is the requirement the whole feature is judged on, and the mutation case proves the detector can fail. Verify: `node --test test/slides-source.test.mjs` exits non-zero with the stub's `not implemented`.
4. Write `test/slides-notes.test.mjs`: from the fixture, `readDeck` returns visible slides in presentation order (1, 2, 4), skips the hidden slide, returns notes text for 1 and 4, none for 2, slide text for all three, and decodes entities such as `&amp;`. Why: notes and order are read straight from zip XML, where slide file numbers are not slide order. Verify: `node --test test/slides-notes.test.mjs` exits non-zero with `not implemented`.
5. Write `test/narration.test.mjs`: round-trip `narration.md` with a source marker per slide (`notes`, `drafted`, `none`); `narration --approved` exits non-zero until `approved: true`; an opening word repeated inside an earlier slide produces a warning naming both slides; blank slides are listed. Why: the approval gate must be mechanical and the boundary risk must surface before credits are spent. Verify: `node --test test/narration.test.mjs` exits non-zero with `not implemented`.
6. Write `test/slide-timeline.test.mjs`: `buildSlideTimeline` on the Gleaner `words.json` gives each slide the span from its first word to the next slide's first word, slide 1 starts at 0 and the last holds `TAIL`; `planSlides` inserts a 4-second silent dwell for a narration-free slide and the total grows by exactly 4. Why: this is where narration becomes video timing. Verify: `node --test test/slide-timeline.test.mjs` exits non-zero with `not implemented`.
7. Write the objective test `test/deck-to-video.test.mjs`: fixture notes taken from the Gleaner `vo` lines, one solid-colour PNG per slide made with sharp, the real `examples/gleaner/words.json` and `voiceover.mp3`, run `assemble`, then assert with ffprobe and an ffmpeg frame grab (details under Tests). Why: this is the first test to prove the feature, as one flow, against real audio. Verify: `node --test test/deck-to-video.test.mjs` exits non-zero with `not implemented`, and the output is pasted into the plan's evidence.

### Phase: GREEN

8. Widen `estimateWords`, `splitWarnings` and `lineStarts` in `src/timeline.ts` to take `{ lines: { vo: string }[] }`, then add `buildSlideTimeline` and `planSlides`. Why: reuses the proven split without a fake `Spec`, and short.json renders must not change. Verify: `node --test test/slide-timeline.test.mjs test/split.test.mjs` exits 0, so the existing portrait split tests still pass.
9. Implement `guardSource` and the output-folder check in `src/slides.ts`: hash with SHA-256 and read the modified time, copy the source to `<out>/work/`, run the callback on the copy only, hash again, write `source-manifest.json`, throw on any difference. Why: this is the unchanged-source mechanism. Verify: `node --test test/slides-source.test.mjs` exits 0.
10. Implement `readDeck` in `src/slides.ts` with jszip, dispatching on extension. For .pptx: slide order from `ppt/presentation.xml` and its rels, hidden slides from `show="0"`, notes from the body placeholder (`<p:ph type="body"`) of the linked notes slide, text from `<a:t>` runs. For .odp: read `content.xml` in document order, `draw:page` elements are the slides, hidden slides carry `presentation:visibility="hidden"` in `styles.xml`/`content.xml` page styles, notes come from each page's `presentation:notes` element, text from `text:p`. A PDF skips `readDeck`: it has no notes or hidden slides, so slide order is the page order and `slides.json` is built from the page count after rendering, with text left empty and the narration drafted from the page pictures. Why: notes and order cannot be taken from file names, and .odp stores them in different XML. Verify: `node --test test/slides-notes.test.mjs` exits 0, including the .odp cases.
11. Implement page rendering in `src/slides.ts`: `soffice --headless --convert-to pdf` on the copy (skipped for a PDF input), then `pdftoppm -r 150 -png` into `<out>/pages/slide-NN.png`, and fail naming the binary when either is missing. Why: this is the render route that `vertical-deck` already points to. Verify: `node --test test/slides-render-smoke.test.mjs` exits 0 where both tools exist, and reports the test skipped (not passed) where they do not.
12. Implement `src/narration.ts`: write `narration.md` with an `approved:` flag and a marker per slide, parse it back, print the script, run `splitWarnings`, print estimated seconds and the repo's reference credit rate labelled as a rough estimate. Why: the approval gate and the boundary warnings live here. Verify: `node --test test/narration.test.mjs` exits 0.
13. Implement `src/assemble.ts`: build per-slide durations from the timeline and dwell plan, cut the audio at silent-dwell boundaries with ffmpeg `atrim` and `anullsrc`, encode H.264 and AAC at 30 fps, scale pages to fit 1920×1080 with even dimensions, and write `preview-silent.mp4` when there is no audio. Why: this turns the timeline into the file the person asked for. Verify: `node --test test/deck-to-video.test.mjs` exits 0.
14. Add `import`, `narration` and `assemble` to `src/cli.ts` ahead of `loadSpec`, declare `jszip` in `package.json`, run `npm install` and `npm run build`. Why: the existing CLI loads a spec before its switch, so these commands must branch first. Verify: `node dist/cli.js import test/fixtures/none.pptx` prints the usage line for a missing file, `npm test` in the engine exits 0, and `git diff --stat` shows `dist/` updated. If a test still fails after 8 iterations, stop and report the failing assertion, the last diff tried and what was ruled out; do not report success.
15. Write `skills/deck-to-video/SKILL.md`: inputs and formats, the order import, draft, approve, voice, assemble, the unchanged-source rules, the Google write tools it must never call (`update_presentation`, `update_file`, `trash_file`, `share_file`), and the fidelity limits, using no host product names outside setup. Why: the skill prose is what the model follows at run time. Verify: `npm run validate` from the repo root exits 0 for the new skill.
16. Edit `skills/voiceover/SKILL.md` step 1 so a deck project takes its script from `node dist/cli.js narration <folder> --approved`, and `skills/setup/SKILL.md` to report `soffice` and `pdftoppm` as separate checks that block only rendering. Why: voiceover assumed `short.json`, and setup is the only place that may name install commands. Verify: `npm run validate` exits 0 and `grep -n "narration" plugins/oncue/skills/voiceover/SKILL.md` finds the new line.
17. Add the one-line deck route to `skills/explainer-video/SKILL.md`, bump `plugins/oncue/.claude-plugin/plugin.json` to 1.11.0, and add the `### 1.11.0` changelog entry and usage section to `README.md`. Why: the repo requires a bump and changelog for any change to what a skill or the engine does. Verify: `npm run validate` exits 0 and every command shown in the README section runs against the fixture.

### Phase: VERIFY

18. Run the full engine suite: `npm run engine:test`. Why: the change touches `timeline.ts`, which every video render uses. Verify: exits 0 with the number of skipped tests reported.
19. Run the type check and the repo validator: `npm run engine:typecheck` then `npm run validate`. Why: a green suite over code that does not type check is not verified. Verify: both exit 0.
20. Run the rendering smoke test after the person approves installing LibreOffice and poppler, or report rendering as unverified. Why: the render route is the only part not provable on this machine today. Verify: `node --test test/slides-render-smoke.test.mjs` shows pass, not skip, and the PNG for slide 1 is not blank (width and height from sharp match the slide aspect).
21. Run the example end to end from the engine folder: `npm run example:deck` and `npm run example:stills`, and compare the stills with the pre-change ones. Why: the repo's rule for engine changes is to look at the output, and `timeline.ts` changed. Verify: the stills match the earlier frames and the commands exit 0.

## Tests

Tier 1 — This plan creates and modifies application source files
- Objective: a .pptx plus approved narration becomes an MP4 whose slide changes land on the narrated words, and the .pptx is unchanged. File: plugins/oncue/engine/test/deck-to-video.test.mjs; Type: smoke; Asserts: ffprobe reports 1920×1080, H.264 video, AAC audio, and a duration within 0.1 s of the Gleaner audio plus 0.3 s lead and 1.6 s tail; a frame at the midpoint of each slide's narration is the colour of that slide; the source's SHA-256 and modified time are identical before and after; Run: cd plugins/oncue/engine && node --test test/deck-to-video.test.mjs
- Unit: the source guard refuses a mutation and an output folder equal to the source's. File: plugins/oncue/engine/test/slides-source.test.mjs; Targets: guardSource; Key cases: unchanged read-only file, appended byte throws, same-folder output refused, a PDF input
- Unit: deck reading. File: plugins/oncue/engine/test/slides-notes.test.mjs; Targets: readDeck; Key cases: presentation order differs from file numbers, hidden slide skipped, no-notes slide, `&amp;` decoded, body placeholder only, an .odp fixture gives the same order, hidden state and notes, a PDF input skips readDeck and orders slides by page
- Unit: narration file and gate. File: plugins/oncue/engine/test/narration.test.mjs; Targets: narration read, write, approval and warnings; Key cases: round trip, unapproved exits non-zero, repeated opening word warns, blank slides listed
- Unit: slide timing. File: plugins/oncue/engine/test/slide-timeline.test.mjs; Targets: buildSlideTimeline, planSlides; Key cases: slide spans, tail hold, silent dwell adds exactly the dwell, a slide whose first word is never heard is an error naming it, and an unplaceable slide with notes is flagged for a per-slide clip with its notes unchanged, including the case where the next slide's first word repeats a sentence start inside the previous slide
- Integration: real rendering. File: plugins/oncue/engine/test/slides-render-smoke.test.mjs; Targets: `soffice` and `pdftoppm` through the CLI `import` command; Key cases: .pptx and PDF inputs give one PNG per visible slide, page count matches slide count, skipped with a stated reason when a binary is missing

## Acceptance Criteria

- [ ] `node dist/cli.js import <deck.pptx> --out <folder>` writes `pages/slide-NN.png`, `slides.json` and `source-manifest.json`, and the manifest reports `unchanged: true`.
- [ ] The SHA-256 and modified time of the original .pptx, PDF or .odp are identical before and after `import`, `narration` and `assemble`, and the run exits non-zero if they ever differ.
- [ ] `import` refuses an output folder equal to the source's own folder.
- [ ] Hidden slides are skipped, and slide order follows the presentation, not the file numbers.
- [ ] A slide with speaker notes uses them verbatim, and a slide without notes gets a drafted line marked `drafted` in `narration.md`.
- [ ] `node dist/cli.js narration <folder> --approved` exits non-zero until `narration.md` contains `approved: true`.
- [ ] A narration line that opens with a word already heard earlier produces a warning that names both slides.
- [ ] With the Gleaner voiceover and words, `assemble` writes a 1920×1080 H.264 + AAC MP4 whose duration is within 0.1 s of the audio plus 0.3 s plus 1.6 s.
- [ ] A slide with no narration is held for the stated silent dwell and the total length grows by exactly that dwell.
- [ ] `npm run engine:test`, `npm run engine:typecheck` and `npm run validate` all exit 0, and the portrait example stills are unchanged.
- [ ] The skill never calls a Google write tool, and its prose says which tools those are.
- [ ] Rendering through `soffice` and `pdftoppm` is reported as verified or as unverified with the missing binary named, never silently assumed.

## Verification

From `plugins/oncue/engine`, run `npm run build`, then `node --test test/deck-to-video.test.mjs`. It exits 0 only if the MP4 has the expected size, codecs and duration, each slide's colour appears at the midpoint of its narration, and the fixture deck's SHA-256 and modified time are unchanged. Run `npm test`, `npm run typecheck` and, from the repo root, `npm run validate`; all must exit 0, with the count of skipped tests stated.

Then walk it as a person would, on a machine with LibreOffice and poppler: `node dist/cli.js import my-deck.pptx`, read `narration.md`, set `approved: true`, record the voiceover through the voiceover skill, run `node dist/cli.js assemble`, and open the MP4. Finish by running `shasum -a 256 my-deck.pptx` and comparing it with `source-manifest.json`. If those two tools are not installed, state that rendering and this last walk-through are unverified.

## Unresolved Questions

- Does a Google Slides export as .pptx keep speaker notes?
  ```text
  In /Users/shawns-work/repos/oncue, ask the person for one real .pptx downloaded from Google Slides that has speaker notes. Unzip a copy in a scratch folder (never the original) and check whether ppt/notesSlides/ exists and whether the notes text is in the body placeholder. Report yes or no, and if no, recommend how the deck-to-video skill should tell users to get notes in. Do not edit any file in the repo.
  ```
- Should the output be letterboxed for portrait targets such as Shorts?
  ```text
  In /Users/shawns-work/repos/oncue/plugins/oncue/engine/src/assemble.ts (once it exists), recommend whether assemble should accept a --format WxH option that letterboxes a 16:9 deck onto a 1080x1920 canvas, reusing the size rules in src/spec.ts (even sides, 320 to 4096, long side at most 2.4x short). Recommend one approach with reasoning and the smallest design that avoids blurry text. Do not write code.
  ```
- Can the Drive connector export a Google Slides file read-only?
  ```text
  Using the Google Drive connector tools available in the session, check without modifying anything whether download_file_content or read_file_content can export a Google Slides file as .pptx or .pdf. Report the tool, the arguments and any size limit. Never call update_file, trash_file or share_file, and never call update_presentation.
  ```

## Next Steps

- Add burned-in captions from the word timings
  Most Shorts are watched muted and the word timestamps already exist.
  ```text
  In /Users/shawns-work/repos/oncue, add an optional --captions flag to `node dist/cli.js assemble` that burns captions into the MP4 using words.json, reusing the timings in engine/src/timeline.ts. Add tests in engine/test, rebuild dist with npm run build, bump plugins/oncue/.claude-plugin/plugin.json by a minor version and add a README changelog entry. Verify by running npm run engine:test and npm run validate, and grab one frame with ffmpeg to confirm the caption text appears.
  ```
- Wish list: carry slide builds and transitions into the video
  Slide animations are dropped today; this is speculative.
  ```text
  In /Users/shawns-work/repos/oncue, write a short proposal in docs/proposals/ on whether slide builds and transitions from a .pptx could be reproduced in the assembled video, with the XML elements involved and a recommended cut line. Do not write engine code. Verify the proposal's claims against a real .pptx unzipped in a scratch folder.
  ```
