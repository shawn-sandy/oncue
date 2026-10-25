---
status: todo
type: feature
created: 2026-10-25
repo-name: oncue
artifact-url: https://claude.ai/artifact/KMdYVvUNd4bwUhcRzffVfv
glance: Today a voiceover only works end to end with ElevenLabs, and anyone without it hits a dead end in the voiceover skill. After this, a person can read the script themselves, get word timings from whisper.cpp (a free transcriber that runs on their own machine), and render the same word-synced video, while ElevenLabs stays the default. We know it worked when the Gleaner example renders from whisper.cpp timings and the measured cue drift against ElevenLabs Scribe is reported.
---

# Plan: Voice OnCue Shorts with your own recording, ElevenLabs still the default

## Objective

Add a second voiceover path to OnCue: the person records the script, whisper.cpp produces the word timings, and the engine renders from them. ElevenLabs stays the default and its steps stay unchanged.

## Context

This plan implements the converged proposal at `docs/prompts/proposal-support-other-voice-engines.md` (2026-10-25). The engine already renders any engine's output: any audio ffmpeg can read, plus word timings in seconds. ElevenLabs lives only in skill prose. That is 41 lines in 7 files, 21 of them hard instructions, and there is no engine logic for it.

Two gaps block every other voice engine today. First, `plugins/oncue/skills/voiceover/SKILL.md:14` sends a session without the ElevenLabs connector to "step 4", and step 4 only explains how to download ElevenLabs files. Second, `readWords` in `plugins/oncue/engine/src/timeline.ts:19-23` crashes on Whisper-style timing files, which name the field `word` instead of `text`. This was verified on 2026-10-25 with `Cannot read properties of undefined (reading 'toLowerCase')`. It also turns every scene time into NaN ("not a number") when a word has no `end`.

Risks and how this plan handles them. whisper.cpp's exact word-level JSON and its punctuation behaviour are unverified, so the spike lane runs it on the real example audio and records the shape before any code is written. Timing may be less precise than ElevenLabs Scribe, so the final step measures the drift instead of assuming it. ffmpeg and whisper.cpp are not installed on the author's Mac, and Claude cannot run `curl` in this environment, so installs and the model download are steps where the person runs a command Claude shows them.

## Decisions

- Approach is recipes plus a normalizer, chosen in the proposal over bring-your-own only, an engine `voice` command, and doing nothing — it closes the dead end with the least engine code.
- The first release has one recipe, the person's own recording; Kokoro, macOS `say` and OpenAI TTS are later recipe files — the person chose to start with the path that needs no account.
- Timing for all non-ElevenLabs audio comes from whisper.cpp — one free, offline path to test, and it works on any audio.
- Selection is "default plus name it": ElevenLabs when its connector is present, another path when the person names it, a question only when the connector is missing — no extra question on the default path.
- File names stay `voiceover.mp3` and `words.json` — they are hard-coded across three skills, the README, the engine scripts and the example, so recipes convert instead.
- No `short.json` field — per CLAUDE.md a field touches the spec types, the loader, both renderers and the docs, and no renderer would read it.
- The engine lane is red-green-verify with Node's built-in test runner (`node --test`, a `// @ts-check` `.mjs` file importing `dist/`) — the tests must fail before the fix, and this adds no dependency.
- Tests import the committed `dist/` — that is what ships, and `dist/timeline.js` and `dist/spec.js` need only Node built-ins, so CI can run them without `npm ci`.
- The whisper.cpp fixture is the full output for the Gleaner voiceover, not a trimmed one — the integration test needs every line to match the Gleaner `short.json`.
- The default model is `ggml-base.en.bin`, kept outside the repo — step 12 measures the drift it produces; a larger model is a later tuning choice (2026-10-25 interview).
- The timing recipe always converts audio to a 16 kHz mono WAV before `whisper-cli` — one path that works on any whisper.cpp build and any recording format, and ffmpeg is already required on this path (2026-10-25 interview).
- Cue warnings and drift are reported, not gated — there is no measured baseline yet to set a limit from; the numbers decide whether the WhisperX follow-up is needed (2026-10-25 interview).
- Engine tests run in CI through a root `engine:test` script — tests that never run in CI rot.

## Files

- plugins/oncue/engine/test/fixtures/gleaner-whisper-cpp.json (new) — whisper.cpp word-level output for `examples/gleaner/voiceover.mp3`
- plugins/oncue/engine/test/fixtures/README.md (new) — the exact command, whisper.cpp version, model, and observed shape behind the fixture
- plugins/oncue/engine/test/timeline.test.mjs (new) — `node:test` cases for every input shape `readWords` accepts
- plugins/oncue/engine/src/timeline.ts (modified) — `readWords` normalizer and its doc comment
- plugins/oncue/engine/dist/timeline.js (generated) — rebuilt from `src/` and committed
- plugins/oncue/engine/package.json (modified) — `test` script
- plugins/oncue/skills/voiceover/SKILL.md (modified) — description, selection rule, "Other engines" section
- plugins/oncue/skills/voiceover/references/own-recording.md (new) — record the script and convert it to `voiceover.mp3`
- plugins/oncue/skills/voiceover/references/whisper-timing.md (new) — the shared whisper.cpp timing step
- plugins/oncue/skills/setup/SKILL.md (modified) — "Voice engine" checks and report rows
- plugins/oncue/skills/explainer-video/SKILL.md (modified) — ElevenLabs-only lines made conditional
- README.md (modified) — requirements, "Other voice engines", skills table, how it works, 1.2.0 changelog
- plugins/oncue/.claude-plugin/plugin.json (modified) — version 1.2.0, description and keywords
- .claude-plugin/marketplace.json (modified) — description mentions the own-recording path
- package.json (modified) — root `engine:test` script
- .github/workflows/validate.yml (modified) — run the engine tests

## Steps

### Lane: spike (owns: plugins/oncue/engine/test/fixtures/**)

1. Get the tools in place: check `whisper-cli --help` and `ffprobe -version`; for anything missing, show the person `brew install ffmpeg whisper.cpp` and ask them to run it, then ask them to download `ggml-base.en.bin` from the whisper.cpp model page on Hugging Face into `~/.cache/whisper/`, naming the file, source and size before they do. Why: every later step needs these binaries, installs change the person's machine, and Claude cannot run `curl` here, so the person runs the commands. Verify: `whisper-cli --help` lists `-ml`, `-sow` and `-oj`; `ffprobe -version` prints a version line; `test -f ~/.cache/whisper/ggml-base.en.bin` exits 0.
2. Convert `plugins/oncue/engine/examples/gleaner/voiceover.mp3` to a 16 kHz mono WAV with ffmpeg in a temporary folder, run whisper.cpp on it with word-level output (`-m ~/.cache/whisper/ggml-base.en.bin -ml 1 -sow -oj -of plugins/oncue/engine/test/fixtures/gleaner-whisper-cpp`), and record in `plugins/oncue/engine/test/fixtures/README.md` the exact ffmpeg and whisper-cli commands, the whisper.cpp version, the model, the JSON path to the word entries and their time units, and whether punctuation stays attached to words. Why: the normalizer and the timing recipe both depend on this real shape, which the proposal could only source second-hand. Verify: `node -e` parses the fixture and prints its entry count (expect about 200, close to the 202 words in `examples/gleaner/words.json`) and its first five entries, and the README's command reproduces the same file when re-run.

### Lane: engine (owns: plugins/oncue/engine/src/**, plugins/oncue/engine/dist/**, plugins/oncue/engine/test/*.test.mjs, plugins/oncue/engine/package.json; after: spike)

### Phase: RED

3. Write `plugins/oncue/engine/test/timeline.test.mjs` (`// @ts-check`, `node:test` and `node:assert/strict`, importing `readWords` and `buildTimeline` from `../dist/timeline.js` and `loadSpec` from `../dist/spec.js`) with five cases: the Scribe file `examples/gleaner/words.json` still yields 202 words starting with `Ever` at 0.12 to 0.28; a `word`-field file yields trimmed `text`; a word missing `end` gets the next word's `start` and the last word gets its own `start`; an entry with neither `text` nor `word` throws an error naming its index; and `buildTimeline` on the Gleaner spec with the whisper.cpp fixture returns 9 scenes whose `start`, `end` and every cue are finite. Write temporary files with `fs.mkdtempSync` in `os.tmpdir()` and remove them in an `after` hook. Add `"test": "node --test test/*.test.mjs"` to `plugins/oncue/engine/package.json`. Why: these cases are the contract the normalizer must meet, and the Scribe case guards the default path from regressing. Verify: `cd plugins/oncue/engine && npm test` exits non-zero with the Scribe case passing and the other four failing for the right reasons — `undefined` where `Ever` was expected, `undefined` where an `end` was expected, a missing expected throw, and `Line 1 ... not found in the transcript` for the fixture — paste the output.

### Phase: GREEN

4. Extend `readWords` in `plugins/oncue/engine/src/timeline.ts`: keep the `{ words }` and bare-array inputs, add the whisper.cpp shape recorded in the fixture README (times converted to seconds), map a `word` field to trimmed `text`, drop entries whose text is empty after trimming, fill a missing or non-finite `end` from the next word's `start` (the last word uses its own `start`), throw a clear error naming the index and expected fields when an entry has no text, and rewrite the doc comment at line 18 to list the accepted shapes; then run `npm run build`. Why: `end` feeds scene starts (line 62), line ends (64), even spacing (76) and scene ends (80), and `text` feeds line matching (49, 51) and cue matching (70), so these are the only fields a new source must supply. Verify: `npm run build && npm test` exits 0 after each edit; if the tests still fail after 8 iterations, stop and report the failing assertion, the last diff tried and what was ruled out — do not report success.

### Phase: VERIFY

5. Run the engine checks on the lane branch: `npm run engine:typecheck` from the repo root, `npm test` and `npm run example:check` in `plugins/oncue/engine`, and `git diff --stat` to confirm `dist/timeline.js` changed alongside `src/timeline.ts`. Why: a green test run over code that does not typecheck, or a `src/` change without its committed `dist/`, would ship broken. Verify: all three commands exit 0, `example:check` ends with `OK.`, and the diff lists both timeline files.

### Lane: skills (owns: plugins/oncue/skills/**; after: spike)

6. Update `plugins/oncue/skills/voiceover/SKILL.md`: add the own-recording path to the single-line frontmatter `description` (at most 1024 characters, no angle brackets); replace the dead-end bullet at line 14 with the selection rule (ElevenLabs when its `creative_*` tools are present and no other engine is named; the named path otherwise; ask only when the connector is missing); and add an "Other engines" section with the situation-to-path table that routes to `references/own-recording.md` and treats audio from any engine without a recipe as a recording, with both paths ending at step 5. Leave steps 1 to 4 unchanged. Why: this removes the dead end without touching the default flow people already use. Verify: `npm run validate` exits 0, and `git diff main -- plugins/oncue/skills/voiceover/SKILL.md` touches only the frontmatter, the "Before you start" list and the new section.
7. Write `plugins/oncue/skills/voiceover/references/own-recording.md` (print the script with `node dist/cli.js script`, read it verbatim in one continuous take because each line is matched by its first word, convert the take to `voiceover.mp3` with ffmpeg, then follow the timing step) and `plugins/oncue/skills/voiceover/references/whisper-timing.md` (check `whisper-cli` and the model, ask before any install or download, always convert the audio to a 16 kHz mono WAV with ffmpeg first, run the exact commands from `plugins/oncue/engine/test/fixtures/README.md` with `-of <folder>/words` so it writes `words.json`, and note that the engine reads whisper.cpp JSON directly). Why: one recipe for getting the audio and one shared timing step means each later engine needs only its own audio recipe. Verify: `npm run validate` exits 0 (it checks every relative link in `references/`), and `grep -F` finds the fixture README's command in `whisper-timing.md`.
8. Update `plugins/oncue/skills/setup/SKILL.md` section 5 into "Voice engine": keep the ElevenLabs check as the default; add checks for the own-recording path (`whisper-cli --help` and the model file, with ffmpeg already covered in section 2), asking before `brew install whisper.cpp`; change the report table rows at lines 83 and 90 to "ElevenLabs (default), or your own recording timed with whisper.cpp"; and keep the rule at line 8 that setup never spends ElevenLabs credits. Why: setup is where a person learns which outputs work, so it has to recognise the second path. Verify: `npm run validate` exits 0, and `grep -n whisper plugins/oncue/skills/setup/SKILL.md` shows the check and both table rows.
9. Make the ElevenLabs-only lines in `plugins/oncue/skills/explainer-video/SKILL.md` conditional on that path: the voice pick and two takes (line 35), the credits in the delivery summary (38), and the `storage.googleapis.com` note (42). Why: the end-to-end skill would otherwise ask an own-recording user about takes and credits that do not exist. Verify: `npm run validate` exits 0, and `grep -n ElevenLabs plugins/oncue/skills/explainer-video/SKILL.md` shows each of those lines qualified with the ElevenLabs path.

### Lane: lead (after: spike, engine, skills)

10. Update `README.md`: the requirements row at line 18 and its link; replace "Without ElevenLabs" (lines 93-101) with an "Other voice engines" section covering the own-recording path, whisper.cpp timing and the `words.json` shapes the engine now accepts; add whisper.cpp to the setup list; update the skills table row (line 114) and "How it works" (line 121); and add a `### 1.2.0 (YYYY-MM-DD)` changelog entry at the top of `## Changelog`. Why: the README is how people find the second path, and its `#without-elevenlabs` anchor is not checked by `validate.mjs`, so a rename must update the link by hand. Verify: `npm run validate` exits 0, `grep -c '#other-voice-engines' README.md` is at least 1, and `grep -n 'without-elevenlabs' README.md` returns nothing.
11. Bump `plugins/oncue/.claude-plugin/plugin.json` to `1.2.0` and add the own-recording path to its description and keywords, update the plugin description in `.claude-plugin/marketplace.json` (no version field there), add `"engine:test": "cd plugins/oncue/engine && npm test"` to the root `package.json`, and add `- run: npm run engine:test` after the typecheck step in `.github/workflows/validate.yml`. Why: CLAUDE.md requires a version bump when a skill or the engine changes behaviour, and the new tests must run on every pull request. Verify: `npm run validate` exits 0, `npm run engine:test` exits 0 from the repo root, and `node -p "require('./plugins/oncue/.claude-plugin/plugin.json').version"` prints `1.2.0`.
12. Run the own-recording path end to end in `plugins/oncue/engine`: follow `references/whisper-timing.md` on `examples/gleaner/voiceover.mp3` into a temporary folder, render `node dist/cli.js stills examples/gleaner/short.json --words <tmp>/words.json --audio examples/gleaner/voiceover.mp3` (install Playwright with `npm install --no-save --save-dev playwright && npx playwright install chromium` if missing), compare every scene start and cue time against the timeline built from `examples/gleaner/words.json` and report the median and maximum difference in seconds plus the count and text of any `warning: ... cue word ... not heard` lines, then run `npm run example:deck` and `npm run example:stills` and open one still from each run. Why: per-step checks prove the parts; this proves a person without ElevenLabs gets a correctly timed video, and gives the measured drift the proposal asked for instead of an estimate. Verify: both stills runs exit 0 with one frame per scene, the frames show styled cards rather than blank frames, and the drift numbers come from the actual run.

## Tests

Tier 1 — This plan changes application code
- Objective: a recording timed with whisper.cpp drives the timeline. File: plugins/oncue/engine/test/timeline.test.mjs; Type: smoke; Asserts: `buildTimeline` on the Gleaner `short.json` with the whisper.cpp fixture returns 9 scenes whose start, end and cue times are all finite; Run: cd plugins/oncue/engine && npm test
- Unit: `readWords` input shapes. File: plugins/oncue/engine/test/timeline.test.mjs; Targets: readWords in src/timeline.ts (compiled dist/timeline.js); Key cases: Scribe file unchanged (202 words, first word `Ever` 0.12-0.28), `word` field mapped to trimmed `text`, missing `end` filled from the next start and the last word's own start, entry with no text throws naming its index
- Integration: CI runs the suite. File: .github/workflows/validate.yml; Targets: root `engine:test` script; Key cases: the workflow runs `npm run engine:test` after the typecheck and fails the job when a test fails

## Acceptance Criteria

- [ ] `cd plugins/oncue/engine && npm test` exits 0, with cases for the Scribe file, the `word` field, a missing `end`, a missing text, and the whisper.cpp fixture.
- [ ] `node dist/cli.js stills examples/gleaner/short.json --words <whisper words.json> --audio examples/gleaner/voiceover.mp3` writes one still per scene with no error.
- [ ] `npm run example:stills`, which uses the ElevenLabs Scribe `words.json`, still exits 0.
- [ ] In `plugins/oncue/skills/voiceover/SKILL.md`, a session without the ElevenLabs connector is routed to `references/own-recording.md`, and steps 1 to 4 are byte-identical to `main`.
- [ ] `npm run validate` and `npm run engine:typecheck` exit 0, and `.github/workflows/validate.yml` runs `npm run engine:test`.
- [ ] `plugin.json` reads `1.2.0`, and the README changelog's first entry is `### 1.2.0`.
- [ ] The completion report states the measured median and maximum cue-time difference, in seconds, between whisper.cpp and Scribe timings for the Gleaner example, and lists every cue warning the whisper.cpp run produced (or says there were none).

## Verification

Walk the path a person without ElevenLabs would take. In `plugins/oncue/engine`, run the command from `plugins/oncue/skills/voiceover/references/whisper-timing.md` on `examples/gleaner/voiceover.mp3`, writing `words.json` to a temporary folder. Then run `node dist/cli.js stills examples/gleaner/short.json --words <tmp>/words.json --audio examples/gleaner/voiceover.mp3`. It must exit 0 and write one frame per scene to `examples/gleaner/build/stills/`. Open the frames: each shows a styled card on a dark ground, not a blank frame. Then confirm the default did not move: `npm run example:stills` exits 0 with the Scribe timings, and `cd plugins/oncue/engine && npm test` exits 0. Report the median and maximum difference between the two timelines' scene and cue times as measured, not estimated, and list any cue warnings the whisper.cpp run printed; neither is a pass/fail gate this release. Finally, `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` all exit 0 from the repo root.

## Next Steps

- Add a Kokoro recipe for a free local AI voice
  Kokoro-FastAPI serves an open-weights voice from Docker on port 8880.
  ```text
  In the oncue repo (shawn-sandy/oncue), add plugins/oncue/skills/voiceover/references/kokoro.md: start Kokoro-FastAPI with the CPU image ghcr.io/remsky/kokoro-fastapi-cpu, generate voiceover.mp3 from `node dist/cli.js script <folder>/short.json` through its OpenAI-compatible /v1/audio/speech endpoint, then follow references/whisper-timing.md for words.json. Add a row for it to the "Other engines" table in plugins/oncue/skills/voiceover/SKILL.md, bump plugins/oncue/.claude-plugin/plugin.json by a minor version, and add a README changelog entry. Verify: npm run validate exits 0, and `node dist/cli.js stills` on a Kokoro-voiced short writes one still per scene.
  ```
- Add a macOS `say` recipe for draft reads
  Built in and free, useful for checking pacing before a real recording.
  ```text
  In the oncue repo (shawn-sandy/oncue), add plugins/oncue/skills/voiceover/references/macos-say.md: write the script to a file, render it with `say -f script.txt -o take.aiff`, convert it to voiceover.mp3 with ffmpeg, then follow references/whisper-timing.md. Mark it as a draft voice and macOS only. Add it to the "Other engines" table in plugins/oncue/skills/voiceover/SKILL.md, bump the plugin minor version in plugins/oncue/.claude-plugin/plugin.json, and add a README changelog entry. Verify: npm run validate exits 0, and stills render from the say-voiced Gleaner script.
  ```
- Swap the timing step to WhisperX if the measured drift is too large
  Only worth doing if step 12's numbers show cues landing visibly off.
  ```text
  In the oncue repo (shawn-sandy/oncue), the docs/plans/support-other-voice-engines.md completion report records the whisper.cpp drift against Scribe. If cues land visibly off, rewrite plugins/oncue/skills/voiceover/references/whisper-timing.md to use WhisperX forced alignment against the known script, and teach readWords in plugins/oncue/engine/src/timeline.ts its output shape, with a node:test case in plugins/oncue/engine/test/timeline.test.mjs that fails first. Rebuild and commit dist/. Verify: cd plugins/oncue/engine && npm test exits 0, and re-measured drift is lower than the recorded whisper.cpp numbers.
  ```
- Check the ElevenLabs tool names in the voiceover skill against the full connector
  Found while planning; out of scope here.
  ```text
  In the oncue repo (shawn-sandy/oncue), plugins/oncue/skills/voiceover/SKILL.md line 47 names creative_create_asset_upload and creative_finalize_asset_upload, and line 30 polls creative_get_flow_run_status. Connect the full ElevenLabs connector (https://api.elevenlabs.io/v1/mcp), list its tools without calling any generation or transcription tool, and update the skill to the names and polling behaviour it actually has. Verify: every creative_* name in the skill appears in the connector's tool list, and npm run validate exits 0.
  ```

## Resources

- docs/prompts/proposal-support-other-voice-engines.md — the converged proposal this plan implements, with the side-by-side and locked decisions
- https://github.com/ggml-org/whisper.cpp/tree/master/examples/cli — whisper.cpp CLI flags (`-ml`, `-sow`, `-oj`, `-ojf`) and the `whisper-cli` binary name
- https://github.com/remsky/Kokoro-FastAPI — Kokoro-FastAPI endpoints, CPU image and license, for the Kokoro follow-up
- https://pypi.org/project/whisperx — WhisperX forced alignment, for the drift follow-up
