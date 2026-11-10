---
status: proposal
type: feature
created: 2026-11-09
repo-name: oncue
---

# Proposal: Add background music to Shorts and videos, starting with a file you bring

> This is a proposal for review, not an execution plan. It is grounded in a read of `engine/src/capture.ts`, `cli.ts` and `timeline.ts`, the `animate-short` and `voiceover` skills, and the vendor pages listed in Appendix B. The load-bearing decisions are resolved (see Locked & resolved decisions); execution is handed off (see Next step).

## TL;DR

- The engine mixes exactly one sound, the voiceover (`capture.ts:49-54`). There is no music input, flag or spec field anywhere.
- Adding music is a small engine change: a second audio input, ducked (made quieter) while the narrator speaks, looped to the video length, faded in and out. Where the music file comes from is the larger question, and the free libraries mostly have no API.
- Proposal: add a `--music <file>` option to the `video` command and teach the `animate-short` skill to ask for a track and its license. Ship that first. Generating a track per video (ElevenLabs or Stable Audio) is a later, separate skill that reuses the same mix.

## Context

OnCue turns one `short.json` into a storyboard, a voiceover, a deck and an MP4. The engine draws frames in headless Chromium and ffmpeg encodes them.

What exists today that this touches:

- `renderVideo` (`capture.ts:46-58`) takes one `audio` path. With audio it runs `adelay` (shifts the voice later by `tl.lead` seconds) and `apad` (pads silence) and encodes AAC at 192k. Without audio it uses `anullsrc`, a silent fake track, which is how the silent preview works.
- The timeline adds `LEAD = 0.3` s before the first word and `TAIL = 1.6` s after the last (`timeline.ts:13-14`), so the video is `audioSeconds + 1.9` s long. Music has to cover that whole length, including the tail.
- `cli.ts` parses `--words`, `--audio`, `--out` and `--at`. `--words` and `--audio` must come together (`cli.ts:41`).
- `short.json` is the contract between skills and engine. A new field needs the type, `loadSpec` validation, both renderers, a cue slot if it animates, and a row in `spec.md` (CLAUDE.md). Music changes no scene, so it does not need a field.
- ffmpeg is already required for the final video, so a mix adds no new tool.

Why it is on the table: videos with only a voice read as flat, and the person wants background music for Shorts and longer videos.

## Core finding

> The engine already controls the whole ffmpeg audio graph, so music is one more input and a few filters; the hard part is a legal, repeatable source for the track, because the free libraries mostly lack APIs and the paid ones either have none or restrict commercial use.

## Side-by-side

| Dimension | Bring your own file (chosen first) | Generate a track per video | Search a library by mood | Mix in an outside editor |
|---|---|---|---|---|
| What changes | `--music` flag, `animate-short` skill step | New `music` skill calling a generator, then the same flag | Skill plus a library API client | Nothing in OnCue |
| Cost | Free | About $0.08 per Stable Audio generation (official); ElevenLabs price unverified | Free (Freesound) to $39 a month (Mubert Pro) | Free |
| Dependencies added | None | An API key or the full ElevenLabs connector | An API key, license filtering | None |
| License risk | The person checks each track | Low; generator terms apply (Stable Audio terms unchecked) | Medium; per-track licenses vary | The person checks |
| Exact length fit | Loop and trim in the engine | Generated at the video length | Loop and trim | Manual |
| Repeatable by a skill | Partly; the person supplies the file | Yes | Yes | No |
| Main cost | Manual track choice | Spend per video, provider terms | Most moving parts | Breaks the one-command pipeline |

## Locked & resolved decisions

These follow from the codebase and repo rules and are proposed for approval:

1. **Approach: engine flag first, generation later.** One `--music` option now; a generator skill only after the mix is proven. The generator output is just a file, so both paths share the same engine code.
2. **No `short.json` field in this release.** Music changes no scene or card. A field would touch `spec.ts`, `loadSpec`, both renderers and `spec.md` for no rendering benefit (CLAUDE.md rule).
3. **The engine stays offline.** Network calls to a music generator live in skill prose and a connector, not in `engine/src`, matching how the voiceover is made.
4. **The engine never downloads music.** The person supplies the file. Any later skill that downloads a track must ask first, naming file, source and size.
5. **Version bump is a minor bump in `plugin.json`.** The version lives only there. Other proposals (reel, narrate-deck) also plan the next minor, so the number is set when this one is built, not now.

Open, for the person to decide before the plan is written:

- **Which generator first for the later skill:** ElevenLabs Eleven Music (needs the full connector or an API key; the restricted connector in some sessions has no music) or Stable Audio (credit-priced API).
- **Whether to normalize final loudness** with `loudnorm` after the mix, which also changes how loud the voice-only videos would be if applied to all of them.

## Workstreams

### A — Engine: second audio input and ducked mix (`engine/src/capture.ts`, `cli.ts`)

- Pull the inline filter string at `capture.ts:50` into a small exported function that returns the ffmpeg arguments for a given set of inputs. This makes the mix testable without launching Chromium.
- Add an optional `music` path to `renderVideo`. When set, add `-stream_loop -1 -i <music>` so a short track repeats, then trim to `tl.duration` with the existing `-t`.
- Filter shape (illustrative; parameters are fixed in phase 1 by measurement):

```
[1:a]adelay=300:all=1,apad,asplit=2[vo][sc];
[2:a]volume=<gain>,afade=t=in:d=1,afade=t=out:st=<duration-1.6>:d=1.6[bg];
[bg][sc]sidechaincompress=threshold=<t>:ratio=<r>:attack=<a>:release=<l>[ducked];
[vo][ducked]amix=inputs=2:duration=first:normalize=0,aformat=channel_layouts=stereo[a]
```

- With no voiceover (silent preview), mix music over `anullsrc` without ducking, so a preview can still be judged with music.
- `cli.ts`: parse `--music`, resolve and check the file exists, pass it through `prepare` to `renderVideo`; update the usage line at `:125` and the header comment. Add `--music-db` only if phase 1 shows track loudness varies too much for one default.
- `npm run build` and commit `dist/` with `src/` (CLAUDE.md).

### B — Skills: ask for a track and its license (`skills/animate-short/SKILL.md`, `skills/explainer-video/SKILL.md`)

- `animate-short`: add an optional "Music" step before the render command. Ask whether the person has a track; if so, pass `--music`. Ask where it came from and whether it needs a credit (Creative Commons BY tracks do), and print the credit line to paste in the video description.
- State plainly that the skill cannot verify a license, and that a track from a source without Content ID clearance can still get a copyright claim.
- `explainer-video`: one optional line in the stage list pointing to the music step. Keep descriptions within the `validate.mjs` limits (single line, at most 1024 characters, no angle brackets).

### C — Docs and release

- `README.md`: skills table row, a "Background music" section with the source comparison from Appendix A, and the changelog entry for the version chosen at build time.
- `plugins/oncue/.claude-plugin/plugin.json`: version bump (CLAUDE.md: bump for changes to what a skill or the engine does).

### D — Later, not in this release: a `music` skill that generates the track

- Prompt built from the storyboard mood, `force_instrumental` on, length set to the video duration (`audioSeconds + 1.9`), saved beside `short.json`, then handed to `--music`.
- Credit-spending: say the cost before generating and never retry silently, as the voiceover skill does.

## Risks & tensions

- **The filter graph is unverified.** The sketch above has not been run. `sidechaincompress` and `amix` option names, and the `normalize=0` option on `amix` (newer ffmpeg only), must be checked on the installed ffmpeg. Mitigation: phase 1 builds the graph by hand on the Gleaner example and keeps the working command as a fixture.
- **Loudness numbers must be measured.** The music gain, duck depth and release time are set from `volumedetect` or `ebur128` output on a real render, not guessed. The README must quote only measured values.
- **ffmpeg may not be on `PATH` here.** Memory records that this machine has none on `PATH` and wraps Remotion's bundled binaries. Tests and phase 1 must say so and not report a skipped run as green.
- **Audible loop seam.** A short track repeating can click or lurch at the join. Mitigation: a short crossfade at the loop point, or require tracks at least as long as the video and only loop as a fallback.
- **Mono voice, stereo music.** Mixing changes the output channel layout. The `aformat` at the end fixes the result to stereo; phase 1 checks the voice still sounds centered.
- **Licensing is the person's call.** Free libraries differ: Jamendo's API is non-commercial only, Freesound's CC BY-NC tracks are not allowed for monetized video, YouTube Audio Library terms for use outside YouTube are not stated. The skill asks and warns; it does not enforce.
- **Content ID.** Tracks from YouTube's own library are not claimed there; Mubert says its tracks cannot be registered in Content ID; other free tracks give no such promise.
- **Voice must stay intelligible.** Ducking on a quiet narrator can pump (music swells between words). Mitigation: a longer release time, judged by ear on the example and a second voice.

## Roadmap

| Phase | Work | Size | Depends on |
|---|---|---|---|
| 1 | Prove the mix: run the filter graph by hand on `examples/gleaner/voiceover.mp3` with a test track; record the command, measured loudness, and loop behavior; commit the command as a fixture | S | — |
| 2 | Workstream A: extract the filter builder, add `--music`, tests written first and seen failing, rebuild and commit `dist/` | S | 1 |
| 3 | Workstream B: `animate-short` music step and license questions; `explainer-video` line | S | 2 |
| 4 | Workstream C: README section, changelog, version bump | S | 3 |
| 5 | End to end: render the example with and without music; `ffprobe` both; compare mean volume in a window with no speech; run `npm run validate`, `npm run engine:typecheck`, `npm run engine:test`, `npm run example:deck`, `npm run example:stills` | S | 2, 3 |

Later, separate proposal: Workstream D.

## Appendices

### Appendix A — Source comparison (as read on 2026-11-09)

| Source | API | Cost | Terms that matter |
|---|---|---|---|
| YouTube Audio Library | No; manual download | Free | Some tracks need a credit; tracks are not claimed by Content ID; use outside YouTube is not addressed |
| Pixabay Music | No music endpoint (API covers images and videos) | Free | No attribution required; the summary does not mention music or Content ID |
| Freesound | Yes (token, OAuth2) | Free | CC0 and CC BY fine for commercial use; CC BY-NC not allowed |
| Jamendo | Yes | Free for non-commercial only | Commercial use needs a quote; credit links required |
| Mubert | Yes, priced separately (page not opened) | Pro $39 a month, $32.49 billed yearly | Free and Creator plans exclude monetized channels; tracks cannot be in Content ID |
| ElevenLabs Eleven Music | `POST /v1/music`, paid plans | Price not on the official pages read; a third-party blog says $0.15 per minute, unverified | Cleared for social media and advertising; instrumental option; length 3 s to 10 min per the API reference (the overview says 5 min) |
| Stable Audio | Credit API | $0.08 per generation; 3.0 up to 6 min, 2.5 up to 3 min | License terms not on the pricing page; check before use |
| Epidemic Sound, Artlist, Uppbeat | None found | Review sites disagree; unverified | Check each vendor's license page |

### Appendix B — Sources

- ElevenLabs Eleven Music overview (elevenlabs.io/docs/overview/capabilities/music) and compose API (elevenlabs.io/docs/api-reference/music/compose)
- Stability AI pricing (docs.stability.ai/pricing)
- Mubert pricing (mubert.com/render/pricing)
- Freesound FAQ (freesound.org/help/faq/) and API docs (freesound.org/docs/api/)
- Jamendo API terms (devportal.jamendo.com/api_terms_of_use)
- Pixabay license summary (pixabay.com/service/license-summary/) and API docs (pixabay.com/api/docs/)
- YouTube Audio Library help (support.google.com/youtube/answer/3376882)
- Epidemic Sound pricing page (epidemicsound.com/pricing/) showed no prices in the text read

## Next step

Author an execution plan that delivers Workstreams A through C in roadmap order, starting with phase 1, because the filter parameters and the loop behavior both come from it. Draft real steps that name the files each one touches; do not restate the headings above as steps. Treat the locked decisions as settled inputs and put the two open decisions to the person before step 2. Finish with the phase 5 checks and report the measured loudness difference rather than an estimate.
