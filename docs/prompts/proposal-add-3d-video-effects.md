---
type: proposal
intent: Add 3D effects to OnCue Shorts and videos: CSS 3D entrances (theme.depth) first, then an opt-in Three.js backdrop (theme.backdrop).
techniques: Long-context grounding, XML structure, Comparison tables, Positive framing, Output format
created: 2026-11-09
modified: 2026-11-09
status: converged
repo-name: oncue
generated-sha: e2c4602e772d3e875c7cadeebe568e305e6466df5bc01bb9ba6652b3eb1b5f31
---

# Proposal: Add 3D Video Effects

> This is a proposal for review, not an execution plan. It carries the
> grounded research and the decisions already made; the final instruction
> below hands off to drafting an execution plan from it.

<tldr>
- Every OnCue transform today is 2D (0 hits for `perspective`, `rotateX/Y`, `translate3d`, `matrix3d` in the repo). The frame loop (`renderAt(t)` then a screenshot) works unchanged for both CSS 3D and a Three.js WebGL canvas: repeated frames were byte-identical in every spike.
- Cost, measured on the Gleaner example at 1080x1920 over 150 frames, run twice: plain page 52 ms/frame; with CSS 3D entrances 54-58 ms; with a Three.js backdrop 92-94 ms (about 1.8x, roughly +100 s on the ~85 s example's ~2,550 frames).
- Proposal, in two releases: (1) a `theme.depth` key, `flat` (default) or `3d`, that swaps each kind's slide and pop entrances for two new 3D entrances, `flip` and `tilt`, with no new dependency; (2) a `theme.backdrop` key, `none` (default), `particles` or `shapes`, that draws a Three.js layer behind the cards. Both are video-only; the deck is unchanged.
</tldr>

<context>
OnCue (`plugins/oncue/`, version 1.8.0) turns one `short.json` into a storyboard, a voiceover, a `.pptx` deck and an MP4 in which every element enters on the word that names it. The engine writes an HTML scenes page and captures it frame by frame in headless Chromium, then encodes with ffmpeg.

What exists today that this touches:

- **Frames are a pure function of time.** `capture.ts:40-44` calls `window.renderAt(t)` then takes a JPEG screenshot per frame; `render.ts` sets every transform inside `renderAt` (`render.ts:47-130`). No timers, no CSS transitions (CLAUDE.md engine rule).
- **Entrances are a closed set of eight.** `up | pop | left | right | fade | drawY | drawX | type` (`render.ts:19`, `FX_SET` `:45`); unknown values throw (`:58`). Each fx case assigns `style.transform` as a whole string (`:104-121`), so a 3D entrance is just two more cases.
- **Which fx an element gets is hard-coded per kind** in `scenes.ts` `body()` (`:38-91`) through the `fx()` helper (`:26-29`). The spec has no fx field; the only motion-ish field is `lines[].motion`, a storyboard note that is not rendered (`spec.ts:93-94`).
- **Theme keys are closed enums.** `checkTheme` (`spec.ts:154-163`) rejects unknown keys and values with `short.json theme.<k>: must be one of ...`. Existing keys: `radius`, `type`, `density`, `background`, `header` (`skills/storyboard/references/spec.md:50-66`). `background` (`glow` default, `subtle`, `flat`) already controls the three drifting blurred lights and is "Video only; the deck is always a flat ground", which is the precedent for video-only keys.
- **Ambient layer.** `.blob` lights are written inside `#stage` before `#progress` (`scenes.ts:131`, `:220`) and moved in `renderAt` (`render.ts:79-82`).
- **The fit guard measures before the first frame.** `fit()` runs once before `renderAt(0)` (`render.ts:150-162`, `:176-177`) so entrance offsets do not inflate the measurement.
- **Assets are copied next to `scenes.html`.** Fonts from `node_modules/@fontsource` (`scenes.ts:95-114`), `dist/render.js` (`:116`), pictures via sharp (`:119-122`). `dist/` is committed (9 files, 79,802 bytes).
- **Launch.** `chromium.launch(launchOptions())` (`capture.ts:27`); `launchOptions` returns only `{ executablePath }` from `ONCUE_CHROMIUM_PATH` (`:14-17`). No `args`. Playwright is an optional peer `>=1.40.0`.
- **The deck reads only named fields** (`deck.ts:114-236`, 0 throws), so video-only theme keys need no deck change beyond accepting them.
- **No GPU/WebGL/SwiftShader/three.js mention** exists anywhere in the repo, including the setup skill (`skills/setup/SKILL.md:82-100`).

Why it is on the table: the person asked to explore adding Three.js to give OnCue Shorts and videos 3D effects. The exploration this session found that cheap CSS 3D covers word-synced depth on the existing cards, and Three.js earns its render cost only as a layer behind them.
</context>

<finding>
The frame-by-frame capture already accepts 3D of both kinds deterministically, so the real choice is cost and dependency, not feasibility: CSS 3D entrances cost nothing measurable and need no dependency, while a Three.js backdrop costs ~1.8x render time, a 2.1 MB library copy and two Chromium flags, so 3D belongs first in `render.ts` entrances and only then, opt-in, in a WebGL layer behind the cards.
</finding>

<comparison>
| Dimension | CSS 3D, then Three.js backdrop (chosen) | Three.js backdrop only | Three.js 3D scene kinds | Keep the current approach |
|---|---|---|---|---|
| What the viewer sees | Cards flip and tilt in on their word; later, a slow 3D particle or shape field behind everything | Existing 2D entrances over a 3D field | New beats that are 3D objects (spinning logo, product shape) | Today's 2D slides, pops, glows |
| New dependency | Phase 1 none; phase 2 `three` | `three` | `three` | none |
| Render cost (measured, ms/frame) | Phase 1 54-58; phase 2 92-94 | 92-94 | at least 92-94 (not measured with lit meshes per scene) | 52 |
| Chromium flags | Phase 2: `--allow-file-access-from-files`, `--enable-unsafe-swiftshader` | same | same | none |
| `short.json` change | Two closed theme keys | One theme key | New scene kinds, new cue slots, new loadSpec checks | none |
| Deck impact | none (video-only, like `theme.background`) | none | Needs a still or fallback slide per 3D kind | none |
| Word sync | Yes, through existing cues | Backdrop is ambient, not cued | Needs new cue slots in `cues.ts` | Yes |
| Size of change | S then M | M | L | none |
</comparison>

<decisions>
Locked and resolved — treat these as settled; do not reopen them:
1. **Approach: CSS 3D entrances first, then an opt-in Three.js backdrop.** Chosen on 2026-11-09 over "Three.js backdrop only", "Three.js 3D scene kinds" and "keep the current approach", because it delivers word-synced depth at no measurable cost and no dependency now, and confines Three.js's ~1.8x render cost to videos that ask for it.

Settled before this draft:

2. **Animation stays a pure function of time.** Both phases render only inside `renderAt(t)`; no `requestAnimationFrame`, timers or CSS transitions (CLAUDE.md). Spikes confirmed byte-identical repeats.
3. **The deck is unchanged.** PowerPoint cannot show either effect; both keys are documented as video-only, following `theme.background`.

Resolved in the 2026-11-09 review:

4. **3D entrances are chosen with `theme.depth`: `flat` (default) or `3d`.** A closed theme key validated by `checkTheme`. `flat` keeps every existing `short.json` rendering exactly as today. `3d` maps each kind's entrances to 3D variants in `scenes.ts` (Appendix A). First drafted as `theme.motion` (`flat` | `depth`); renamed in the same review because `lines[].motion` is already an unrendered storyboard note (`spec.ts:93-94`), and nothing has shipped. Propagates to: `spec.ts` theme choices, `scenes.ts` `fx()`, `render.ts` FX set, `spec.md` theme table, `theme.md`, animate-short `SKILL.md:50`.
5. **The backdrop is chosen with `theme.backdrop`: `none` (default), `particles` or `shapes`.** Coloured from the brand accent and highlight. Three.js is copied and loaded only when the value is not `none`. The default is named `none`, not `glow` as first drafted, because `glow` is already a value of `theme.background`; the two keys stay independent (the backdrop draws above the background lights). Propagates to: `spec.ts`, `scenes.ts` asset copy and markup, the backdrop module, `spec.md`, `theme.md`, setup.
6. **Three.js loads through a Chromium launch flag.** `launchOptions` adds `--allow-file-access-from-files` (three r161+ ships ES modules only, which Chrome blocks on `file://`; measured: blocked without the flag, working with it) and `--enable-unsafe-swiftshader` (Playwright 1.65 already passes it, but the peer range starts at 1.40 and `ONCUE_CHROMIUM_PATH` browsers may need it). Chosen over a virtual http origin via `page.route` and over committing a pre-bundled three under `dist/`.
7. **Two releases.** Phase 1 (`theme.depth`) ships as the next minor; phase 2 (`theme.backdrop`) as the minor after. The reel proposal also targets 1.9.0, so the number is whichever minor is next when each lands.
</decisions>

<workstreams>
### A — 3D entrances (phase 1)

- `render.ts`: add `flip` (rotateY from -85deg to 0 under `perspective(1200px)`, opacity in over the first third) and `tilt` (rotateX from 60deg to 0 plus a 40 px rise) to `Fx`, `FX_SET` and the switch. Both were spiked in a scratch copy of `dist/render.js` and render correctly mid-entrance (list card caught at t=9.65 s).
- `scenes.ts`: when `theme.depth` is `3d`, `fx()` remaps `left`/`right` to `flip` and `up`/`pop` to `tilt` for card-like elements per Appendix A; `fade`, `drawX`, `drawY`, `type` and `data-spot` are untouched. Remap at markup time so `render.ts` stays theme-agnostic.
- `spec.ts`: add `depth` to the theme choices (`spec.ts:46-57`), type and default.
- Keep 3D off static CSS: a static `perspective/rotate` rule on `.body` made the fit guard measure a wider box and shrink the scene (seen in the spike). Entrances set by `renderAt` do not, because `fit()` runs before the first `renderAt`.
- `npm run build`, commit `dist/`.

### B — Three.js backdrop (phase 2)

- Dependency: add `three` to `dependencies`; copy `node_modules/three/build/three.module.js` and `three.core.js` (658,900 + 1,474,799 bytes at r187) next to `scenes.html` only when `backdrop` is not `none`, the same way fonts are copied (`scenes.ts:105-114`).
- Markup: a `<canvas id="backdrop">` at output pixel size inside `#stage`, after the blobs and before the scenes; a `<script type="module">` that imports three and registers `window.renderBackdrop(t)`.
- Module source: a plain browser module (`// @ts-check` with JSDoc, per CLAUDE.md), because `tsconfig.json` compiles to CommonJS and `render.ts` must stay import-free. Copied from the engine like `render.js`.
- Determinism contract: `WebGLRenderer({ preserveDrawingBuffer: true, alpha: true })`, pixel ratio 1, seeded RNG for particle positions, every rotation and camera move a function of `t`, `renderer.render()` called from `renderAt(t)`.
- Boot ordering: module scripts run after classic ones; `render.ts` boot (`:166-180`) must await the backdrop's ready signal when `#backdrop` exists before setting `window.ready`.
- Boot failure: when three fails to import or `WebGLRenderer` cannot get a context, the backdrop module catches it and sets `window.bootError` to the message instead of leaving `ready` unset.
- `capture.ts` `launchOptions`: add the two flags (decision 6), keeping `executablePath` behaviour.
- `capture.ts` boot wait (`:34`): wait for `ready === true || bootError` and throw `Scenes page failed to start: <bootError>` at once, so a WebGL failure surfaces in well under the 15 s timeout, which stays only for pages that hang.

### C — Spec docs and skills

- `skills/storyboard/references/spec.md`: two rows in the theme table (`depth`, `backdrop`), plus the error text.
- `skills/storyboard/references/theme.md`: map words such as "3D", "depth", "cinematic", "particles" to the keys.
- `skills/animate-short/SKILL.md:50`: add flip and tilt and the backdrop to the effects list; note the backdrop's longer render.
- `skills/setup/SKILL.md` section 5: one check that a `backdrop` still renders non-blank (WebGL available).

### D — Tests, validation, release

- Tests per Appendix B. Browser tests skip in CI (Playwright without a browser, `.github/workflows/validate.yml`), so run them locally and confirm `skipped 0`.
- `scripts/validate.mjs` dist check (`:126-130`): add the backdrop module once it ships.
- Run `example:deck` and `example:stills` with `depth: 3d` and `backdrop: particles` and look at the frames.
- Bump `plugin.json`, add a changelog entry per release.
</workstreams>

<risks>
- **SwiftShader is deprecated as a WebGL fallback** (Chromium, from Chrome 130). Explicit `--enable-unsafe-swiftshader` keeps it working today; if Chromium removes software WebGL, the backdrop fails on GPU-less hosts. Mitigation: boot fails fast and loudly (no WebGL context sets `window.bootError`, which `capture.ts` throws immediately rather than waiting out its 15 s `ready` timeout); `none` stays the default.
- **`--allow-file-access-from-files` relaxes a protection.** It lets the generated page read other local files. The page is generated by the engine from escaped spec text and loads nothing remote. Mitigation: the flag lives only in OnCue's own launch.
- **Render time.** The backdrop roughly doubles frame time on CPU rendering. A long 16:9 YouTube video multiplies that. Mitigation: opt-in; documented in animate-short.
- **Readability.** A busy backdrop under text lowers contrast. Mitigation: low opacity defaults spiked at 0.18-0.7; `check` already warns on low-contrast colour pairs, but cannot measure a moving backdrop.
- **Measurement scope.** Timings come from one machine (macOS, SwiftShader via Playwright 1.65 Chromium), one example, 150 frames, two runs. Sandboxes and CI hardware will differ.
</risks>

<open-questions>
Decisions still owned by the human — surface them, do not answer them:
None. Every decision this approach raises is resolved above.
</open-questions>

<roadmap>
| Phase | Work | Size | Depends on |
|---|---|---|---|
| 1 | Workstream A + phase-1 parts of C and D: `flip`/`tilt`, `theme.depth`, docs, tests, release | S | none |
| 2 | Workstream B + phase-2 parts of C and D: `three` dependency, backdrop module, launch flags, setup check, tests, release | M | phase 1 merged (shares theme plumbing and docs) |
</roadmap>

<appendices>
### Appendix A — Depth remap per kind (draft for the plan)

| Kind | Element | `flat` (today) | `3d` |
|---|---|---|---|
| all content kinds | kicker, `h2` | `up` | `tilt` |
| hook | headline words | `up` | `tilt` |
| hook, cta | logo | `pop` | unchanged (`pop`; it floats) |
| list | item cards | `left` | `flip` |
| card | panel | `up` | `tilt` |
| card | rows | `left` | `flip` |
| card | tags | `pop` | `tilt` |
| chat | bubbles | `up` | `tilt` |
| steps | numbers | `pop` | unchanged |
| steps | step text | `left` | `flip` |
| steps | result | `up` | `tilt` |
| grid | tiles | `pop` | `tilt` |
| media | player | `pop` | `tilt` |
| media | moments | `left` | `flip` |
| image | photo | `pop` | `tilt` |
| any | `fade`, `drawX`, `drawY`, `type`, `data-spot` | as today | as today |

### Appendix B — Checks that prove each phase

Phase 1:
- `theme` test: `depth: "wobble"` fails with `short.json theme.depth: must be one of flat, 3d`.
- `theme` test: the example's `scenes.html` is byte-identical with `depth` unset and `depth: "flat"`; with `3d` it contains `data-fx="flip"` and no `data-fx="left"`.
- Browser test (Playwright): mid-entrance, a `flip` element's computed transform is a `matrix3d`; at entrance end it is `none` or identity.
- Fit test: `build/fit.json` is identical for `flat` and `3d`.

Phase 2:
- `theme` test: `backdrop` validation message; three files are copied only when `backdrop` is not `none`.
- `capture` test: `launchOptions()` includes both flags with and without `ONCUE_CHROMIUM_PATH`.
- Browser test: a still with `backdrop: "particles"` differs from `none` at the same `t`; rendering the same `t` twice gives identical bytes.
- Boot test: with WebGL unavailable, `capture.ts` throws the `bootError` message, not a 15 s timeout (assert the rejection arrives well under 15 s).

### Appendix C — Spike evidence (2026-11-09)

| Spike | Setup | Result |
|---|---|---|
| Standalone Three.js | r187, lit TorusKnot + 3,000 seeded points, 1080x1920, Playwright 1.65 Chromium, SwiftShader (ANGLE Vulkan) | Blocked on `file://` without `--allow-file-access-from-files` (CORS on `three.module.js`); with it, t=1.5 s twice gave identical SHA-1; 90 ms/frame vs 24 ms bare page |
| Gleaner page, plain | `examples/gleaner` scenes page, estimated timings, 150 frames from t=10 s | 52 ms/frame (both runs) |
| Gleaner page, CSS 3D | `flip`/`tilt` patched into a scratch `render.js`; list `left` to `flip`, grid `pop` to `tilt` | 54-58 ms/frame; identical repeats; flip visible mid-entrance at t=9.65 s |
| Gleaner page, Three.js backdrop | 6,000 seeded points + wireframe icosahedron at opacity 0.18, canvas in `#stage` | 92-94 ms/frame; identical repeats; text unaffected |
| Static CSS tilt | `.scene .body { transform: perspective() rotateY() }` | Fit guard shrank the scene: 3D must be applied from `renderAt`, not static CSS |

Upstream facts: Playwright 1.65 passes `--enable-unsafe-swiftshader` in its default Chromium switches (`playwright-core/lib/coreBundle.js`); Chromium deprecated automatic SwiftShader WebGL fallback from Chrome 130 (Chromium `docs/gpu/swiftshader.md`, blink-dev "Intent to Remove: SwiftShader Fallback"); three.js removed `build/three.js` and `three.min.js` in r161, and r187 ships `three.module.js` importing `three.core.js`.
</appendices>

Author an execution plan that delivers phase 1 of the roadmap (Workstream A plus the phase-1 parts of C and D: the `flip` and `tilt` entrances, the `theme.depth` key, docs, tests and release) and phase 2 (Workstream B plus the phase-2 parts of C and D: the `three` dependency, the backdrop module, the launch flags, the setup check, tests and release), in roadmap order and as two separately shippable releases. Draft real, actionable steps that name the files each one touches; do not restate the headings above as steps. Treat the locked decisions as settled inputs. Use Appendix A as the starting remap table and Appendix B as the verification each phase must pass, writing each listed test before its fix and confirming it fails first. Run `npm run build` after any engine source change and commit `dist/` with it, and finish each phase by running `npm run validate`, `npm run engine:typecheck`, `npm run engine:test` (confirming `skipped 0`), `example:deck` and `example:stills`, and looking at the frames.
