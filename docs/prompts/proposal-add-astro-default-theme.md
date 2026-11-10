---
type: proposal
intent: Add an Astro-based default theme for OnCue videos, plus stroke and weight theme tokens, so new Shorts get a distinct look and new themes are one JSON file.
techniques: Long-context grounding, XML structure, Comparison tables, Positive framing, Output format
created: 2026-11-10
modified: 2026-11-10
status: converged
repo-name: oncue
generated-sha: 9d2ba5740b3ed8f683d3ba76ec3760c71a5c810114e04345e16908063b9c7b19
---

# Proposal: Add Astro Default Theme

> This is a proposal for review, not an execution plan. It carries the
> grounded research and the decisions already made; the final instruction
> below hands off to drafting an execution plan from it.

<tldr>
- OnCue's look is split: data (13 colours, fonts, 5 theme knobs) and styling hard-coded in `scenes.ts` (2px borders, 800-weight headings, pills, glow blobs).
- Astro Kit's palette fills all 13 colour roles and passes all 16 `check` contrast pairs in light and dark; its signature traits (1px hairlines, one 600 heading weight, flat ground) need two new tokens to render.
- Ship `engine/themes/astro.json` (light and dark modes), add `theme.stroke` (`bold` | `hairline`) and `theme.weight` (`heavy` | `semibold`), and have the storyboard skill copy the preset into `short.json` when no look is found.
- A new theme is one JSON file in `engine/themes/`, validated by a test that runs every mode through `loadSpec` and the contrast check.
</tldr>

<context>
- **The idea.** Give OnCue a simple, named default theme, built from the person's Astro Kit Design System, that does not copy today's look, and that is easy to customize and to copy into new themes.
- **Today's default.** There is no named default. When no look is found, `skills/storyboard/SKILL.md:18` says to use the product's logo and site, and failing that to "pick a ground (dark unless their words say otherwise), one accent and one highlight". The de facto reference look is the Gleaner sample (`engine/examples/gleaner/short.json`: dark green palette, Plus Jakarta Sans, JetBrains Mono, Arial/Calibri deck fonts) rendered through the CSS in `engine/src/scenes.ts:140-218`.
- **The look surface (measured).**
  - `brand.colors` requires all 13 roles as `#rrggbb` (`spec.ts:203-205`); `brand.fonts.sans`/`mono` and `deckFonts.head`/`body` are required (`spec.ts:206-207`). No colour or font defaults exist in the engine.
  - `theme` is optional with 5 keys (`radius`, `type`, `density`, `background`, `header`); defaults live in `look()` (`spec.ts:61-68`), multipliers in `SCALES` (`spec.ts:46-51`).
  - `scenes.ts` has 98 CSS rules: 28 use only the theme helpers, 19 mix helpers and literal px, 27 are literal px only, 24 use neither. 92 literal px values in total.
  - Hard-coded traits: 2px `--rule` borders on `.card`, `.bubble`, `.player`, `.tile`, `.photo` (lines 164, 176, 185, 191, 195); `.hr` 3px; font-weight 800 on h1/h2, `.pt`, `.num`; 999px pills on `.tag`, `.moment`, `.ts`, `.pill`; 50% circles on `.ico`, `.num`, `.play`; glow blobs (`blur(90px)`, only opacity themed via `o()`).
  - `deck.ts` draws no visible borders (each shape's line is its own fill at width 0), never reads `rule` or `you`, ignores `L.background`, and sets bold as a boolean.
  - `check` warns below 4.5:1 on 16 colour pairs (`spec.ts:179-193`, `cli.ts:87`).
  - `theme.test.mjs:158-161` asserts a spec with no theme renders byte-identical scenes HTML and deck XML to one listing every default.
- **Astro Kit.** The person's Design System artifact (https://claude.ai/artifact/HKxyaqURmUX9WE4G8TiiW4), synced from `shawn-sandy/astro-basics` `DESIGN.md` and `src/styles/_design-tokens.scss`. Seven direction colours that flip light/dark (`ink`, `ink-soft`, `paper`, `paper-sunk`, `island`, `island-bg`, `rule`), Inter 600 for headings, a system mono for labels, 8px default radius, 1px hairlines, flat surfaces, and one accent ("one lit indicator").
- **Fonts.** Fontsource Inter ships weights 100-900 (OFL-1.1), covering the engine's required 400/600/700/800. JetBrains Mono, already an engine dependency, ships 100-800.
</context>

<finding>
Astro Kit's colours map onto OnCue's 13 roles with every contrast pair passing, but its look lives in traits OnCue hard-codes (2px borders, 800 headings), so a colours-only preset would repaint today's shapes; a distinct default needs a preset file plus two new theme tokens, `stroke` and `weight`.
</finding>

<comparison>
| Dimension | Preset file + 2 look tokens (chosen) | Preset file, skill copies it | Engine preset with overrides | Keep the current approach |
|---|---|---|---|---|
| What ships | `engine/themes/astro.json` plus `theme.stroke` and `theme.weight` | `engine/themes/astro.json` only | `theme.preset: "astro"` merged by `loadSpec` | Nothing; the skill invents a palette per Short |
| Distinct from today's look | Yes: flat ground, 1px hairlines, 600 headings, teal accent | Colours only; 2px borders and 800 headings remain | Colours only; shapes remain | No |
| New theme | One JSON file | One JSON file | One JSON file | Hand-write 13 colours each time |
| Customize | Edit the block copied into `short.json` | Same | Override single keys in `short.json` | Same as today |
| `short.json` contract | Two new optional `theme` keys | Unchanged | `brand.colors`/`fonts` become optional; merge step | Unchanged |
| Engine change | `spec.ts`, `scenes.ts`, `deck.ts`, tests, `spec.md`, `dist/` | None | `spec.ts`, `spec.md`, tests | None |
</comparison>

<decisions>
Locked and resolved — treat these as settled; do not reopen them:
1. **Approach: preset file + two look tokens.** Chosen on 2026-11-10 over "preset file, skill copies it", "engine preset with overrides" and "keep the current approach", because it is the only option that renders a look distinct from today's (the request's "do not copy" constraint) while keeping new themes to one file.

Settled before this draft:

2. **Unset keys keep today's look.** `stroke` defaults to `bold` and `weight` to `heavy`, so a spec without them renders byte-identical output, as `theme.test.mjs:158-161` already asserts for the existing keys (1.4.0 changelog promise).
3. **`short.json` stays the single source of truth.** The engine reads only `short.json` (`theme.md` opening line); nothing in the render path opens a preset file.
4. **The Gleaner example keeps its own brand.** The default theme applies to new Shorts with no look, not to the bundled sample.

Resolved in the 2026-11-10 review:

5. **Loading: the storyboard skill copies the preset in.** When no look is found, the skill copies the chosen mode's `colors`, plus `fonts`, `deckFonts` and `theme`, from `oncue-engine/themes/astro.json` into the new `short.json`, keeping the product's own `name` and `logo`. No merge code in `loadSpec`; customizing means editing the copied block, the same way an earlier Short's look is reused today.
6. **Mode: light by default.** Astro Kit's primary theme (paper `#fcfcfd`, island `#0b6070`). The person's word "dark" selects the dark mode (paper `#0d1014`, island `#6bb9c9`) through the existing plain-words table.
7. **Mono: JetBrains Mono.** Astro Kit's system mono stack is not on Fontsource; JetBrains Mono is already an engine dependency, so no new package. Inter is added as the sans (`@fontsource/inter`).
8. **Deck: `stroke` draws, `weight` is a no-op.** `stroke: hairline` adds a 0.75pt `rule`-coloured line to the deck's card, bubble, tile and player shapes; `bold` keeps today's borderless deck, so default deck XML is unchanged. `weight` has no deck effect because PowerPoint bold is on/off; `spec.md` says so. Chosen over making both tokens video-only, which would break the both-renderers rule in `CLAUDE.md`.
9. **Preset density: `regular`.** Safe fit for every scene kind; `airy` stays available through the plain-words table. Chosen over `airy`, which `theme.md` warns can shrink dense scenes.
</decisions>

<workstreams>
**A — Two new theme tokens in the engine.**
- `theme.stroke`: `bold` (default; today's 2px borders and 3px `.hr`) or `hairline` (1px borders, matching Astro's `border-width-1`).
- `theme.weight`: `heavy` (default; 800 on h1/h2, `.pt`, `.num`) or `semibold` (600, Astro's single heading weight).
- Per `CLAUDE.md`'s new-field rule: type in `src/spec.ts` (`Theme`, `Look`, `look()`), validation in `checkTheme`, both renderers, rows in `skills/storyboard/references/spec.md`, then `npm run build` and commit `dist/`.
- `scenes.ts`: `stroke` sets the border width on `.card`, `.bubble`, `.player`, `.tile`, `.photo` and the `.hr` height; `weight` sets the 800s on h1/h2, `.pt`, `.num`.
- `deck.ts`: `hairline` adds a 0.75pt `rule`-coloured line to card, bubble, tile and player shapes; `bold` changes nothing. `weight` is not read; `spec.md` documents it as video-only.
- No cue slot: neither token animates.
- Tests: extend `VALUES` and `DEFAULTS` in `test/theme.test.mjs` so the existing "rejects an unknown value" loop and the byte-identical default test cover both keys; add one assertion each that `hairline` sets `.card` `border` to 1px and `semibold` sets `h2` `font-weight` to 600.

**B — The Astro preset file.**
- `plugins/oncue/engine/themes/astro.json` with `name`, `source` (the Design System URL and `shawn-sandy/astro-basics` ref), `modes.light.colors`, `modes.dark.colors`, `fonts`, `deckFonts`, `theme`. Appendix B is the full draft.
- Add `@fontsource/inter` to `engine/package.json` `dependencies`.
- A test (`test/themes.test.mjs`) that, for every `themes/*.json` and every mode, builds a spec from the Gleaner lines plus that theme, runs `loadSpec`, and asserts zero contrast warnings. This is the guard that makes "a new theme is one file" safe.

**C — Skill prose.**
- `skills/storyboard/SKILL.md` step 1: replace "pick a ground (dark unless their words say otherwise), one accent and one highlight" with "copy the Astro default theme (`oncue-engine/themes/astro.json`), light unless the person's words say dark, and say so".
- `skills/storyboard/references/theme.md`:
  - "Nothing accepted" points at the default theme instead of the invented palette.
  - A short "Default theme" section: what it is, light vs dark, that it is copied, not referenced.
  - A short "Making a new theme" section: copy `astro.json`, change values, run the theme test or `check`, and drop the file in `engine/themes/`.
  - Plain words: `editorial`, `quiet` and `technical` may also set `stroke: hairline`; `bold` may set `weight: heavy`. Keep each row's existing keys.
  - The DESIGN.md `oncue:` block (`theme.md:108-113`) gains `stroke` and `weight`, so a saved look round-trips.

**D — Release.**
- Bump `plugins/oncue/.claude-plugin/plugin.json` from 1.8.0 to 1.9.0 (engine and skill behaviour change).
- README changelog `### 1.9.0`: the default theme, the two tokens, "specs without `stroke`/`weight` render as 1.8.0".
- Run `npm run example:deck` and `npm run example:stills` on the Gleaner spec with the Astro preset applied, and look at the output in both modes.
</workstreams>

<risks>
- **1px lines in compressed video.** H.264 at 1080 px wide may soften a 1px hairline. Stop-condition: if the stills look broken after encoding, `hairline` maps to 1.5px; decide from a rendered frame, not in advance.
- **Pills and circles stay.** Astro Kit says "never pill-shaped", but `.tag`, `.moment`, `.ts`, `.pill` stay 999px and `.ico`, `.num`, `.play` stay circular. Deliberately out of scope; the two tokens cover the most visible traits. A third token is a later, separate decision.
- **Accent equals highlight.** Mapping both `accent` and `highlight` to `island` honours "one lit indicator" but removes the second colour today's scenes use for strings, step numbers and the progress bar. The look will read calmer; that is the intent, but confirm on the stills.
- **Derived colours.** `panelRule` (`#c9dfe6` light, `#1d4552` dark) is not an Astro Kit token; it is a tint between `panel` and `panelInk`. Every other role is an Astro Kit value unchanged.
- **Inter adds install weight.** One more `@fontsource` package in every engine copy. Small, but it lands in each project's `oncue-engine/`.
</risks>

<roadmap>
| Phase | Work | Size | Depends on |
|---|---|---|---|
| 1 | Workstream A: `stroke` and `weight` in `spec.ts`, `scenes.ts`, `deck.ts`, tests, `spec.md`, `dist/` | M | — |
| 2 | Workstream B: `themes/astro.json`, `@fontsource/inter`, the every-theme contrast test | S | 1 |
| 3 | Workstream C: storyboard `SKILL.md` and `theme.md` prose | S | 2 |
| 4 | Workstream D: version bump, changelog, example deck and stills in both modes | S | 3 |
</roadmap>

<appendices>
Appendix A — Colour role mapping and measured contrast

Contrast measured on 2026-11-10 with the WCAG 2 formula over the 16 pairs `check` tests (`spec.ts:179-193`), floored to two decimals as `check` does. All 32 pairs pass 4.5:1.

| Role | Astro token | Light | Dark |
|---|---|---|---|
| `ground` | `paper` | `#fcfcfd` | `#0d1014` |
| `card` | `paper-sunk` | `#f1f3f5` | `#151a20` |
| `chip` | `island-bg` | `#e6f2f6` | `#102a33` |
| `rule` | `rule` | `#dde1e6` | `#262c33` |
| `ink` | `ink` | `#101418` | `#e8eaed` |
| `muted` | `ink-soft` | `#5a6472` | `#99a2ad` |
| `accent` | `island` | `#0b6070` | `#6bb9c9` |
| `highlight` | `island` | `#0b6070` | `#6bb9c9` |
| `you` | `island` | `#0b6070` | `#6bb9c9` |
| `panel` | `island-bg` | `#e6f2f6` | `#102a33` |
| `panelInk` | `ink` | `#101418` | `#e8eaed` |
| `panelMuted` | `ink-soft` | `#5a6472` | `#99a2ad` |
| `panelRule` | derived tint | `#c9dfe6` | `#1d4552` |

| Pair | Light | Dark |
|---|---|---|
| ink on ground | 18.04 | 15.82 |
| muted on ground | 5.85 | 7.37 |
| accent on ground | 7.01 | 8.54 |
| ink on card | 16.62 | 14.51 |
| muted on card | 5.39 | 6.76 |
| accent on card | 6.46 | 7.83 |
| highlight on ground | 7.01 | 8.54 |
| accent on chip | 6.29 | 6.71 |
| you on card | 6.46 | 7.83 |
| panelInk on panel | 16.20 | 12.43 |
| panelMuted on panel | 5.25 | 5.80 |
| accent on panel | 6.29 | 6.71 |
| ink on panel | 16.20 | 12.43 |
| panelInk on panelRule | 13.37 | 8.60 |
| ground on highlight | 7.01 | 8.54 |
| ground on accent | 7.01 | 8.54 |

Status colours (`color-success`, `-warning`, `-error`, `-info`) fill no role, per `theme.md:137`.

Appendix B — Draft `engine/themes/astro.json`

```json
{
  "name": "Astro",
  "source": "Astro Kit Design System, shawn-sandy/astro-basics DESIGN.md",
  "modes": {
    "light": { "colors": {
      "ground": "#fcfcfd", "card": "#f1f3f5", "chip": "#e6f2f6", "rule": "#dde1e6",
      "ink": "#101418", "muted": "#5a6472", "accent": "#0b6070", "highlight": "#0b6070", "you": "#0b6070",
      "panel": "#e6f2f6", "panelInk": "#101418", "panelMuted": "#5a6472", "panelRule": "#c9dfe6" } },
    "dark": { "colors": {
      "ground": "#0d1014", "card": "#151a20", "chip": "#102a33", "rule": "#262c33",
      "ink": "#e8eaed", "muted": "#99a2ad", "accent": "#6bb9c9", "highlight": "#6bb9c9", "you": "#6bb9c9",
      "panel": "#102a33", "panelInk": "#e8eaed", "panelMuted": "#99a2ad", "panelRule": "#1d4552" } }
  },
  "fonts": { "sans": "inter", "mono": "jetbrains-mono" },
  "deckFonts": { "head": "Arial", "body": "Arial" },
  "theme": { "radius": "soft", "background": "flat", "density": "regular", "type": "regular",
             "header": "brand", "stroke": "hairline", "weight": "semibold" }
}
```

- `radius: soft` scales the 36px card corner to about 20px on the 1080 px canvas, the nearest existing step to Astro's `radius-lg`.
- `background: flat` removes the glow blobs; the word-cue spotlight in `render.ts` stays, in `island`, as the one lit indicator.
- `deckFonts` uses Arial for both, Astro Kit's one-face-for-headings rule mapped to an Office font.

Appendix C — How a Short uses it (worked example)

1. Person: "Make a Short about our CLI." No look given; the "Spotting a look" search finds nothing.
2. Storyboard skill reads `oncue-engine/themes/astro.json`, takes `modes.light.colors`, `fonts`, `deckFonts`, `theme`, and writes them into `short.json` beside the product's `name` and `logo`. It says: "Using the Astro default theme, light mode."
3. Person: "make it dark, and use orange for the accent." Skill swaps in `modes.dark.colors`, sets `accent` only, runs `check`, and reports any pair that drops under 4.5:1.
</appendices>

Author an execution plan that delivers Workstreams A through D in roadmap order. Draft real, actionable steps naming the files each one touches in `plugins/oncue/` — do not restate the headings above as steps. Treat the locked decisions as settled inputs. Name each step's check before its work: a failing test for each new token written before the renderer change, the every-theme contrast test, and the example deck and stills in both modes run and looked at before the version bump. To start, run:
`/plan-agent:implementation-plan Add an Astro-based default theme and the stroke and weight theme tokens to OnCue --from-prompt docs/prompts/proposal-add-astro-default-theme.md`
