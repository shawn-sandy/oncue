---
status: completed
type: feature
created: 2026-10-25
repo-name: oncue
effort: medium
artifact-url: https://claude.ai/artifact/3aKSmsRaDRragAh4xuXjs4
glance: Every OnCue Short used the same eight layouts with only colours, a logo and fonts swapped. OnCue 1.4.0 adds a theme layer, five named tokens for corners, type size, spacing, background and header that drive the video and the deck (background the video only), and the storyboard skill maps words, a DESIGN.md, design tokens, Figma, an image or a site onto them. check now warns on low-contrast colours, and Gleaner without a theme renders pixel-identical stills.
---

# Plan: User-driven board design for OnCue

> **Implemented in OnCue 1.4.0 (Phase 1).** Built with the recommended answers to the open decisions, except decision 4, which 1.3.0 overtook by shipping 16:9 and custom sizes. Findings 1 and 2 under Current state predate 1.3.0.

## Context

OnCue turns a topic into a vertical explainer Short. The storyboard skill writes `short.json`, the voiceover skill records and transcribes it, and the engine in `plugins/oncue/engine/` renders a 9:16 PowerPoint deck (`src/deck.ts`) and a word-synced MP4 from a scenes page (`src/scenes.ts`, animated by `src/render.ts`). An end-to-end test of the Gleaner example and a second OnCue-branded Short showed that every video is the same template: the person controls 13 colours, a logo, a name, two video fonts and two deck fonts, and nothing else. The request is that "the design should be flexible and based on the user input".

Constraints any option has to respect (from `CLAUDE.md`):

- Animation stays a pure function of time: no timers, no CSS transitions, so frame capture is deterministic.
- The deck and the video show the same beats. A new `short.json` field needs its type in `src/spec.ts`, validation in `loadSpec`, both renderers, a cue slot in `src/cues.ts` if it animates, and a row in `skills/storyboard/references/spec.md`.
- `dist/` is committed; Playwright stays an optional peer, so `deck` must keep working without Chromium.
- Existing specs keep rendering the same; the Gleaner example is the regression baseline.

Related plan: `docs/plans/add-research-and-visuals-skills.md` (on main) adds an `image` scene kind inside the existing `.content` box, a `node:test` engine test setup (`test/*.test.mjs`, `npm run engine:test`), and makes `writeScenes` async. Nothing here conflicts with it: the image frame picks up the theme's radius and density through the same CSS tokens, and Phase 1 reuses its test setup if that lands first. Both plans edit the CSS template in `src/scenes.ts` and `src/spec.ts`, so whichever lands second rebases.

## Current state

What decides the look today, checked against the source at `6f0f76d`.

| Dimension | Where it is fixed | Person controls it today? |
| --- | --- | --- |
| Colours | 13 `#rrggbb` roles (`Colors`, `src/spec.ts:17`) become CSS custom properties (`src/scenes.ts:118`) and deck fills | Yes |
| Logo, name | `brand.logo`, `brand.name`; the name is also the chat reply label | Yes |
| Video fonts | `@fontsource` packages, latin only; sans must ship weights 400, 600, 700 and 800 and mono 400 and 600, or `fontFile` throws (`src/scenes.ts:86-105`) | Partly |
| Deck fonts | `deckFonts.head`, `deckFonts.body`; every mono run is hardcoded to Courier New (`src/deck.ts:34,53,91,139`) whatever `fonts.mono` says | Partly |
| Stage | 1080 x 1920 `#stage` scaled by `width / 1080` (`src/scenes.ts:109,120`) | No |
| Margins and boxes | `.content` 90 px sides, 230 px top, 360 px bottom; `.center` 260 / 340 (`src/scenes.ts:129-130`); deck margin 0.5", content 3.8" to `H - 1.4"` (`src/deck.ts:15,56-57`) | No |
| Type sizes | 23 literal `font-size` values, from `h2` 80 px, `.hookline` 104 px and `.cta` 120 px down (`src/scenes.ts:131-170`); deck point sizes inline per kind | No |
| Corner radius | Cards 36 px, panel 44 px, bubbles and result bar 30 px, pills 999 px; deck `rectRadius: 0.18` on every card (`src/deck.ts:37`) | No |
| Background | Three blurred blobs in `panel`, `chip` and `highlight` at opacity 0.55 (0.12 for the third), drifting (`src/scenes.ts:121-124`, `src/render.ts:74-77`); deck is flat `ground` | No |
| Header | Logo plus name on every content scene, progress bar across the top (`src/scenes.ts:110-112,125`) | No |
| Motion | Fixed easing, 0.55 s default entrance, 70 px rise, 120 px slide, scene push-in, logo float, spotlight glow (`src/render.ts:59,78-121`) | No |
| Layout per kind | One markup per kind in `body()` (`src/scenes.ts:32-82`) and one slide layout per kind in `slideFor` (`src/deck.ts:59-156`) | No |
| Scene kinds | Eight, in `KINDS` (`src/spec.ts:77`) | No |
| Aspect ratio | `format` accepts any width and height (`src/spec.ts:87`) | Accepted, renders broken |

Measured in a scratch copy of the engine (outside the repo; the prototype patch is in the shared notes folder as `patch-proto.cjs`):

1. **Square (1080 x 1080) is broken in both outputs.** The video clips the 1920 px layout at 1080 px, so the bottom 840 px of every scene is lost (the hook headline is cut in half). The deck writes 30 shapes with a negative height on 5 of 9 slides, because list, chat, steps and grid heights come from `(bottom - top) / n - gap` with `bottom - top` at 0.43".
2. **16:9 (1920 x 1080) is worse.** The stage scales by 1.78, so the frame shows only the header band; the deck has 31 negative-height shapes and shapes past the slide edge on all 9 slides.
3. **A light palette mostly works with colours alone.** A cream ground with dark ink rendered legibly in every kind; the one defect is the `panel`-coloured background blob, which reads as a dark smudge behind the header. spec.md's "the layouts assume light text on a dark ground" overstates the limit.
4. **The deck is the video at 192 px per inch** (1080 px over 5.625"). pptxgenjs treats `rectRadius` as inches (`adj = r * 914400 * 100000 / min(w, h)` in `pptxgen.cjs.js`), so the deck's 0.18" corner is the video's 36 px card corner, and an 80 px title is about 30 pt against the deck's 32 pt. One scale can drive both renderers.
5. **Nothing reports layout that does not fit.** A 92-character list title plus a fourth item ran 15 px past its box with today's sizes and 187 px under `type: "large"` and `density: "airy"`, where the kicker landed on the brand row; `stills` printed no warning either time. Measuring `scrollHeight - clientHeight` on each scene's `.content` or `.center` box in Chromium found that scene and no other, including none of the unmodified Gleaner beats under `large` and `airy`.
6. **One existing deck pair is low contrast.** The deck's "you" chat bubble and the icon dots draw `panelInk` on `highlight`: 2.71:1 for Gleaner (`#ffffff` on `#d98a62`). Every video text pair measured 4.97:1 or better (the lowest is the tag chips, `panelInk` on `panelRule`).
7. **A theme-token prototype keeps Gleaner identical.** With no `theme` block, all 9 Gleaner stills had 0 differing bytes against the unpatched engine and all 9 slide XML files were byte-identical. With `{ radius: "sharp", type: "small", density: "compact", background: "flat", header: "logo" }` and with a light palette plus `{ radius: "round", type: "large", density: "airy", background: "subtle" }`, all 9 beats rendered in both outputs. `theme.radius: "pill"` failed `check` with `short.json theme.radius: must be one of sharp, soft, round`.

## What "user input" can mean

Every route ends in the same place: Claude translates the input into `short.json` fields, and the engine only reads `short.json`. The engine never parses DESIGN.md, Figma or images, which keeps it deterministic, keeps `loadSpec` the single validation point, and matches the research plan's rule that the engine never reads `research.md`.

| Input | What Claude reads | Becomes |
| --- | --- | --- |
| Plain words ("playful, light, rounded") | A word-to-token table in a new `references/theme.md` | Palette plus `theme` values |
| DESIGN.md | YAML frontmatter `colors`, `typography`, `rounded`, `spacing` (the shape the `design-system-from-design-md` skill reads) | Colours by role, fonts, radius and density buckets |
| Design tokens (W3C DTCG JSON, Style Dictionary) | Tokens by `$type`: color, fontFamily, dimension | Same mapping |
| Figma | Token JSON from the `figma-design-tokens` skill or the Figma connector (it needs authorising with `/mcp` in this account) | Same mapping |
| Reference image or screenshot | Claude's own vision, or the `design-token-extractor` skill | Palette, plus a judged radius, density and background |
| Reference site | The site's CSS custom properties through WebFetch | Same mapping |
| Installed claude.ai design system | Its `tokens.json` | Same mapping |

A theme changes no `vo`, so, like the visuals plan's pictures, restyling is safe after the voiceover and never costs a re-record.

## Dimensions to open, and how far

| Dimension | When | Form | Deck |
| --- | --- | --- | --- |
| Palette | Open today | Add contrast warnings to `check` | Same colours |
| Light or dark | Phase 1 | No new field: a light palette plus `background: "subtle"` or `"flat"` (finding 3) | Ground colour |
| Corner radius | Phase 1 | `radius`: `sharp`, `soft`, `round` (x0.2, x0.55, x1 of today's radii; pills stay pills) | `rectRadius` x the same scale |
| Type scale | Phase 1 | `type`: `small`, `regular`, `large` (x0.9, x1, x1.1 on every font size) | Point sizes x the same scale |
| Density | Phase 1 | `density`: `compact`, `regular`, `airy` (x0.75, x1, x1.3 on gaps and paddings) | Gaps x the same scale |
| Background | Phase 1 | `background`: `glow` (today), `subtle` (blobs at 0.22), `flat` (none) | Already flat |
| Header | Phase 1 | `header`: `brand` (today), `logo`, `none` | Brand row the same way |
| Deck mono font | Phase 1 | Optional `deckFonts.mono`, default Courier New | Mono runs |
| Fit and contrast guards | Phase 1 | Warnings in `stills`, `video` and `check` | Contrast pairs include deck-only pairs |
| Progress bar | Phase 1 candidate, not prototyped | `progress`: `true` or `false` | None |
| Motion | Phase 2 | `motion`: `lively` (today), `calm` (shorter travel, longer ease, no float), `still` (fades only); scalars read once at setup, so still a pure function of time | None (deck shows final state) |
| Font weights | Phase 2 | Fall back to the nearest shipped weight, so display faces with one weight work | None |
| Layout variants per kind | Phase 2 | `scene.variant`, for example `list`: `cards`, `plain`, `numbered`; `grid`: 2 or 3 columns; same fields, so `cues.ts` and the timeline do not change | One deck layout per variant |
| Aspect ratios (1:1, 16:9) | Separate track | Per-format layout boxes in both renderers; the Shorts safe area only applies to 9:16 | Per-format positions |
| Custom kinds or free HTML | Only on demand | Options D and E below | Weakest point |

## Options

Light to heavy. A is the baseline.

| | A. Keep re-skin only | B. Theme tokens | C. Layout variants | D. Template plugin point | E. Claude writes scene HTML/CSS in guard rails |
| --- | --- | --- | --- | --- | --- |
| What the person can change | Colours, logo, fonts | B's five tokens on top of A | Per beat, which arrangement of a kind | Any markup for a kind, from a project `templates/` folder | Any scene |
| Determinism | Unchanged | Unchanged: CSS custom properties, no new animation | Unchanged: same `fx` and cue slots | Holds if the engine rejects `transition`, `animation` and `<script>` in templates | Same lint; quality varies per run |
| Deck in step | Yes | Yes: one scale per token at 192 px per inch (finding 4) | Yes, if every variant gets a deck layout | Needs a matching deck template or falls back to a picture | Final frame as a PNG slide: not editable, and `deck` would need Playwright |
| How the storyboard skill writes it | As today | Picks enum values from the `references/theme.md` table | Picks a variant per beat | Writes or copies template files | Writes HTML and CSS into the spec |
| Validation | `loadSpec` | `loadSpec` enums naming `theme.<key>`; fit and contrast warnings | `loadSpec` per-kind variant enums | Engine must check every cue slot appears in the markup | Same as D, plus a sanitiser |
| Existing specs | Unchanged | Unchanged (finding 7) | Unchanged: no `variant` means today's layout | Unchanged | Unchanged |
| Cost | None | About 14 files, one release | About 2 renderer cases per variant | New contract, loader and checks | New contract, sanitiser, deck capture |
| Main risk | The ask is unmet | Enums feel limiting | Variant count grows in two renderers | Deck parity breaks | Off-brand or broken scenes; non-editable deck |

## Recommendation

Start with **B, theme tokens**, then add **C, layout variants** for the kinds people actually ask to change. Defer D and E until B and C are shown to fall short, and treat other aspect ratios as their own track.

- B covers most of the gap between "re-skinned template" and "my design": shape, scale, spacing, background and header are what make two brands look different once colours match.
- B is proven cheap and safe: the prototype added the five tokens with defaults equal to today's literals, and Gleaner's stills and slides stayed identical.
- Enums, not raw numbers: they validate cleanly, map to the deck with one multiplier each, and give Claude a small target when translating "playful" or a DESIGN.md. Raw values can come later as an escape hatch if enums prove too coarse.
- The fit and contrast guards matter more once input drives the look, and they catch problems that exist today (findings 5 and 6).

## Open decisions

Each has a recommended answer; Phase 1 below assumes the recommended ones.

1. **Direction.** Recommended: B now, C next. Alternatives: go straight to C or E, or keep A.
2. **Token form.** Recommended: named enums (`sharp`, `soft`, `round`). Alternative: raw numbers (`radius: 24`), more freedom, harder to keep the deck in step and to translate from words.
3. **Motion in Phase 1.** Recommended: no, Phase 2. It touches `src/render.ts` and needs its own timing review.
4. **Non-9:16 formats now.** Recommended: make `loadSpec` reject any `format` that is not 9:16 in Phase 1, naming the field, until per-format layouts exist, instead of rendering the broken output in findings 1 and 2. Overtaken: 1.3.0 (#14) renders 16:9 and custom sizes, so no guard was added.
5. **The Gleaner deck's 2.71:1 pair.** Recommended: switch the deck's "you" bubble text and icon-dot glyphs from `panelInk` to `ground` (6.42:1 for Gleaner), accepting that slide 4's bubble and the icon dots change in the Gleaner deck. Alternative: leave it and let the new contrast check report it.
6. **Where restyling lives.** Recommended: a "Look" step in the storyboard skill plus `references/theme.md`, no new skill. Alternative: a separate `style` skill, if restyling after the voiceover turns out to be a common request on its own.
7. **Order against the research and visuals plan.** Recommended: land Phase 1 after that plan's 1.3.0, so the `image` frame is themed from day one and the test setup already exists. Alternative: land first and let the visuals phase adopt the tokens.

## Objective

Let the person's own design input (words, a DESIGN.md, tokens, Figma, a reference image or site) change the shape, scale, spacing, background and header of every beat in both the video and the deck, while specs without that input render exactly as before.

## Steps

Phase 1 only, with the recommended answers to the open decisions; decision 4 was overtaken by 1.3.0.

1. [x] Write the failing engine tests: a new `plugins/oncue/engine/test/theme.test.mjs` (theme validation, contrast, both renderers under each token), theme extremes in `test/deck.test.mjs`, and theme fit cases in `test/fit.test.mjs`, on the `node:test` setup that 1.3.0 shipped. Why: the tests must fail before the change to prove they test it, and the existing files already hold the deck-measuring and stills helpers. Verify: before the change, `npm test` failed 27 new cases, each on its assertion, not on an import or syntax error.
2. [x] Add an optional `theme` to `Spec` in `plugins/oncue/engine/src/spec.ts` with `radius`, `type`, `density`, `background` and `header`, exported scale tables (`SCALES`, `HEADERS`) whose defaults are x1, and a `look()` helper both renderers read; make `loadSpec` reject an unknown key (prototype names such as `toString` included) or value naming `theme.<key>` and the allowed values, and accept an optional `brand.deckFonts.mono`. No 9:16 guard: 1.3.0 (#14) renders 16:9 and custom sizes, which overtook open decision 4. Why: `CLAUDE.md` requires the type and validation first, and every input route funnels through this one check. Verify: `npm run build && npm test` passes every theme validation case.
3. [x] In the CSS template in `plugins/oncue/engine/src/scenes.ts`, write each font size, gap, padding and card corner as today's px times its scale, computed when the page is written, omit the blob divs for `flat`, and render the header as logo plus name, logo only, or nothing. Pills, circles and line caps keep their fixed values. Why: every default multiplies by 1, so no existing pixel moves. Verify: the scenes assertions in theme.test.mjs pass.
4. [x] Apply the same scales in `plugins/oncue/engine/src/deck.ts`: card corners times the radius scale (the call-to-action pill keeps its corner, as the video's pill stays round), every point size times the type scale through the one `text()` helper, gaps between items times the density scale, the brand row per `header`, mono runs in `deckFonts.mono ?? "Courier New"`, and `ground` instead of `panelInk` for the "you" bubble text and icon-dot glyphs on `highlight`. Why: one token drives both renderers at 192 px per inch, so the deck stays in step. Verify: the deck assertions in theme.test.mjs pass, and deck.test.mjs finds no negative or off-slide shape under `large` + `airy` and `small` + `compact` at 9:16 and 16:9.
5. [x] Report layout that does not fit. 1.3.0's fit guard already measures each scene's `.content` or `.center` box in `src/render.ts` before the first frame, shrinks one that overflows, and has `stills` and `video` warn naming the scene and write `build/fit.json`; this plan adds the theme cases to `test/fit.test.mjs`. Why: once titles, type and density come from the person, overflow would otherwise land on the header and the Shorts buttons (finding 5). Verify: fit.test.mjs passes locally with Chromium: a 92-character list title over four items is named with no theme and under `type: "large"`, which shrinks it further, and Gleaner at 9:16 warns for no scene; it skips with a printed reason without Chromium.
6. [x] Warn on low contrast in `check` in `plugins/oncue/engine/src/cli.ts`, computing the WCAG ratio for every text pair the two renderers draw (ink, muted and accent on ground and card; highlight on ground; accent on chip; you on card; panelInk, panelMuted, accent and ink on panel; panelInk on panelRule; ground on highlight and accent) and warning below 4.5:1, naming both keys, with the ratio rounded down so a failing pair never prints as 4.50. Why: palettes taken from images, sites or words are where bad input hurts legibility, and spec.md already asks for 4.5:1. Verify: the contrast cases in theme.test.mjs pass and `npm run example:check` prints no contrast warning for Gleaner.
7. [x] Teach the storyboard skill to set the look: a "Look" bullet in step 1 of `plugins/oncue/skills/storyboard/SKILL.md` that lists the input routes and says a theme is safe after the voiceover, a `theme` section and the optional `deckFonts.mono` row in `skills/storyboard/references/spec.md` (replacing the dark-ground note), a new `skills/storyboard/references/theme.md` with the word, DESIGN.md, DTCG, Figma, image and site mappings, and matching notes in the `animate-short` and `vertical-deck` skills. Why: Claude, not the engine, translates input, so the mapping has to be written down where the skill reads it. Verify: `npm run validate` passes its link checks and `grep -c "theme" plugins/oncue/skills/storyboard/references/spec.md` counts 8 lines, up from 0.
8. [x] Rebuild and run the example end to end: `npm run build`, `npm run example:check`, `npm run example:deck` and `npm run example:stills`, then compare the Gleaner stills and slides with ones rendered from main's `dist/` in a scratch folder. Why: `dist/` is committed, and the Gleaner example is the baseline that must not move. Verify: all 9 stills have 0 differing pixels against main's, the slide XML differs only in the three "you" bubble runs (decision 5), and the example prints no warnings.
9. [x] Release 1.4.0: bump `version` in `plugins/oncue/.claude-plugin/plugin.json`, add a `theme` keyword, add the theme to the README's "How it works" and its brand bullet, and add a changelog entry to the README's Changelog. Why: `CLAUDE.md` asks for a bump when what the engine does changes. Verify: `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0, with 67 tests passing and none skipped.

## Files

- plugins/oncue/engine/src/spec.ts (modified) — `Theme` type, `SCALES`, `HEADERS`, `look()`, theme checks, `contrast()` and `contrastWarnings()`, `deckFonts.mono`
- plugins/oncue/engine/src/scenes.ts (modified) — theme-scaled sizes, background and header options
- plugins/oncue/engine/src/deck.ts (modified) — radius, type, density, header, mono font, ground-on-highlight text
- plugins/oncue/engine/src/cli.ts (modified) — contrast warnings in `check`
- plugins/oncue/engine/dist/ (generated) — rebuilt with `npm run build` and committed
- plugins/oncue/engine/test/theme.test.mjs (new) — validation, contrast, both renderers under each token
- plugins/oncue/engine/test/deck.test.mjs (modified) — theme extremes keep every shape valid and on the slide
- plugins/oncue/engine/test/fit.test.mjs (modified) — fit warnings for a long title, under `type: "large"`, and Gleaner at 9:16
- plugins/oncue/skills/storyboard/SKILL.md (modified) — the "Look" bullet
- plugins/oncue/skills/storyboard/references/spec.md (modified) — `theme` section, `deckFonts.mono`, contrast pairs, light-ground note
- plugins/oncue/skills/storyboard/references/theme.md (new) — input-to-token mappings
- plugins/oncue/skills/animate-short/SKILL.md (modified) — the look comes from `brand` and `theme`
- plugins/oncue/skills/vertical-deck/SKILL.md (modified) — `deckFonts.mono` and the theme in the deck
- plugins/oncue/.claude-plugin/plugin.json (modified) — version 1.4.0 and `theme` keyword
- README.md (modified) — "How it works", the brand-and-look bullet, changelog

## Tests

> Tier: 1 (code-touching)

### Objective-Verification Test

- **File:** `plugins/oncue/engine/test/theme.test.mjs`
- **Type:** smoke test against the committed `dist/`
- **Asserts:** the Gleaner spec with `theme: { radius: "sharp", header: "none", background: "flat" }` produces a scenes page with no `.blob` and no `.brand` element and a `.card` corner of 7.2px (a fifth of 36px), and a deck whose list slide corner `adj` values are a fifth of the unthemed deck's and which holds no brand-name run or brand-row logo (the hook and call-to-action logos stay); the same spec without `theme` writes the same scenes page and slide XML as a spec whose `theme` lists every default.
- **Run:** `npm run engine:test`

### Unit Tests

- **File:** `plugins/oncue/engine/test/theme.test.mjs`
- **Targets:** `loadSpec`, `contrast`, `contrastWarnings`, `check`
- **Key cases:** an unknown key (`shape`, `toString`, `__proto__`) and an unknown value for each key name the field and list the values, a theme that is not an object is rejected, every value and no theme are accepted, `deckFonts.mono` must be a non-empty string, the WCAG formula gives 21:1 and 4.54:1 on known pairs, Gleaner's palette gives no warning, `muted` equal to `card` warns naming both keys, accent and ink on panel are checked, 4.498:1 prints as 4.49, and `check` prints the warnings and exits 0.

### Integration Tests

- **File:** `plugins/oncue/engine/test/theme.test.mjs`, `plugins/oncue/engine/test/deck.test.mjs`
- **Targets:** `writeScenes`, `writeDeck`
- **Key cases:** each value sets its scaled size (today's values pinned for the defaults), `subtle` sets the glow to 0.22 and `flat` removes it, `logo` keeps the logo and drops the name in both outputs, `type` scales point sizes, `density` spreads or closes up the list rows, `deckFonts.mono` reaches the mono runs and Courier New stays without it, the "you" bubble text is `ground`, the call-to-action pill ignores `radius`, and the extreme combinations produce no negative-height or off-slide shape at 9:16 and 16:9.

### E2E Tests

- **File:** `plugins/oncue/engine/test/fit.test.mjs`
- **Targets:** `stills` and the fit warnings in headless Chromium
- **Key cases:** a beat with a 92-character title and four list items is shrunk and named, both with no theme and under `type: "large"`, which shrinks it further; the Gleaner example at 9:16 warns for no scene; the tests skip with a printed reason when Playwright or Chromium is missing, which counts as unverified, not passed.

## Acceptance Criteria

- [x] A spec without `theme` renders Gleaner's stills with 0 differing pixels and its slide XML unchanged, apart from the decided highlight text pair.
- [x] Each of the five tokens visibly changes the stills, and every token but `background` changes the deck (the deck has always had a flat ground, as the Dimensions table says).
- [x] `node dist/cli.js check` rejects an unknown theme key or value, naming the field. The non-9:16 `format` guard was dropped: 1.3.0 renders 16:9 and custom sizes, and `format.test.mjs` still covers the sizes it rejects.
- [x] `stills` names every scene whose content overflows its box.
- [x] `check` warns on any drawn text pair under 4.5:1 and prints none for Gleaner.
- [x] Given "playful, light, rounded" or a DESIGN.md, the storyboard skill writes a palette and `theme` that pass `check`, and shows stills before locking the beats.

## Verification

In a scratch project, copy `plugins/oncue/engine/examples/gleaner`, ask Claude to "make it light, playful and rounded", and confirm `short.json` gains a light palette and a `theme` while every `vo` stays the same. Run `node dist/cli.js check`, `stills` with the example's `--words` and `--audio`, and `deck`: no warnings, and the stills and slides show the new look. Then render the original example with main's `dist/` and with the branch's `dist/` into two folders and compare the stills byte for byte: 0 differences. Finish with `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exiting 0.

## Next Steps

- Motion styles (Phase 2)
  Lets the person pick calmer or stiller motion than today's.
  ```text
  In the oncue repo (github.com/shawn-sandy/oncue), add `theme.motion` with values lively (today), calm and still to plugins/oncue/engine/src/spec.ts and loadSpec. In src/render.ts read scalars once in setup() from CSS custom properties on :root (travel distance, default duration, float amplitude, blob drift, scene push-in) so renderAt(t) stays a pure function of time, and set them from the theme in src/scenes.ts. Add node:test cases that render one still at a fixed t under each value and check the elements' transforms differ as expected, and confirm Gleaner's stills are pixel-identical with no theme. Document it in skills/storyboard/references/spec.md and theme.md, rebuild dist/, bump the minor version and add a README changelog entry.
  ```
- Layout variants for list and grid (Phase 2)
  The first per-kind variants, chosen per beat.
  ```text
  In the oncue repo, add an optional `variant` to the list scene (cards, plain, numbered) and the grid scene (two or three columns) in plugins/oncue/engine/src/spec.ts, validated per kind in loadSpec. Keep the fields and cue slots the same so src/cues.ts and src/timeline.ts do not change. Add the markup and CSS for each variant in src/scenes.ts and a matching layout in src/deck.ts, using the theme tokens. Add node:test cases for each variant in both renderers and confirm specs without `variant` render identically. Document the variants in skills/storyboard/references/spec.md, rebuild dist/, bump the minor version and add a README changelog entry.
  ```
- Square and landscape formats (separate track)
  Turns the Phase 1 format guard into real 1:1 and 16:9 layouts.
  ```text
  In the oncue repo, make the engine render 1080 x 1080 and 1920 x 1080 as well as 1080 x 1920. Today src/scenes.ts fixes a 1080 x 1920 stage scaled by width / 1080, which crops square and landscape video, and src/deck.ts computes negative heights for list, chat, steps and grid. Propose per-format layout boxes for both renderers (the Shorts safe area applies to 9:16 only), prototype them in a scratch copy, and report stills and deck bounds for all three formats before changing the repo.
  ```

## Unresolved Questions

- Text overflow inside PowerPoint text boxes:
  ```text
  In the oncue repo, find out whether a pptxgenjs text box written with `fit: "shrink"` shrinks its text when the .pptx is opened in PowerPoint and Keynote, or only after the text is edited, using pptxgenjs 4.x as installed in plugins/oncue/engine. The deck uses fixed box heights, so a larger type scale may overflow them. Recommend shrink-to-fit, a measured layout, or a smaller deck type scale.
  ```
- Font weight coverage on @fontsource:
  ```text
  In the oncue repo, plugins/oncue/engine/src/scenes.ts copies @fontsource weights 400, 600, 700 and 800 for the sans font and 400 and 600 for mono, and throws when one is missing. Survey which popular @fontsource families lack one of those weights, and whether @fontsource-variable packages could replace the fixed weights. Recommend a fallback rule.
  ```

## Resources

- plugins/oncue/engine/src/spec.ts, scenes.ts, deck.ts, render.ts, cues.ts, capture.ts, cli.ts: the engine at `6f0f76d`
- plugins/oncue/skills/storyboard/SKILL.md and references/spec.md: how brand input is gathered today
- docs/plans/add-research-and-visuals-skills.md: the `image` kind and the engine test setup this plan builds on
- Shared notes folder for this session group: `patch-proto.cjs` (the scratch prototype), `deckbounds.cjs` (deck edge and negative-height check), and the contact sheets
- plugins/oncue/engine/node_modules/pptxgenjs/dist/pptxgen.cjs.js: `rectRadius` to `adj` conversion
- [OnCue user-driven design](https://claude.ai/artifact/MdM5vjSu36zacxZgkhbsVN): the proposal page, with the prototype stills, options table and open decisions
