# Setting the look

The engine reads only `short.json`. It never opens a DESIGN.md, a Figma file, an image or a site. Claude reads the person's input and writes four things: `brand.colors`, `brand.fonts`, `brand.deckFonts` and `theme`. The fields and their values are in [the spec reference](spec.md).

## Rules

- **Colours by role.** Map each input colour to one of the thirteen keys by what it does (table below), not by its order in the file.
- **No invented brand colours.** Use only the colours the input has. Derive the missing roles, usually `card`, `chip`, `rule`, `muted`, `panelRule` and `you`, as tints or shades of given colours, and tell the person which ones you derived.
- **Video fonts from Fontsource.** `fonts.sans` must be an `@fontsource` package that ships weights 400, 600, 700 and 800, and `fonts.mono` one that ships 400 and 600; otherwise the engine stops with `Font file missing`. The package name is the family in lower case with hyphens: Plus Jakarta Sans is `plus-jakarta-sans`. When the brand's face is not on Fontsource or lacks a weight, pick the nearest face that has them and say so. Install it with `npm install @fontsource/<name>` in the engine folder, after the setup skill's install, which saves Playwright to `package.json` so the font install keeps it.
- **Deck fonts from Office.** PowerPoint renders `deckFonts` on the viewer's machine, so pick the nearest font that ships with Office: Arial or Calibri for a sans, Cambria for a serif, Courier New (the default) for `deckFonts.mono`.
- **Set only what the input supports.** An unset `theme` key keeps today's look. Leave a key out rather than guess.
- **Check, then show.** Run `check` and fix every contrast warning on a colour you derived. When a colour the input gave fails, do not change it silently: tell the person its ratio, offer the nearest shade that passes, and use it only once they agree. Show the stills, and lock the beats only after the person has seen the look.
- **Watch the fit.** `airy` and `large` add room that dense scenes may not have. When `stills` warns that a scene was shrunk to fit, try `regular` for that key before cutting copy, and say which you chose.
- **Safe after the voiceover.** A palette or theme changes no `vo`. Restyling means rendering the stills, deck and video again; nothing is re-recorded.

| Key | Role | Names it often has in the input |
| --- | --- | --- |
| `ground` | Page background | background, bg, surface, canvas |
| `card` | Raised surface | card, surface-raised, elevated, container |
| `chip` | Small fills: icon circles, timestamps | surface-2, subtle, secondary-container |
| `rule` | Hairlines and card borders | border, outline, divider, stroke |
| `ink` | Main text | text, foreground, on-surface |
| `muted` | Secondary text | text-secondary, muted-foreground, on-surface-variant |
| `accent` | Accent words, kickers, icons | primary, brand, link |
| `highlight` | Strings, step numbers, progress bar, glow | secondary, tertiary, attention |
| `you` | The "you" speaker label | a second warm accent, else a tint or shade of `highlight` that keeps 4.5:1 on `card` |
| `panel` | Result card and steps result bar | primary-container, inverse-surface, a deep brand fill |
| `panelInk`, `panelMuted` | Text on `panel` | on-primary-container, and a softer tint of it |
| `panelRule` | Hairlines and tags on `panel` | a tint between `panel` and `panelInk` |

## Plain words

Apply every row whose words the person used. When two rows set the same key, pick one and say which.

| Words | Values |
| --- | --- |
| playful, friendly, rounded | `radius: "round"`, `density: "airy"` |
| corporate, serious | `radius: "soft"` or `"sharp"`, `density: "regular"` |
| technical, dense, dashboard | `radius: "sharp"`, `density: "compact"` |
| editorial, calm, minimal | `background: "flat"` or `"subtle"`, `density: "airy"`, `header: "logo"` or `"none"` |
| bold, loud | `type: "large"` |
| quiet, understated | `type: "small"`, `background: "subtle"` |
| light, bright | A light-ground palette (light `ground` and `card`, dark `ink` and `muted`) with `background: "flat"`, or `"subtle"` with a light `panel`: on a light ground the glows in the `panel` and `highlight` colours read as smudges. From a dark palette, move each given colour to a role it passes in (the old `ground` becomes `ink`), derive the rest as tints or shades, and say what moved. |

## DESIGN.md

Read the YAML frontmatter between the first two `---` lines:

| Key | Becomes |
| --- | --- |
| `colors` | `brand.colors`, by role |
| `typography` | `fonts.sans` from the body or heading family, `fonts.mono` from the code family, and the nearest Office fonts for `deckFonts` |
| `rounded` | `theme.radius`, from the radius cards use, by the buckets below; with only a size scale (`sm`, `md`, `lg`), the middle step |
| `spacing` | `theme.density`, from the gap between cards or list items, by the buckets below; with only a size scale, the middle step |

Frontmatter values win. The prose body only fills a key the frontmatter leaves open, through the words table, and never sets `header`: dropping the brand name from every scene is the person's call, not the design system's.

## Design tokens and installed design systems

Read W3C DTCG or Style Dictionary JSON by `$type` (plain `type` in older Style Dictionary files), following aliases such as `{color.brand.primary}` to their value. An installed design system's `tokens.json` reads the same way.

- `color`: colour roles, by token path and description.
- `fontFamily`: `fonts` and `deckFonts`.
- `dimension`: tokens named for radius (`radius`, `rounded`, `corner`) set `theme.radius`; tokens named for spacing (`space`, `spacing`, `gap`) set `theme.density`. A dimension is `"8px"`, `"0.5rem"` or `{ "value": 8, "unit": "px" }`; count 1rem as 16px.

## Figma

Get token JSON first, from the figma-design-tokens skill (it writes W3C DTCG) or from the file's variables through the Figma connector, then read it as design tokens. With neither, ask for an export or a screenshot.

## Reference image or screenshot

Look at it yourself, or run the design-token-extractor skill when the session has it. Take `ground` from the largest background area, `ink` from the body text, and `accent` and `highlight` from the most saturated colours. Judge `radius` from the card corners, `density` from the space between items, and `background` from the ground: `flat` when it is plain, `glow` or `subtle` when it is lit. Colours picked from an image are approximate: list them and say so.

## Reference site

Fetch the page with WebFetch and ask for its stylesheet links, fetch the main stylesheet, and read the custom properties on `:root` (`--color-*`, `--radius-*`, `--space-*`) and the `font-family` values. Map them as design tokens. When the CSS is out of reach, use a screenshot as a reference image.

## Buckets

Judgement buckets for a web design system, not engine rules. The deck takes the same token, so there is nothing separate to map.

| Measure, in CSS px | Sets | Buckets |
| --- | --- | --- |
| Card corner radius | `theme.radius` | 4 or less: `sharp`. 5 to 10: `soft`. 11 or more: `round`. |
| Gap between cards or list items | `theme.density` | 8 or less: `compact`. 9 to 20: `regular`. 21 or more: `airy`. |
