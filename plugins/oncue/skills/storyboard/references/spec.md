# short.json reference

One file describes one explainer. The deck, the voiceover script, the animated video and the storyboard canvas all read it, so an edit here flows everywhere.

The full worked example is the engine's `examples/gleaner/short.json`.

## Top level

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Name of the explainer; becomes the deck title. |
| `format` | `{ width, height }` | Pixels. `1080` × `1920` (9:16) for YouTube Shorts, Reels and TikTok; `1920` × `1080` (16:9) for a YouTube video or a landscape deck. Wider than tall uses the landscape layout, anything else the portrait one, so square and 4:5 sizes (`1080` × `1080`, `1080` × `1350`) keep its Shorts inset, leaving less room, so dense scenes shrink; the deck snaps to 9:16 or 16:9 the same way. Each side must be an even whole number from 320 to 4096 (H.264 needs even sizes), and the long side at most 2.4× the short side. A scene too big for its frame is shrunk to fit, with a warning, and every scene's scale is written to `build/fit.json`. |
| `brand` | object | Colours, logo and fonts. See below. |
| `theme` | object | Optional. Corners, type size, spacing, background and header. See below. |
| `lines` | array | One entry per beat, in order. Each beat is one voiceover line and one scene. |

## brand

| Field | Notes |
| --- | --- |
| `name` | Shown in the header of content scenes and as the reply label in chat scenes (lower-cased). |
| `logo` | Square PNG, path relative to `short.json`. |
| `colors` | Thirteen `#rrggbb` values, listed below. |
| `fonts.sans`, `fonts.mono` | `@fontsource` package names for the video, such as `plus-jakarta-sans`, `inter`, `jetbrains-mono`. Install any you add with `npm install @fontsource/<name>` in the engine folder. |
| `deckFonts.head`, `deckFonts.body` | Font names written into the .pptx. PowerPoint renders them, so prefer ones that ship with Office: Arial, Calibri, Cambria. |
| `deckFonts.mono` | Optional. The deck's font for kickers, inline code, tags and timestamps. Default `Courier New`, whatever `fonts.mono` says. |

Colours. There is no light or dark switch: text is drawn in `ink` and `muted` on `ground` and `card`, so a dark ground with light ink and a light ground with dark ink both work. On a light ground, set `theme.background` to `flat`, or to `subtle` with a light `panel`: the glows in the `panel` and `highlight` colours read as smudges on a light ground.

| Key | Used for |
| --- | --- |
| `ground` | Background, and the text and icons on `highlight` and `accent` fills: step numbers, the play button, the call-to-action pill, and in the deck the icon dots and "you" chat bubbles. |
| `card`, `chip`, `rule` | Card fill, small fills such as icon circles and timestamps, hairlines. |
| `ink`, `muted` | Main text, secondary text. Keep `muted` at 4.5:1 or better on `ground` and `card`; `check` warns when it is not. |
| `accent` | `{accent}` words in titles, kickers, icons, the reply label. |
| `highlight` | Strings, step numbers, the progress bar and the spotlight glow. |
| `you` | The "you" speaker label in chat scenes. |
| `panel`, `panelInk`, `panelMuted`, `panelRule` | The saved-result card in `card` scenes and the `steps` result bar. |

`check` computes the WCAG contrast ratio of every text-and-fill pair the renderers draw and warns below 4.5:1, naming both keys:

```text
warning: brand.colors.muted on brand.colors.card is 1.00:1; text needs 4.5:1 or more.
```

The pairs: `ink`, `muted` and `accent` on `ground` and on `card`; `highlight` on `ground`; `accent` on `chip`; `you` on `card`; `panelInk`, `panelMuted`, `accent` and `ink` on `panel`; `panelInk` on `panelRule`; `ground` on `highlight` and on `accent`. It is a warning, not an error; fix each one before showing stills.

Take these from the person's design system when they have one; [the theme guide](theme.md) maps each kind of input to these keys. The Gleaner design system's dark brand layer maps directly: `g-ground` → `ground`, `glean-string` → `highlight`, `glean-clip-bg` → `panel`, and so on.

## theme

Optional. Each key picks a named scale for today's design, and the same scale drives the video and the deck. Every key is optional: an unset key keeps today's look, and a spec without `theme` renders as before.

```json
"theme": { "radius": "soft", "density": "compact", "background": "flat", "header": "logo" }
```

| Key | Values | Changes |
| --- | --- | --- |
| `radius` | `sharp`, `soft`, `round` (default) | Corners of cards, the result panel, chat bubbles, tiles, the media player and the `steps` result bar, at ×0.2, ×0.55 and ×1. Pills and circles stay round. Deck card corners scale the same way. |
| `type` | `small`, `regular` (default), `large` | Every font size in the video and every point size in the deck, at ×0.9, ×1 and ×1.1. |
| `density` | `compact`, `regular` (default), `airy` | Gaps and paddings between and inside items in the video, and the gaps between items in the deck, at ×0.75, ×1 and ×1.3. The frame margins and the Shorts safe area do not move. |
| `background` | `glow` (default), `subtle`, `flat` | `glow`: three slow-drifting blurred lights in the `panel`, `chip` and `highlight` colours. `subtle`: the same lights at 40% strength. `flat`: the `ground` colour alone. Video only; the deck is always a flat ground. |
| `header` | `brand` (default), `logo`, `none` | The brand row on every content scene, in the video and the deck: logo and name, logo only, or nothing. `hook` and `cta` scenes have no header either way. |

`check` rejects an unknown key or value, naming the field and the allowed values: `short.json theme.radius: must be one of sharp, soft, round`, or `short.json theme.shape: is not a theme key; use radius, type, density, background, header`.

A theme changes no `vo`, so restyling after the voiceover is recorded is safe: render the stills, deck and video again; nothing is re-recorded. [The theme guide](theme.md) turns words, a DESIGN.md, design tokens, Figma, an image or a site into these values.

## lines[]

| Field | Notes |
| --- | --- |
| `vo` | Exactly what the narrator says. Start every line with a new sentence. Lines are found in the transcript by their first word at a sentence start, so the first word must survive transcription (avoid starting a line with a number or symbol). |
| `motion` | Optional production note for the storyboard. Not rendered. |
| `scene` | What appears, by `kind`. |

## Rich text

Titles, headlines, `desc` and `value` fields accept two marks:

- `{braces}` paint words in the accent colour: `"Save clips where {you already work.}"`
- `` `backticks` `` set words in mono, for things a person types: ``"Say `add this`"``

## Cues

Any element with a `cue` enters on that word of its own line:

```json
{ "word": "bookmarks", "nth": 1, "offset": 0 }
```

- `word` is matched as a prefix, ignoring case and punctuation (`"tldr"` matches "TL;DR").
- `nth` picks a later occurrence in the same line; `offset` adds seconds.
- Leave the cue out and the element is spaced evenly across its line.
- A cue word that is not in that line's `vo` produces a warning and falls back to even spacing. Choose the word that names the thing on screen.

## Scene kinds

Content kinds share `kicker` (small mono label) and `title` (rich, 1–2 lines; keep under about 45 characters).

In the landscape layout, `list`, `card`, `chat` and `steps` put the kicker and title in a column beside the body, `grid` and `media` put them above a body laid out across the width, and `hook` and `cta` stay centred.

| kind | Fields | Good for |
| --- | --- | --- |
| `hook` | `headline`, `headlineCue?`, `sub?`, `subCue?` | First beat: logo, big promise. The headline builds word by word. |
| `list` | `items[]`: `icon`, `title`, `desc?`, `cue?` (2–4 items) | Problems, features, reasons. |
| `card` | `card`: `title`, `cue?`, `meta?`, `metaCue?`, `rows[]` (`label`, `value`, `cue?`), `tags?`, `tagsCue?` | Showing an artifact or result and what it holds. |
| `chat` | `turns[]`: `from` (`"you"` or `"app"`), `text`, `cue?` (2–4 turns) | Plain-language commands and replies; "you" turns type themselves out. |
| `steps` | `steps[]`: `title`, `desc?`, `cue?` (2–4), `result?`: `text`, `cue?` | A how-to. |
| `grid` | `tiles[]`: `icon`, `label`, `cue?` (2–6; two columns, three in landscape) | Integrations, destinations, options. |
| `media` | `mediaCue?`, `moments[]`: `time`, `label`, `cue?` (2–4) | Video or audio features. |
| `cta` | `headline`, `sub?`, `subCue?`, `pill?` (`icon`, `text`, `cue?`), `follow?`, `followCue?` | Last beat: where to get it, follow prompt. |

Icons are Feather names from `react-icons/fi`: `FiLayers`, `FiBookmark`, `FiFileText`, `FiFolder`, `FiGithub`, `FiTerminal`, `FiGlobe`, `FiHardDrive`, `FiBookOpen`, `FiMessageSquare`, `FiSearch`, `FiCode`, `FiEdit3`, `FiPlay`, `FiZap`, `FiShield`, `FiClock`, `FiUsers`, and the rest of the set.
