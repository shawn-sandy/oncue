---
status: proposal
type: feature
created: 2026-10-25
repo-name: oncue
---

# Proposal: Support voice engines other than ElevenLabs, with ElevenLabs as the default

> **Deprecated.** The authoritative artifact is the saved prompt at
> `docs/prompts/proposal-support-other-voice-engines.md`. This copy is written for one deprecation
> release (plan-agent 6.0.0) and is removed in 6.1.0. Edit the prompt, not this
> file.

> This is a proposal for review, not an execution plan. It is grounded in a read of every skill, the engine timing code, the validation script, and the docs of ElevenLabs, whisper.cpp, Kokoro-FastAPI and Amazon Polly. The load-bearing decisions are resolved (see Locked & resolved decisions); execution is handed off (see Next step).

## TL;DR

- The engine already renders any voice engine's output: any audio ffmpeg can read, plus word timings in seconds. ElevenLabs lives only in skill prose (41 lines in 7 files, 21 of them hard instructions) and has zero engine logic.
- The real gap is timing. Without ElevenLabs the voiceover skill dead-ends (`skills/voiceover/SKILL.md:14` points to a step 4 that only covers ElevenLabs downloads), and Whisper-style timing files crash `readWords`.
- Proposal: keep ElevenLabs as the default section of the voiceover skill; add an "Other engines" route with one recipe (own recording) and one shared timing step (whisper.cpp, free and offline); teach `readWords` the shapes that step produces. Ship as 1.2.0.

## Context

OnCue makes word-synced explainer Shorts. The voiceover stage must leave two files beside `short.json`: `voiceover.mp3` and `words.json` (every word with start and end seconds). The engine uses the words to place each scene and animation on its cue word.

What exists today:

- `plugins/oncue/skills/voiceover/SKILL.md` drives the ElevenLabs connector end to end: `creative_create_flow`, `creative_list_voices`, `creative_generate_speech` (`eleven_v4`, two takes), `creative_transcribe_audio` (`eleven_scribe_v1`), then downloads both files. About 1,100 credits per take and about 600 per transcription.
- `plugins/oncue/skills/setup/SKILL.md` section 5 checks for the connector. Its report table offers "the person's own MP3 and words.json" as the only alternative (:75, :90).
- `README.md` "Without ElevenLabs" (:93-97) tells people to bring a `words.json` from "any word-level transcriber".
- The engine reads timings in `readWords` (`engine/src/timeline.ts:19-23`): `{ "words": [...] }` or a bare array of `{ text, type?, start, end }`. `cli.ts` takes `--words` and `--audio` together and reads duration with ffprobe; `capture.ts` muxes any ffmpeg-readable audio. There are no extension checks.

Why it is on the table: the person wants OnCue to work with a voice engine other than ElevenLabs while ElevenLabs stays the default.

## Core finding

> The engine is already engine-agnostic (any ffmpeg-readable audio plus word timings in seconds), so supporting another voice engine is a skill-prose change plus a small timing normalizer; the only missing piece is a documented, working way to produce `words.json` without ElevenLabs.

## Side-by-side

| Dimension | Recipes + normalizer (chosen) | Bring-your-own only | Engine `voice` command | Keep the current approach |
|---|---|---|---|---|
| What changes | Voiceover skill gains an "Other engines" route and `references/` recipes; `readWords` accepts recipe output shapes | Docs plus the `readWords` normalizer; no recipes | New TS adapters behind `node dist/cli.js voice --engine ...` | Nothing |
| ElevenLabs default | Unchanged section | Unchanged | Stays in prose; a second code path lives in the engine | Unchanged |
| Engine code | Small: `readWords` only | Small: `readWords` only | Large: network calls, API keys, per-provider adapters | None |
| Adding an engine later | One `references/*.md` file ending at the shared timing step | The person works it out | One adapter, rebuild, commit `dist/` | Not supported |
| Fixes the dead end at voiceover:14 | Yes | Yes | Yes | No |
| Fixes the Whisper-shape crash | Yes | Yes | Yes | No |
| Testability | Normalizer unit-tested; each recipe hand-tested once | Normalizer unit-tested | Adapters unit-testable | n/a |
| Main cost | Each recipe needs one hand test | Users must find and run their own engine | The offline engine becomes networked; two code paths | Dead end and crash remain |

## Locked & resolved decisions

1. **Approach: recipes + normalizer.** Chosen in the 2026-10-25 review over bring-your-own only, an engine `voice` command, and keeping the current approach, because it closes the dead end with the least engine code and gives every future engine a one-file path.

Settled before this draft (from the codebase and repo rules):

2. **ElevenLabs stays the default and its flow is not rewritten.** Steps 1-5 of the voiceover skill keep their current instructions; only the dead-end bullet at :14 changes. Incidental findings about its tool names are recorded in Appendix D and are out of scope.
3. **File names stay `voiceover.mp3` and `words.json`.** `voiceover.mp3` is hard-coded in the voiceover, animate-short and explainer-video skills, the README, the engine `package.json` scripts, and the example asset. Recipes convert to MP3 with ffmpeg instead of renaming across those files. ffmpeg is already required for the final video.
4. **No `short.json` field.** Per CLAUDE.md a new field touches `spec.ts`, `loadSpec`, both renderers, `cues.ts` and `spec.md`; no renderer would use a voice engine value.
5. **Version 1.2.0.** CLAUDE.md: bump `plugins/oncue/.claude-plugin/plugin.json` for changes to what a skill or the engine does. The changelog is the last section of `README.md`, entries headed `### X.Y.Z (YYYY-MM-DD)`.

Resolved in the 2026-10-25 review:

6. **First-release recipe: own recording only.** The person records the script themselves. Kokoro (local), macOS `say` and OpenAI TTS are deferred; each becomes one later recipe file ending at the shared timing step. Propagates to Workstream B (one recipe file) and the Roadmap (no Kokoro phase).
7. **Timing for all non-ElevenLabs audio: whisper.cpp.** One free, offline path (Homebrew formula `whisper.cpp`, formerly `whisper-cpp`; binary `whisper-cli` per the whisper.cpp CLI README, confirmed in phase 1) for every non-ElevenLabs source. Propagates to Workstream B (shared timing reference), Workstream C (setup checks), and the normalizer shapes in Workstream A.
8. **Selection: default + name it.** ElevenLabs when its connector is in the session; the person can name another engine in the request or skill argument; Claude asks only when the connector is missing. Propagates to Workstream B ("Before you start") and Workstream D (explainer-video conditional lines).
9. **Normalizer accepts recipe shapes.** `readWords` accepts (a) a `word` field in place of `text`, (b) whisper.cpp JSON output, and (c) a missing `end`, filled from the next word's start. Propagates to Workstream A and Appendix B.

## Workstreams

### A — Engine: timing normalizer (`engine/src/timeline.ts`)

- Extend `readWords` (:19-23) to return `Word[]` from: the current Scribe shape (unchanged), any list using `word` instead of `text`, and whisper.cpp JSON (Appendix B).
- Fill a missing or non-finite `end` from the next word's `start`; the last word falls back to its own `start`. `end` is load-bearing: scene starts (:62), line ends (:64), even spacing (:76) and scene ends (:80) all read it, and a missing value turns every scene time into NaN.
- Replace the TypeError on a missing `text` (`norm(...)` at :49 calls `.toLowerCase()`) with a clear error naming the word index and the expected fields.
- Update the doc comment at :18, which names only ElevenLabs Scribe.
- One regression test per accepted shape, written first and seen failing. The engine has no test runner today; the runner is the plan's choice (Node's built-in `node:test` adds no dependency; CLAUDE.md requires TypeScript or `// @ts-check` JSDoc).
- `npm run build` and commit `dist/` with `src/` (CLAUDE.md).

### B — Voiceover skill: selection rule, recipe, shared timing step

- `skills/voiceover/SKILL.md`:
  - Frontmatter `description` mentions the other path. `scripts/validate.mjs` requires a single line, at most 1024 characters, no angle brackets.
  - "Before you start": replace the dead-end bullet (:14) with the selection rule (decision 8).
  - New "Other engines" section: route to `references/own-recording.md`. Audio from any engine without a recipe is treated as a recording. Both paths finish at step 5 ("Check the timing"), which is shared.
- New `skills/voiceover/references/own-recording.md`: print the script (`node dist/cli.js script`), read it verbatim in one continuous take (the timeline matches each line's first word), convert the take to `voiceover.mp3` with ffmpeg, then run the timing step.
- New `skills/voiceover/references/whisper-timing.md`: check for `whisper-cli`; get a model (ask before downloading, naming the file and source, and show its size at download); convert the audio to the input whisper-cli needs; run it with word-level output; write `words.json`. Exact flags and JSON shape are fixed in Roadmap phase 1.
- `validate.mjs` checks every relative link in these files (`](path)` and backticked `./` or `../` paths must exist).

### C — Setup skill (`skills/setup/SKILL.md`)

- Section 5 becomes "Voice engine": keep the ElevenLabs check as the default; add checks for the own-recording path: ffmpeg (already in section 2), `whisper-cli` present, a model file present. Ask before `brew install whisper.cpp`.
- Report tables (:83, :90): the voiceover row reads "ElevenLabs (default), or your own recording timed with whisper.cpp".
- Keep the rule that setup never spends ElevenLabs credits (:8).

### D — Handoffs and docs

- `skills/explainer-video/SKILL.md`: make the ElevenLabs-only lines conditional on that path: voice pick and two takes (:35), credits (:38), `storage.googleapis.com` (:42).
- `README.md`: requirements row (:18); replace "Without ElevenLabs" (:93-97) with an "Other voice engines" section and update the `#without-elevenlabs` link at :18 (anchors are not validated, so a rename breaks silently); skills table row (:114); "How it works" (:121); a 1.2.0 changelog entry.
- `plugins/oncue/.claude-plugin/plugin.json`: version 1.2.0; description and keywords may add the own-recording path while keeping ElevenLabs. `.claude-plugin/marketplace.json` description likewise (it has no version field).

## Risks & tensions

- **whisper.cpp output shape and punctuation are unverified.** The flags exist (`-ml`, `-sow`, `-oj`, `-ojf` in the whisper.cpp CLI README), but the exact word-level JSON and whether punctuation stays attached to words come from secondary sources. Mitigation: phase 1 runs it on `examples/gleaner/voiceover.mp3` and commits a trimmed fixture before any code. The timeline's fallback (:51) still matches a line's first word when punctuation is missing.
- **Timing accuracy may be lower than Scribe.** WhisperX's docs say plain Whisper timestamps can be off, which is why WhisperX adds forced alignment. Mitigation: phase 6 compares whisper.cpp timings with the committed Scribe `words.json` for the same audio. If cues drift visibly, a later phase can swap the shared timing step to WhisperX without touching recipes.
- **Ad-libs break line matching.** A recording that changes a line's first word stops `buildTimeline` with "Line N not found". The existing error already names the line, and the recipe tells the reader to read verbatim.
- **Input format.** Whether whisper-cli reads MP3 directly is unverified; the timing step converts to WAV with ffmpeg first, which works either way.
- **Local-only path.** whisper.cpp and its model need a local machine with Homebrew or a source build; claude.ai sandboxes likely cannot run it. ElevenLabs remains the path there.
- **Model download.** The model is a large file from outside the plugin. The recipe asks before downloading it, naming file, source and size.
- **ffmpeg moves earlier.** The own-recording path needs ffmpeg at the voiceover stage, not just at render time. It is missing on the author's Mac today; setup already reports it.
- **The default must not regress.** Mitigation: ElevenLabs steps stay unchanged, and `npm run example:stills` (Scribe-shaped `words.json`) must still pass after the normalizer change.

## Roadmap

| Phase | Work | Size | Depends on |
|---|---|---|---|
| 1 | Verify whisper.cpp: install, get a model, run on `examples/gleaner/voiceover.mp3`; record the exact command, JSON shape, punctuation behaviour and input-format needs; commit a trimmed fixture | S | — |
| 2 | Workstream A: normalizer, one test per shape (failing first), rebuild and commit `dist/` | S | 1 |
| 3 | Workstream B: voiceover selection rule, "Other engines", `own-recording.md`, `whisper-timing.md` | M | 1 |
| 4 | Workstream C, plus the explainer-video lines from Workstream D | S | 3 |
| 5 | Workstream D docs: README sections, link fix, plugin.json 1.2.0, changelog, descriptions | S | 3, 4 |
| 6 | End to end: whisper.cpp timings for the example audio, then `stills --words --audio`; compare cue times with the Scribe `words.json`; run `npm run validate`, `npm run engine:typecheck`, `npm run example:deck`, `npm run example:stills` | S | 2, 3 |

Later, not in this release: one recipe file each for Kokoro (Kokoro-FastAPI), macOS `say` and OpenAI TTS; optional WhisperX timing.

## Appendices

### Appendix A — Voice path selection

| Situation | Path |
|---|---|
| ElevenLabs connector in session, no engine named | ElevenLabs (default): voiceover steps 1-5 as today |
| Person names ElevenLabs | ElevenLabs |
| Person names their own recording, or attaches audio | `references/own-recording.md`, then `references/whisper-timing.md`, then step 5 |
| Person names an engine with no recipe (for example Kokoro) | They generate the audio; treat it as a recording: `whisper-timing.md`, then step 5 |
| Connector missing, no engine named | Ask: connect ElevenLabs (setup's instructions) or use their own recording |

### Appendix B — Normalizer I/O contract (`readWords`)

Output per word, as `buildTimeline` reads it: `text` string (punctuation attached when available), `start` and `end` finite numbers in seconds, `type` absent or `"word"`.

| Input shape | Example | Mapping |
|---|---|---|
| ElevenLabs Scribe (today) | `{ "words": [ { "text": "Ever", "type": "word", "start": 0.12, "end": 0.28 } ] }` | Unchanged; non-`word` types dropped |
| Bare array (today) | `[ { "text": "Ever", "start": 0.12, "end": 0.28 } ]` | Unchanged |
| `word` field (Whisper API, faster-whisper, WhisperX, Deepgram) | `{ "words": [ { "word": " Ever", "start": 0.12, "end": 0.28 } ] }` | `text` = trimmed `word` |
| whisper.cpp JSON | Shape fixed in phase 1 from a real run | Per-word entries mapped to `text`, with `start` and `end` converted to seconds |
| Missing `end` | `{ "text": "Ever", "start": 0.12 }` | `end` = next word's `start`; last word `end` = its `start` |

Verified on 2026-10-25: the `word` shape fails today with `Cannot read properties of undefined (reading 'toLowerCase')`, run against the Gleaner example through `dist/timeline.js`.

### Appendix C — Change inventory (hard ElevenLabs instructions)

From a 2026-10-25 scan: 41 matching lines in 7 files (21 hard instructions, 15 descriptions, 5 fallbacks).

| File | Hard-instruction lines | This proposal |
|---|---|---|
| `skills/voiceover/SKILL.md` | :14, :15, :27-30, :34, :36, :47 | Keep all as the default path; replace only :14 |
| `skills/setup/SKILL.md` | :8, :67, :69, :73, :77, :83 | Keep; add own-recording checks to section 5 and the tables |
| `skills/explainer-video/SKILL.md` | :38, :42 (and :35 by assumption) | Make conditional on the ElevenLabs path |
| `README.md` | :26, :29, :32, :33 | Keep under the default path; add "Other voice engines" |
| `engine/src/timeline.ts` | None (comment at :18) | Update the comment; extend `readWords` |

### Appendix D — Incidental findings (out of scope)

- voiceover:47 names `creative_create_asset_upload` and `creative_finalize_asset_upload`, and :30 polls `creative_get_flow_run_status`. The restricted ElevenLabs connector seen in this session exposes `creative_upload_flow_reference` and `creative_attach_reference_file` and says not to poll. Not checked against the full connector the skill targets.
- `engine/package.json` says 1.0.0 while the plugin is 1.1.0; CLAUDE.md says the version lives only in `plugin.json`.
- An audio file where ffprobe reports no duration yields `Number("N/A")`, which is NaN, in `cli.ts:34-35`.
- README anchor links such as `#without-elevenlabs` are not checked by `validate.mjs`.

Sources: ElevenLabs "Create speech with timing" (elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps); whisper.cpp CLI README (github.com/ggml-org/whisper.cpp, examples/cli); Kokoro-FastAPI README (github.com/remsky/Kokoro-FastAPI); Amazon Polly speech marks (docs.aws.amazon.com/polly/latest/dg/output.html); WhisperX (pypi.org/project/whisperx).

## Next step

Author an execution plan that delivers Workstreams A through D in roadmap order, starting with the phase 1 whisper.cpp verification, because the normalizer and the timing recipe both depend on the shape it records. Draft real, actionable steps that name the files each one touches; do not restate the headings above as steps. Treat the locked decisions as settled inputs. Finish with the phase 6 checks, and report the measured difference between whisper.cpp and Scribe cue times rather than an estimate.


Convert to an execution plan:
`/plan-agent:implementation-plan Support voice engines other than ElevenLabs with ElevenLabs as the default --from-prompt docs/prompts/proposal-support-other-voice-engines.md`
