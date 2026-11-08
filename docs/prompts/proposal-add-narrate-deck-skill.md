---
type: proposal
intent: Add a narrate-deck skill to OnCue that turns a PowerPoint or Google Slides deck into a narrated video, plus a full-bleed slide scene kind in the engine.
techniques: Long-context grounding, XML structure, Comparison tables, Positive framing, Output format
created: 2026-11-08
modified: 2026-11-08
status: converged
repo-name: oncue
generated-sha: 8153c906ed5ddc13ee0ca31144da2c407beeb7f9eb9fba3f5e5b1c5ab47191b8
---

# Proposal: Add Narrate Deck Skill

> This is a proposal for review, not an execution plan. It carries the
> grounded research and the decisions already made; the final instruction
> below hands off to drafting an execution plan from it.

<tldr>
- OnCue only runs one way today: topic, then `short.json`, then a deck and a video. Nothing takes an existing presentation as input (no skill names `.pptx`, Google Slides or Keynote as source material).
- A deck is already most of a storyboard: each slide is a beat, and its speaker notes are draft narration. The voiceover and word timing work unchanged.
- The one engine gap: the only picture scene, `image`, frames a PNG inside a card under a kicker and a title, so a whole slide would shrink and repeat its own title. A new full-bleed `slide` scene kind closes it.
- Proposal: a new `narrate-deck` skill that imports slide pictures and notes, rewrites the notes for the ear with the person's approval, and renders through the existing voiceover and video stages; plus the `slide` scene kind. 16:9 and letterboxed 9:16 both supported. Ship as the next minor version.
</tldr>

<context>
OnCue (`plugins/oncue/`, version 1.8.0, eight skills) turns one `short.json` into a storyboard, an ElevenLabs voiceover with word timestamps, a `.pptx` deck and an MP4 in which every element enters on the word that names it.

What exists today that this touches:

- **Input is topics, not decks.** The storyboard skill gathers "the product's README, docs or code" (`skills/storyboard/SKILL.md:15`); explainer-video's argument is "topic, product, or path to short.json" (`skills/explainer-video/SKILL.md:5`); the README's "What to provide" lists "a repo, README, docs page or notes" (`README.md:83`).
- **Decks are output only.** vertical-deck builds a deck from `short.json` and never imports one. It states that speaker notes are not narration and points to Record Slideshow (`skills/vertical-deck/SKILL.md:37`).
- **The `image` scene is framed, not full-bleed.** It renders inside `content()` with the kicker and title (`scenes.ts:81-83`), in a bordered `.photo` card with `object-fit: contain` (`scenes.ts:192-196`), within 90 px side margins (`scenes.ts:150`). The deck draws it letterboxed in a card under the title (`deck.ts:219-235`).
- **Timing already fits.** Each beat's `vo` is split by word timestamps (`timeline.ts`), and scenes fade in over 0.4 s and out over 0.3 s (`render.ts:86-97`). A slide beat needs only that.
- **The reel proposal needs the same layer.** `docs/proposals/add-reel-runway-skill.md` proposes a `clip` kind with a full-bleed footage layer under a scrim, kicker and title (its Appendix A, lines 137-160). It is not implemented (`grep clip src/` finds only Playwright's screenshot `clip`).

Why it is on the table: the person asked whether OnCue can create videos from presentations such as PowerPoint or Google Slides.
</context>

<finding>
A deck is already a storyboard, with slides as beats and notes as draft narration, so OnCue needs no new pipeline: only a way to show a slide as itself (a full-bleed `slide` scene) and a skill that turns a deck into `short.json`.
</finding>

<comparison>
| Dimension | Narrate (chosen) | Narrate + rebuild | Rebuild only | Keep the current approach |
|---|---|---|---|---|
| What the viewer sees | Each slide exactly as designed | Slides as designed, chosen slides rebuilt as OnCue scenes | OnCue's own scenes; deck design lost | Whatever the presenter records |
| Word-synced entrances | Whole slide only | Per element on rebuilt beats | Per element everywhere | None |
| Engine change | `slide` kind, 11 touch points | Same | None | None |
| Skill work | New `narrate-deck` | New skill, longer | Storyboard and explainer-video accept a deck as material | None |
| Narration | Notes rewritten for the ear, approved | Same | Same | Presenter's own voice, live |
| Risk | Readability of small slide text, export resolution | Same, plus two modes to explain | Brand and layout drift from the deck | No OnCue value added |
</comparison>

<decisions>
Locked and resolved — treat these as settled; do not reopen them:
1. **Approach: Narrate.** Chosen on 2026-11-08 over Narrate + rebuild, Rebuild only, and keeping the current approach, because it is the workflow missing today: it keeps the deck's own look with one engine addition. Rebuilding stays possible later, since `slide` beats can sit beside native beats in one `short.json`.

Settled before this draft:

2. **Voiceover, timing and video stages are reused unchanged.** The voiceover skill records `vo` and gets word timestamps; `timeline.ts` splits beats; `cli.js video` renders.
3. **The engine stays offline.** Google Slides is reached through its connector from skill prose, the same way ElevenLabs is. No network code in the engine.
4. **No new dependency for import.** The skill reads PowerPoint notes with `unzip -p` (present at `/usr/bin/unzip` here). `jszip` 3.10.2 is installed but only as a transitive dependency of `pptxgenjs` (`engine/package-lock.json:687-697`), so the engine does not import it at runtime.

Resolved in the 2026-11-08 review:

5. **Notes are a draft, approved before recording.** The skill rewrites each slide's notes for the ear (short sentences, no fragments), drafts narration from the slide's own text when notes are empty, shows the full script, and records only after approval. Same gate as explainer-video ("Do not record audio before they approve"). Propagates to Workstream B step 3 and Appendix C.
6. **Shapes: 16:9 and letterboxed 9:16.** 1920x1080 is the primary target. 1080x1920 is supported with the slide letterboxed as a band across the middle on the ground colour. `check` warns when a slide's shape differs from the frame and when slide text will be small. Propagates to Workstream A (layout, warnings), Risks (readability) and Appendix A.
7. **Motion: subtle slow zoom.** Keep OnCue's existing push-in and fade (`render.ts:86-97`). The picture is drawn oversized enough that the hold zoom and exit lift never expose the frame edge when it fills the frame. Propagates to Workstream A and Risks.
8. **Home: a new `narrate-deck` skill.** Its own folder under `plugins/oncue/skills/`, like the proposed `reel`, so "turn my deck into a video" triggers cleanly and explainer-video stays about topics. Propagates to Workstream C (skill counts, README table).
</decisions>

<workstreams>
### A — Engine: the `slide` scene kind

- **Contract** (Appendix A): `{ "kind": "slide", "src": "slides/slide-01.png", "alt": "..." }`. No kicker, title, caption or cue: the whole slide enters at its beat's start.
- **Validation** reuses the `image` checks: `loadSpec` requires a PNG or JPEG `src` that exists and a non-empty `alt` (`spec.ts:215-223`); `checkPictures` (`spec.ts:233-243`) widens from `kind === "image"` to both kinds. New warnings from `check`: the picture's aspect ratio differs from the frame's by more than 2% (letterboxed), and the picture is narrower than the frame (it will be upscaled and look soft).
- **Video:** a full-bleed section with no `content()` wrapper and no brand row (`scenes.ts:133` gains `slide` beside hook and cta). Filling frame: `object-fit: cover` on an oversized layer so the hold scale (about 1.018) and the exit lift (up to 60 px, `render.ts:86-97`) never show an edge. Letterboxed frame: `object-fit: contain` on the ground colour with the background glow off for that beat. The sharp copy at `scenes.ts:117-122` runs for `slide` too. The 10 px progress bar (`scenes.ts:146`) stays on top.
- **Deck:** a full-bleed picture slide (`s.addImage` at 0,0,W,H, or `s.background = { data }`, `pptxgenjs` types at `index.d.ts:2495`) with `vo` in the notes (`deck.ts:260`); `deck.ts:258` skips kicker and title for `slide`.
- **Cues:** `cues.ts` `slots()` returns no slots for `slide`.
- **Layout type:** `WIDE` (`spec.ts:149-151`) needs a value for `slide`; add a `"full"` arrangement that both `slide` and the future `clip` use.
- **Shared with `clip`:** build the full-bleed layer once so the reel proposal's `clip` reuses it (its footage layer sits in the same place, with a scrim and text on top).
- **Tests:** follow `test/image-spec.test.mjs:41` and `test/image-scene.test.mjs:34-36` (the deck read through JSZip). Update `test/theme.test.mjs:33`, which counts content scenes as "not hook or cta".

### B — The `narrate-deck` skill (`plugins/oncue/skills/narrate-deck/SKILL.md`)

1. **Intake.** Accept a Google Slides link or a `.pptx` plus a folder of exported slide PNGs (Appendix B).
2. **Order and pair.** One beat per visible slide, in deck order, with its notes. Hidden and skipped slides are left out by default (Open questions).
3. **Draft narration.** Rewrite notes for the ear; draft from slide text when notes are empty; mark missing facts `[YOUR FACT]` as storyboard does. Show the full script. Record nothing before approval (decision 5).
4. **Pick the shape.** 1920x1080 by default; 1080x1920 letterboxed on request, after warning about small text (decision 6).
5. **Write `short.json`.** Every beat a `slide` beat; `brand` filled from the deck (ground colour from the slide background, deck name as `brand.name`), since `loadSpec` requires a full brand block (`spec.ts:200-212`) and the video copies the logo file even when no beat shows it (`scenes.ts:115`). Run `check`.
6. **Hand off.** Voiceover skill (unchanged), then stills, then video (animate-short). The deck stage is skipped by default: the person already has their deck.
7. **Deliver** as explainer-video does: the MP4, the voice and take, and credits spent.

### C — Docs, validation and release

- `skills/storyboard/references/spec.md`: a `slide` row in the kinds table (`:106-116`) and the arrangement sentence (`:104`).
- `README.md`: the kinds list (`:138`), the skills table (`:127-134`), "All eight skills" (`:199`) becomes nine, a "Turn a deck into a video" section, and a changelog entry.
- `plugins/oncue/evals/research-topics/fixtures/README.md:126`: the older kinds list.
- The skill must pass `scripts/validate.mjs`: `name` equals the folder, `description` at most 1024 characters with no angle brackets, a single-quoted single-line `compatibility` of at most 500 characters, resolving links, and no host words (claude, codex, chatgpt, WebFetch, `/plugin`, `/mcp`) outside `setup` (`validate.mjs:34-43`, `:62-84`, `:106-122`).
- Cross-link from explainer-video and vertical-deck ("Have a deck already? Use narrate-deck.").
- Bump `plugins/oncue/.claude-plugin/plugin.json` to the next minor version and run `npm run build`, `engine:typecheck`, `engine:test`, `validate`, then the example deck and stills.
</workstreams>

<risks>
- **Speaker notes are rarely narration.** The deck skill says so itself (`vertical-deck/SKILL.md:37`). Mitigation: the approval gate in decision 5; never record unapproved text.
- **Small text in 9:16.** A 1920-wide slide letterboxed into a 1080-wide frame shows at 56% size. Mitigation: the `check` warning and a one-line warning before the person picks 9:16.
- **PowerPoint exports low resolution by default.** File > Export to PNG gives 1280x720 for a widescreen slide at the default 96 dpi; Windows can raise it with the `ExportBitmapResolution` registry value (Microsoft Learn, "How to export high-resolution (high-dpi) slides from PowerPoint"). A 1280 px slide passes OnCue's 1080 px minimum but is upscaled 1.5x for a 1920 frame. Mitigation: the "narrower than the frame" warning and export instructions per platform. The Mac export dialog's size options are unverified (spike).
- **Google Slides thumbnails may not download in a sandbox.** `getThumbnail` returns a `contentUrl` that lasts 30 minutes, is tagged with the requester's account, and counts as an "expensive read" for quota. Sessions already block ElevenLabs' file host. Mitigation: a spike on a real deck; fallback to downloading the deck as PPTX or PDF and exporting PNGs.
- **Slide builds, animations and embedded video are lost.** Each slide becomes one still picture. State it in the skill's opening line.
- **Hold zoom crops the edges of a full-frame slide** by a few percent. Slides normally have margins, but content set at the very edge could be clipped. Mitigation: keep the overscan to the minimum the motion needs.
- **Version and layer collision with the reel proposal.** Both proposals claim the next minor version and a full-bleed layer. Mitigation: whichever lands first builds the shared `"full"` layer; the other reuses it.
</risks>

<open-questions>
Decisions still owned by the human — surface them, do not answer them:
- Should hidden or skipped slides be left out by default (recommended), or included with a warning? (`slideProperties.isSkipped` in Google Slides; the `show="0"` attribute on a `.pptx` slide is unverified.)
- Ship before or after the reel proposal, given both need the full-bleed layer?
</open-questions>

<roadmap>
| Phase | Work | Size | Depends on |
|---|---|---|---|
| 0 | Spikes: Slides connector on a real deck (notes, `WIDTH2000_PX` thumbnail, download in a sandbox); `unzip -p` notes from a real `.pptx`; PowerPoint for Mac export sizes | S | — |
| 1 | Engine: `slide` kind, `"full"` arrangement, warnings, deck slide, tests | M | — |
| 2 | `narrate-deck` skill: intake, pairing, narration gate, `short.json`, hand-off | M | 0, 1 |
| 3 | Docs, cross-links, version bump, changelog, end-to-end example | S | 1, 2 |
</roadmap>

<appendices>
### Appendix A — `slide` scene contract (draft for the plan)

| Field | Type | Rule |
|---|---|---|
| `kind` | `"slide"` | Required |
| `src` | path | PNG or JPEG, relative to `short.json`, must exist and decode in full (same as `image`) |
| `alt` | string | Required. What the slide says, in one sentence |

- Fills the frame (`cover`, oversized for motion) when the picture and frame shapes match within 2%; otherwise letterboxed (`contain`) on `brand.colors.ground`, glow off.
- No brand row, no kicker or title, no cue slots. Enters with the scene fade; holds with the slow zoom.
- Deck: one full-bleed picture slide, `vo` in the notes.
- `check` warnings: shape mismatch (letterboxed), picture narrower than the frame (upscaled).

### Appendix B — Intake, per source

| Source | Slide order | Notes | Pictures |
|---|---|---|---|
| Google Slides (connector) | `read_presentation` with fields `slides(objectId,slideProperties(isSkipped,notesPage))` | Each slide's `notesPage`: read `notesProperties.speakerNotesObjectId`, then that shape's text; a missing shape means no notes | `read_slide_page_thumbnail` per slide, `WIDTH2000_PX` (2000 px) or `LARGE` (1600 px) PNG; download `contentUrl` within 30 minutes |
| Google Slides (fallback) | — | — | Drive exports a presentation only as PPTX, ODP, PDF or text, not PNG; use the PPTX path below |
| PowerPoint `.pptx` | `ppt/presentation.xml` slide list, resolved through `ppt/_rels/presentation.xml.rels` | `unzip -p deck.pptx ppt/notesSlides/notesSlideN.xml`, matched to slides through `ppt/slides/_rels/slideN.xml.rels` | The person exports all slides with File > Export > PNG; at least 1920 px wide recommended |

Pictures are saved as `slides/slide-NN.png` beside `short.json`.

### Appendix C — Worked example

A four-slide deck, after the approval gate:

```json
{
  "title": "Quarterly roadmap",
  "format": { "width": 1920, "height": 1080 },
  "brand": { "name": "Quarterly roadmap", "logo": "logo.png", "colors": { "...": "from the deck" }, "fonts": { "sans": "plus-jakarta-sans", "mono": "jetbrains-mono" }, "deckFonts": { "head": "Aptos", "body": "Aptos" } },
  "lines": [
    { "vo": "Here is what we are shipping this quarter.", "scene": { "kind": "slide", "src": "slides/slide-01.png", "alt": "Title slide: Q4 roadmap" } },
    { "vo": "Three things matter most: speed, search and sharing.", "scene": { "kind": "slide", "src": "slides/slide-02.png", "alt": "Three priorities: speed, search, sharing" } }
  ]
}
```

Original note for slide 2: "speed / search / sharing - mention Q3 numbers". The rewrite above drops the instruction to the presenter and marks the numbers as `[YOUR FACT]` if the person wants them spoken.

### Appendix D — Incidental findings (out of scope)

- `CLAUDE.md:7` says "six skills"; there are eight skill folders and the README says eight (`README.md:199`).
- `plugins/oncue/evals/research-topics/fixtures/README.md:126` lists an older set of scene kinds.

Sources: Google Slides API `presentations.pages.getThumbnail` and `SlideProperties` (developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages); Slides speaker notes guide (developers.google.com/workspace/slides/api/guides/notes); Drive export formats (developers.google.com/workspace/drive/api/guides/ref-export-formats); Microsoft Learn, How to export high-resolution (high-dpi) slides from PowerPoint (learn.microsoft.com/en-us/office/troubleshoot/powerpoint/change-export-slide-resolution).
</appendices>

Author an execution plan that delivers Workstreams A through C in roadmap order, running the phase 0 spikes and the engine `slide` kind in parallel, since the engine does not depend on the import path. Draft real, actionable steps that name the files each one touches; do not restate the headings above as steps. Treat the locked decisions as settled inputs, and carry the open questions into the plan's unresolved-questions section rather than answering them. Finish with the CLAUDE.md validation commands and an end-to-end render of a real four-slide deck at 1920x1080 and at 1080x1920, looking at the stills.

Convert to an execution plan:
`/plan-agent:implementation-plan Add a narrate-deck skill and full-bleed slide scene to OnCue --from-prompt docs/prompts/proposal-add-narrate-deck-skill.md`
