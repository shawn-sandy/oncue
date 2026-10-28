---
name: visuals
description: Put real pictures in an OnCue explainer, a vertical Short or a 16:9 YouTube video. Place the person's screenshots and photos, draw diagrams, charts and timelines as PNG, use an image-generation tool when the session has one, or find openly licensed images with credits, each written into short.json as an image beat with alt text and a cue word. Use when the user wants to add images, pictures, photos or screenshots to a Short, recommend or create visuals for beats, make a diagram, or swap icons. Pictures change only the scene, so they are safe after the voiceover is recorded.
argument-hint: '[path to short.json] [beat numbers]'
---

# Visuals

Fill beats with pictures that are true: the person's own screens, diagrams drawn from real facts, or images whose license is known. Each one becomes an `image` beat in `short.json` (spec reference, `../storyboard/references/spec.md`, Scene kinds).

## 1. Read the project

- Pictures change only a beat's `scene`, never its `vo`, so they are safe at every stage, after the voiceover and after a render too: nothing is recorded again. Change no `vo` here; narration belongs to the research skill (`../research/SKILL.md`).
- An `imageCue` must be a word already in that beat's `vo` (matched as a prefix, ignoring case and punctuation). Pick the word that names what the picture shows.
- Read the Visual ideas and Credits in `research.md` beside `short.json` when it exists.
- Swapping icons is here too: `icon` fields take Feather names from `react-icons/fi`, such as `FiLayers`, `FiSearch` or `FiClock`.

## 2. Truth rules

Never generate or draw:

- **A product's interface**, the person's or anyone else's: an app screen, a web page, a dashboard, a saved item inside another tool.
- **A real person.**
- **A logo or brand mark**, beyond the `brand.logo` the person supplied.
- **A chart of real data from an image model.** Draw it from the real, sourced numbers instead, with the source in the caption or under Credits.

When a request needs one of these and no real picture was supplied, make nothing yet. Ask for a real screenshot or photo to place as an `image` beat, or offer a diagram labelled as illustrative, and wait for the person to choose.

## 3. Source the picture

Use the first source that fits:

1. **The person's own screenshots and photos.** Ask for one whenever the beat shows a real screen, page, product, person or place. Copy it into `images/` beside `short.json`.
2. **A drawn diagram, chart or timeline.** Write it as SVG, or HTML with `body { margin: 0 }`, sized to the viewport, in the brand colours from `brand.colors`, with short labels only. Turn it into a PNG with Playwright from the engine folder (set up as in the explainer-video skill, `../explainer-video/SKILL.md`), using absolute paths:

   ```bash
   npx playwright screenshot --viewport-size "1080, 1080" file://<absolute path to diagram.svg> <folder>/images/beat-03.png
   ```

   Use 1080×1080 for a portrait Short and 1920×1080 for a landscape video, so the diagram fills most of its frame. When it stands in for something real, say so in the caption, such as "Diagram" or "Illustration".
3. **An image-generation tool, only when the session has one.** Name the tool, say it may spend credits, and ask before generating. Use it for generic, illustrative scenes only, never for anything under Truth rules.
4. **An openly licensed image** (public domain, CC0, CC BY, CC BY-SA, or a site licence such as Unsplash's or Pexels'). Record its title, author, licence and link under Credits in `research.md`, and put an attribution in the caption when the licence asks for one. A picture whose licence you could not confirm may still be placed, but flag it under Credits and in your delivery note as needing a check before publishing.

## 4. Picture rules

- PNG or JPEG only (`.png`, `.jpg`, `.jpeg`). `check` rejects SVG, WebP and GIF, so convert first.
- At least 1080 px on the long side. Bigger is fine: the video uses a copy at most 2160 px on the long side, and the deck uses the original.
- No text inside generated pictures, which models misspell. Words go in the title and caption; a drawn diagram may carry short labels.
- Put the brand colours in the generation prompt or the SVG.
- `alt` says what the picture shows, in one sentence: "Diagram: a web page becomes a clip with a summary, tags and its source link."
- A `caption` is optional: one line of about 40 characters.

## 5. Write the beat

Name each file `images/beat-<NN>.<ext>` by its beat number, and switch that beat's scene to `image`, keeping its `kicker` and `title` when they still fit and leaving its `vo` exactly as it is:

```json
{
  "kind": "image",
  "kicker": "How it works",
  "title": "Every page becomes a {clip}",
  "src": "images/beat-03.png",
  "alt": "Diagram: a web page becomes a clip with a summary, tags and its source link",
  "imageCue": { "word": "saves" },
  "caption": "Diagram",
  "captionCue": { "word": "tags" }
}
```

Then, from the engine folder:

```bash
node dist/cli.js check <folder>/short.json
node dist/cli.js stills <folder>/short.json --words <folder>/words.json --audio <folder>/voiceover.mp3
```

Leave out `--words` and `--audio` before a voiceover exists. Fix every cue warning by choosing an `imageCue` or `captionCue` word that is in that beat's `vo`, and look at the beat's still: the picture is in its frame, uncropped, with nothing in the bottom ~350 px of a portrait frame. Only then report done.

## 6. Deliver

Say which beats changed and where each picture came from, list any licence flagged for a check before publishing, and offer the next step: rebuild the deck (`../vertical-deck/SKILL.md`) or render the video again (`../animate-short/SKILL.md`). Pictures need no new recording.
