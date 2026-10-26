# short.json reference

One file describes one explainer. The deck, the voiceover script, the animated video and the storyboard canvas all read it, so an edit here flows everywhere.

The full worked example is the engine's `examples/gleaner/short.json`.

## Top level

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Name of the explainer; becomes the deck title. |
| `format` | `{ width, height }` | Pixels. `1080` × `1920` (9:16) for YouTube Shorts, Reels and TikTok; `1920` × `1080` (16:9) for a YouTube video or a landscape deck. Wider than tall uses the landscape layout, anything else the portrait one, so square and 4:5 sizes (`1080` × `1080`, `1080` × `1350`) keep its Shorts inset and every scene shrinks; the deck snaps to 9:16 or 16:9 the same way. Each side must be an even whole number from 320 to 4096 (H.264 needs even sizes), and the long side at most 2.4× the short side. A scene too big for its frame is shrunk to fit, with a warning, and every scene's scale is written to `build/fit.json`. |
| `brand` | object | Colours, logo and fonts. See below. |
| `lines` | array | One entry per beat, in order. Each beat is one voiceover line and one scene. |

## brand

| Field | Notes |
| --- | --- |
| `name` | Shown in the header of content scenes and as the reply label in chat scenes (lower-cased). |
| `logo` | Square PNG, path relative to `short.json`. |
| `colors` | Thirteen `#rrggbb` values, listed below. |
| `fonts.sans`, `fonts.mono` | `@fontsource` package names for the video, such as `plus-jakarta-sans`, `inter`, `jetbrains-mono`. Install any you add with `npm install @fontsource/<name>` in the engine folder. |
| `deckFonts.head`, `deckFonts.body` | Font names written into the .pptx. PowerPoint renders them, so prefer ones that ship with Office: Arial, Calibri, Cambria. |

Colours, for a dark ground (the layouts assume light text on a dark background):

| Key | Used for |
| --- | --- |
| `ground` | Background. |
| `card`, `chip`, `rule` | Card fill, small fills such as icon circles and timestamps, hairlines. |
| `ink`, `muted` | Main text, secondary text. Keep `muted` at 4.5:1 or better on `card`. |
| `accent` | `{accent}` words in titles, kickers, icons, the reply label. |
| `highlight` | Strings, step numbers, the progress bar and the spotlight glow. |
| `you` | The "you" speaker label in chat scenes. |
| `panel`, `panelInk`, `panelMuted`, `panelRule` | The saved-result card in `card` scenes and the `steps` result bar. |

Take these from the person's design system when they have one. The Gleaner design system's dark brand layer maps directly: `g-ground` → `ground`, `glean-string` → `highlight`, `glean-clip-bg` → `panel`, and so on.

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
