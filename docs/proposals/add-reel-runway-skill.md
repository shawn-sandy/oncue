---
status: proposal
type: feature
created: 2026-11-02
repo-name: oncue
---

# Proposal: Add a reel skill that makes footage-led videos with Runway

> **Deprecated.** The authoritative artifact is the saved prompt at
> `docs/prompts/proposal-add-reel-runway-skill.md`. This copy is written for one deprecation
> release (plan-agent 6.0.0) and is removed in 6.1.0. Edit the prompt, not this
> file.

> This is a proposal for review, not an execution plan. It is grounded in a read of the engine (`render.ts`, `capture.ts`, `scenes.ts`, `deck.ts`, `spec.ts`, `timeline.ts`, `cues.ts`), the setup, storyboard, visuals and explainer-video skills, `scripts/validate.mjs`, and Runway's developer docs, SDK types and hosted-connector pages. The load-bearing decisions are resolved (see Locked & resolved decisions); execution is handed off (see Next step).

## TL;DR

- OnCue renders text-led explainers; it has no way to show footage. No video input exists anywhere in the engine or skills today.
- Runway is strong at exactly that gap (generated pictures and short clips) and weak at everything OnCue already does well (exact copy, word sync, decks).
- Proposal: a new `reel` skill in the OnCue plugin that orchestrates a footage-led workflow (shot list, Runway keyframes, voiceover, Runway clips, render), plus one engine addition, a `clip` scene kind that plays a local MP4 full-bleed, deterministically, under OnCue's own text. Runway is reached through its hosted connector, so the engine stays offline. Ship as 1.9.0.

## Context

OnCue (`plugins/oncue/`, version 1.8.0) turns one `short.json` into a storyboard, an ElevenLabs voiceover, a `.pptx` deck and an MP4 in which every element enters on the word that names it. Eight skills run the stages; the engine draws every frame as HTML in headless Chromium and encodes with ffmpeg.

What exists today that this touches:

- **Scenes are all cards and text.** Every content scene sits inside 90 px side margins (`.content`, `scenes.ts:150`); the only picture scene, `image`, frames a PNG or JPEG inside a bordered card with `object-fit: contain` (`scenes.ts:81-83`, `:195-196`). There is no full-bleed layout and no scrim.
- **No video input exists.** `mp4` appears only as an output (`cli.ts:9`, `:115`). The `media` kind is a drawn play button and scrub bar that takes no file (`scenes.ts:77-80`). The engine accepts only PNG/JPEG `image` sources, the logo, and the voiceover MP3 plus `words.json`.
- **Frames are a pure function of time.** `renderAt(t)` is synchronous (`render.ts:35`, `:47-130`); `capture.ts:40-44` awaits only the `page.evaluate` round trip before each screenshot. Boot waits for fonts, not images (`render.ts:166-180`).
- **Picture generation already has a policy.** The visuals skill uses an image-generation tool "only when the session has one", names it, warns about credits and asks first, and forbids generated product interfaces, real people, logos and text inside pictures (`skills/visuals/SKILL.md:23-30`, `:61`, `:68`).
- **Connectors live in prose, not code.** ElevenLabs is reached through its connector from skill text; setup checks it in section 6 (`skills/setup/SKILL.md:102-119`). The engine makes no network calls.

Why it is on the table: the person wants Runway as a second engine for OnCue, with a skill built for the Runway workflow that shares OnCue's features. Exploration this session found that Runway suits footage-led, visual presentation videos rather than text-led explainers, so the skill is a sibling of `explainer-video`, not a replacement. The person named it `reel`.

## Core finding

> Runway can supply the one thing OnCue cannot make (footage) but none of what makes OnCue work (exact text on exact words), so the right shape is a Runway-fed `clip` scene that the existing engine times and overlays, driven by a new orchestrating skill, not a second renderer.

## Side-by-side

| Dimension | Skill + clip kind (chosen) | Skill + ffmpeg assembly | Separate reel plugin | Keep the current approach |
|---|---|---|---|---|
| What is built | `skills/reel/`, a `clip` scene kind in the engine, Runway routes in visuals and setup | `skills/reel/` that stitches Runway clips, captions and voiceover with ffmpeg commands | A second plugin with its own engine copy and skills | Nothing new; Runway only as an optional image source in visuals |
| Word-synced text over footage | Yes: the engine's cue system | No: captions burned in by time ranges | Yes, in the duplicate engine | n/a (no footage) |
| Reuses `short.json`, setup, research, voiceover, deck, render | All of them | Spec and voiceover only; a second render path | Copies of them | All, unchanged |
| Engine change | One scene kind (M/L) | None | A forked engine | None |
| Mixing footage beats with text beats | Native: any spec may mix kinds | Hard: two renderers would have to be spliced | Native, but in the fork | n/a |
| Main cost | Deterministic clip playback and a full-bleed layout in `render.ts` | Two render paths to maintain and keep in step | Every fix lands twice | No footage at all |

## Locked & resolved decisions

1. **Approach: skill + clip kind.** Chosen in the 2026-11-02 review over skill + ffmpeg assembly, a separate plugin, and keeping the current approach, because it reuses the whole pipeline, keeps text word-synced over footage, and lets any spec mix footage and text beats at the cost of one engine change.

Settled before this draft (from the codebase, repo rules and this session):

2. **Name: `reel`.** Chosen by the person on 2026-11-02. The folder is `plugins/oncue/skills/reel/` and its frontmatter `name` is `reel`, which `scripts/validate.mjs:113` requires to match.
3. **Same plugin, shared engine.** The clip kind lives in the one engine, so `explainer-video` specs can use clip beats too, through the visuals skill.
4. **The engine stays offline and never calls Runway.** It reads local files only, like pictures today. Generation, download and spend all happen in skill steps.
5. **Clips carry no sound into the video.** The voiceover stays the only audio; clip audio is generated off where the model allows it and dropped when frames are extracted.
6. **Truth rules extend to footage.** The visuals rules (no product interfaces, real people, logos, or text inside generated media) apply to clips and keyframes alike.
7. **Host-specific connector text stays in setup.** `validate.mjs:63-76` rejects `/mcp`-style commands (`:67`) and host words (`:75`) in every skill except setup, so `reel` refers to "the Runway connector" and setup carries the per-host connection steps.
8. **Version 1.9.0.** A new skill plus an engine scene kind changes what the plugin does (CLAUDE.md, Versioning); the changelog entry goes last in `README.md` as `### 1.9.0 (YYYY-MM-DD)`.

Resolved in the 2026-11-02 review:

9. **Access: Runway's hosted connector** (`https://mcp.runwayml.com/mcp`), signed in with the person's Runway account and drawing on their Runway plan credits. No API key and no network code in the engine. Propagates to Workstream C (setup section) and Risks (tool names unverified, phase 1).
10. **Default video model: Kling 3.0 Pro** (`kling3.0_pro`): 12 credits a second without audio on the developer price list, native `1080:1920`, `1920:1080` and `1440:1440`, 3-15 s clips, first-frame and last-frame images. Measured against the Gleaner example, every beat is on screen for 6.88-11.11 s, all inside that range; Gen-4.5's 10 s cap would miss two of nine. Propagates to Workstream B (clip length rule) and Appendix B.
11. **Deck shows a poster frame.** Each clip beat carries a `poster` picture (its approved keyframe) that the deck draws through the existing `addImage` path (`deck.ts:219-235`). No `addMedia`, and no ffmpeg needed to build a deck. Propagates to Workstream A (`poster` field) and Appendix A.
12. **Keyframe first.** Every clip starts from a Runway `text_to_image` picture saved as an ordinary `image` beat, which the person approves before any video credits are spent; the keyframe becomes the clip's first frame and its `poster`. At that point the existing stills and deck already work. Propagates to Workstream B (check-in order) and the reel workflow in Appendix C.
13. **Spend guard: ask before each batch, no fixed cap.** Before keyframes and before clips, the skill states the model, the number of generations and the estimated credits, and asks, as the visuals skill does for image tools. A configured hard cap was rejected. Propagates to Workstream B (Spend) and Appendix C steps 2 and 4.

## Workstreams

### A — Engine: the `clip` scene kind

Follows the CLAUDE.md contract for a new kind: type, validation, both renderers, a cue slot, a spec reference row, `npm run build`, and `dist/` committed.

- **`spec.ts`:** a `ClipScene` interface (contract in Appendix A) added to the `Scene` union (`:87`), `KINDS` (`:115`) and `WIDE` (`:149-151`, a mapped type that will fail to compile without the entry). `loadSpec` checks that `src` is an existing `.mp4` and `poster` an existing PNG or JPEG, and requires `alt`. An async `checkClips` beside `checkPictures` (`:233-243`) probes each clip with ffprobe (has a video stream, finite duration) and decodes the poster, failing with the field name, as `checkPictures` does for pictures.
- **`cues.ts`:** a `clip` case in `slots()` (`:6-21`) for the caption cue. The footage itself starts at the scene's start, not on a cue, because it fills the frame from the first moment the scene is visible.
- **`scenes.ts`:** a `clip` case in `body()` that emits a full-bleed footage layer, a scrim, and the kicker, title and caption over it. When it writes `build/scenes/`, extract each clip to a numbered JPEG sequence at the render frame rate (30 fps, `capture.ts:46`), scaled to cover the format, with ffmpeg; this is the first ffmpeg use outside `capture.ts`. CSS stays inline in the one style block (`scenes.ts:137-219`).
- **`render.ts`:** pick the frame for `floor((t - start) * 30)`, holding the last frame when the beat outlasts the clip. Keep it a pure function of time: `renderAt` may return a Promise (from `img.decode()`) when the frame changes, which `page.evaluate` in `capture.ts:41` already awaits; change the `renderAt` type in `render.ts:35` and `capture.ts:8`. The section-level enter and exit transform (translate +50/-60 px, scale 1.05 to 0.998, `render.ts:86-97`) would expose the frame edge under full-bleed footage, so the footage layer needs overscan or its own transform rule.
- **`deck.ts`:** a `clip` case that draws the `poster` full-bleed (pptxgenjs accepts an image background, or an `addImage` at slide size) with the title and caption over it. `slideFor` has no default branch (`:110-250`), so a missing case compiles and draws only the header that `deck.ts:258` adds for every content kind; add a test that asserts the poster image is in the clip slide.
- **Tests (written first, seen failing):** follow `image-spec.test.mjs` (validation errors name `lines[1].scene.src`) and `image-scene.test.mjs` (timeline slots, scene HTML, deck media through JSZip). Synthesise test clips with ffmpeg `testsrc` in a temp folder, and skip when ffmpeg is missing, as browser tests skip when Chromium is (`test/helpers/browser.mjs`). One browser test renders a still mid-clip and checks a known frame colour, as `image-stills.test.mjs:31-39` counts fixture pixels.
- **`skills/storyboard/references/spec.md`:** a `clip` row in the Scene kinds table (`:106-116`), modelled on the `image` row.

### B — The reel skill (`plugins/oncue/skills/reel/SKILL.md`)

An orchestrator modelled on `explainer-video` (stage table, check-ins, "Things that went wrong before"), with `name` matching the folder, a `description` of at most 1024 characters with no angle brackets, and a single-line, single-quoted `compatibility` of at most 500 characters (`validate.mjs:34-42`, `:110-124`); `argument-hint` follows the other skills' convention and is not validated.

- **Stages:** brief and shot list (`short.json` with mostly clip-candidate beats, each with a `motion` prompt, plus text beats where facts need saying); keyframes (check-in 1); voiceover (check-in 2, the existing voiceover skill); clips; render; deliver. Full flow in Appendix C.
- **Shot prompts come from `motion`.** The existing optional, unrendered `motion` field (`spec.ts:93-94`) is the clip prompt, with brand colours added; no new prompt field.
- **Clip length per beat:** the beat's on-screen time from `build/timeline.json` (Appendix B), rounded up to a whole second and clamped to the model's 3-15 s. Clips are requested after the voiceover, so lengths come from real word timings, not estimates.
- **Spend:** before keyframes and before clips, state the model, the number of generations and the estimated credits, and ask, as the visuals skill does for image tools.
- **Downloads:** save each output the moment its task succeeds (`clips/beat-NN.mp4`, keyframes in `images/`); Runway's output links expire within 24-48 hours.
- **Credits:** record model, prompt and credits per beat under Credits in `research.md`, as visuals does for licences.
- **No host words:** connector setup is a pointer to the setup skill (decision 7).

### C — Setup, visuals and storyboard skills

- **Setup (`skills/setup/SKILL.md`):** a "Runway" section after section 6 (ElevenLabs), structured like it: discover the connector's tools and read their schemas, per-host connection steps, never generate during setup, and what to do when Runway's file host is blocked. Add Runway to the status list and a "Footage clips" row to the outputs table (`:123-135`). ffmpeg and ffprobe become needed for `check` and stills whenever a spec has clip beats; say so in the outputs table.
- **Visuals (`skills/visuals/SKILL.md`):** a Runway route under "Source the picture": keyframes through Runway `text_to_image` (Gen-4 Image, up to three reference images such as the logo or an approved frame), and clips through Runway image-to-video from an approved keyframe, writing the `clip` beat. The truth rules gain "footage" wherever they say "picture".
- **Storyboard (`skills/storyboard/SKILL.md`):** when the request is footage-led, write a `motion` prompt for every beat and mark which beats are footage candidates.

### D — Trigger separation, docs and release

- **Trigger separation.** Four skill descriptions use "Reel" or "Reels" as a format: animate-short (2), explainer-video (1), storyboard (1, "plan a short, a Reel, a TikTok"), vertical-deck (1). The `reel` description must lead with footage and Runway, not the Instagram format, so "make a Reel about our CLI" still reaches explainer-video. Add an eval case under `plugins/oncue/evals/` for both phrasings.
- **README:** a Requirements row for Runway, a skills-table row (`:125-134`), a sentence in "How it works", and the 1.9.0 changelog entry.
- **`plugin.json`:** version 1.9.0; add `runway` and `footage` keywords; mention reel in the description. `marketplace.json` description likewise (it carries no version).
- **`explainer-video`:** one line pointing footage-led requests to `reel`.

## Risks & tensions

- **The hosted connector's tools are unverified.** Runway's pages list no tool names, do not mention Claude Code, and name models only as examples. Kling 3.0 Pro, a first-frame image, `1080:1920`, and audio off must all be reachable through it. Mitigation: phase 1 connects it in Claude Code, records every tool and schema, and runs one keyframe and one clip before any skill text is written. If Kling 3.0 Pro is not exposed, fall back to whichever 1080p model is, and record the change here.
- **Credit units differ by route.** The 12 credits a second for Kling 3.0 Pro and 8 per 1080p Gen-4 Image are developer-API prices at $0.01 a credit. The hosted connector draws Runway app plan credits, whose rate is not published on the pages read. Phase 1 records the credits actually charged.
- **Cost.** If every beat of the Gleaner example were a clip, Kling 3.0 Pro would bill 82 s (984 developer credits, $9.84) plus 72 credits for nine 1080p keyframes, before retries. A reel with fewer footage beats costs proportionally less.
- **Expiring links and blocked hosts.** Outputs expire within 24-48 hours of access. Sandboxes may block Runway's file host, as they block `storage.googleapis.com` for ElevenLabs today; the host name is a phase 1 finding.
- **Determinism and render time.** Swapping an `<img>` per frame adds a decode to every frame; the cost on render time is unmeasured. Preloading every frame instead would trade decode time for memory. Phase 2 measures the 30 fps render rate with and without clip beats.
- **Full-bleed under the scene transform.** The section-level translate and scale exist for card scenes and would show the frame edge under footage. The clip layout needs overscan or its own transform rule, and still frames at entry and exit must be checked.
- **Text over footage.** Contrast cannot be checked against a moving picture; `contrastWarnings` covers brand pairs only. The scrim is the mitigation, and stills of every clip beat are the check.
- **ffmpeg moves earlier.** Today `check`, `deck` and stills need no ffmpeg. With clip beats, `check` needs ffprobe and stills need ffmpeg (frame extraction). The deck stays ffmpeg-free because it uses `poster` (decision 11).
- **Generated footage drifts.** Clips can go off-brand, show artefacts, or refuse on moderation. Keyframe-first approval and one regeneration per beat are the controls; the reel skill reports any beat it could not generate and leaves it as its keyframe `image` beat.
- **Name collision.** `reel` shares its word with a format OnCue already serves; Workstream D's description wording and eval case are the mitigation.

## Roadmap

| Phase | Work | Size | Depends on |
|---|---|---|---|
| 1 | Connect Runway's hosted connector in Claude Code; record tool names, schemas, model list, output link host and expiry, and credits charged for one 1080p Gen-4 Image keyframe and one 5 s Kling 3.0 Pro clip at `1080:1920` with a first frame and audio off | S | — |
| 2 | Workstream A: `clip` kind, tests first, `npm run build`, commit `dist/`; measure render fps with clip beats | L | — |
| 3 | Workstream B: `skills/reel/SKILL.md` | M | 1 |
| 4 | Workstream C: setup Runway section and outputs row, visuals Runway route, storyboard footage note | M | 1, 2 |
| 5 | Workstream D: description wording, trigger eval, README, plugin.json 1.9.0, marketplace description, changelog | S | 3, 4 |
| 6 | End to end: a four-beat reel with two real Runway clips; `npm run validate`, `npm run engine:typecheck`, `npm run engine:test`, `npm run example:deck`, `npm run example:stills`; look at stills of each clip beat at entry, mid-clip and exit | S | 2-5 |

## Appendix A — `clip` scene contract (draft for the plan)

```json
{
  "kind": "clip",
  "kicker": "The problem",
  "title": "Ideas {vanish}",
  "src": "clips/beat-02.mp4",
  "poster": "images/beat-02.png",
  "alt": "A desk at night, browser tabs dissolving into light",
  "caption": "Generated with Runway",
  "captionCue": { "word": "tab" }
}
```

| Field | Rule |
|---|---|
| `src` | Required. An existing `.mp4`, relative to `short.json`, with a video stream and a finite duration (ffprobe). Audio is ignored. |
| `poster` | Required. An existing PNG or JPEG, decoded in full like `image.src`. The approved keyframe; drawn in the deck and used as the clip's first frame. |
| `alt` | Required. One sentence describing what the footage shows. |
| `kicker`, `title` | As in other content scenes, drawn over the scrim. |
| `caption`, `captionCue` | Optional; one line, entering on its cue word. |
| Timing | Footage starts at the scene's start and plays at 30 fps; the last frame holds if the beat outlasts the clip. |

## Appendix B — Clip length per beat

From `timeline.ts:98` and `:114-116` and the fades in `render.ts:88-89`:

| Beat | On screen |
|---|---|
| Not the last | `next.start - start + 0.18` s (the fade out starts at `end - 0.12` and lasts 0.3 s) |
| The last | `duration - start` s, including the 1.6 s tail |

Requested length: round up to whole seconds, clamp to Kling 3.0 Pro's 3-15 s. Measured on `engine/examples/gleaner` (73.04 s of audio): 8.46, 7.18, 10.06, 8.52, 11.11, 6.88, 8.71, 8.12 and 7.34 s, requesting 9, 8, 11, 9, 12, 7, 9, 9 and 8 s.

Runway request mapping, from the beat:

| `short.json` | Runway field |
|---|---|
| `lines[i].motion` plus `brand.colors` words | `promptText` |
| `format` | `ratio`: `1080:1920`, `1920:1080` or `1440:1440`; other sizes take the nearest and the engine crops to cover |
| Appendix B length | `duration` |
| The approved keyframe | first-frame image |
| (fixed) | audio off |

## Appendix C — The reel workflow

1. **Shot list.** Storyboard writes `short.json`: 4-8 beats, footage candidates with `motion` prompts, text beats where facts need saying, and a closing `cta`.
2. **Keyframes (check-in 1).** After stating the estimated credits and getting a yes, Runway `text_to_image` makes one picture per footage beat in brand colours, saved as `image` beats. Stills and the deck already work; the person approves or regenerates.
3. **Voiceover (check-in 2).** The existing voiceover skill, unchanged.
4. **Clips.** After stating the estimated credits and getting a yes, Runway image-to-video animates each approved keyframe to its Appendix B length, audio off; download to `clips/beat-NN.mp4` at once; switch the beat to `clip` with the keyframe as `poster`. Only `scene` changes, never `vo`, so nothing is re-recorded.
5. **Render.** `check`, stills at each clip beat's entry, middle and exit, then the video in the background.
6. **Deliver.** The MP4 (and the deck), the voice and take, the models used, and the Runway credits spent.

## Appendix D — Incidental findings (out of scope)

- `CLAUDE.md:7` says "six skills"; there are eight skill folders, and nine after this proposal.
- `deck.ts` `slideFor` has no default branch, so any future kind missing from it compiles and draws a slide with only its kicker and title (`deck.ts:258`), no body.
- `render.ts`'s header comment calls the default cue "line"; the code's default is `"start"` (`render.ts:54`).

Sources: Runway API reference (docs.dev.runwayml.com/api); Runway models guide (docs.dev.runwayml.com/guides/models); Runway pricing (docs.dev.runwayml.com/guides/pricing); Runway outputs (docs.dev.runwayml.com/assets/outputs); Runway Node SDK `image-to-video.ts`, `text-to-image.ts`, `text-to-speech.ts` (github.com/runwayml/sdk-node); Runway MCP (runway.com/mcp, runway.com/news/mcp); Runway Dev MCP (docs.dev.runwayml.com/guides/mcp).

## Next step

Author an execution plan that delivers Workstreams A through D in roadmap order, starting with the phase 1 connector verification for the skill work and the engine `clip` kind in parallel, since the engine does not depend on the connector. Draft real, actionable steps that name the files each one touches; do not restate the headings above as steps. Treat the locked decisions as settled inputs. Finish with the phase 6 checks, and report the measured render rate and the credits actually charged rather than estimates.

Convert to an execution plan:
`/plan-agent:implementation-plan Add a reel skill that makes footage-led videos with Runway --from-prompt docs/prompts/proposal-add-reel-runway-skill.md`
