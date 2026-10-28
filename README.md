# OnCue

**Explainer Shorts where every word lands on cue.**

Give Claude a topic and get a finished explainer: storyboarded beats, an ElevenLabs voiceover, a native PowerPoint deck, and an animated MP4 where every card, step and tile appears on the exact word that names it. Make it vertical (1080×1920) for YouTube Shorts, Reels and TikTok, widescreen (1920×1080) for a YouTube video, or a custom size (even sides from 320 to 4096 px, the long side at most 2.4× the short one).

One file, `short.json`, drives the storyboard, the voiceover script, the deck and the video, so they always match. Its `format` sets the size: frames wider than tall get a landscape layout, the rest the portrait one.

## Requirements

What you need depends on how far you go:

| To make | You need |
| --- | --- |
| A storyboard (`short.json` and a beat list) | Node.js 22 or newer |
| The deck (an editable 9:16 or 16:9 `.pptx`) | Node.js |
| Silent preview stills, or a silent preview video | Node.js and Playwright with Chromium; the video also needs ffmpeg |
| The voiceover (`voiceover.mp3` and `words.json`) | The ElevenLabs connector and credits, or your own files (see [Without ElevenLabs](#without-elevenlabs)) |
| Stills timed to the voiceover | Node.js, Playwright with Chromium, the voiceover files and `ffprobe` on `PATH` |
| The final voiced MP4 | All of the above, with `ffmpeg` and `ffprobe` on `PATH` |

Setting them up:

- **Node.js 22 or newer.** Check with `node --version`.
- **ffmpeg and ffprobe.** One package installs both: `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Debian or Ubuntu.
- **Playwright with Chromium.** Claude installs it in its copy of the engine the first time it is needed (`npm install --save-dev playwright && npx playwright install chromium`; on npm 12, plain `npm install playwright` installs nothing, because Playwright is an optional peer dependency). Where Playwright is already installed, as in many sandboxes, Claude uses that one.
- **ElevenLabs.** An ElevenLabs account with credits, connected to Claude. In Claude Code, add the server, then run `/mcp` in a session and sign in with your ElevenLabs account (OAuth; no API key):

  ```bash
  claude mcp add --transport http elevenlabs https://api.elevenlabs.io/v1/mcp
  ```

  In the Claude app, add it as a custom connector with the same URL. [ElevenLabs' MCP page](https://elevenlabs.io/mcp) has both. For reference, a 75-second script cost about 1,100 credits per take (Claude asks for two takes) and about 600 per transcription.
- **Network, in sandboxed sessions.** Allow `storage.googleapis.com` (claude.ai Settings → Capabilities) so Claude can download the ElevenLabs audio.

## Install

In Claude Code:

```text
/plugin marketplace add shawn-sandy/oncue
/plugin install oncue@oncue
```

To try it locally from a clone, run `claude --plugin-dir ./plugins/oncue`.

Then ask Claude to "set up OnCue" (or run `/oncue:setup`). The setup skill reports the installed version and scope, checks Node, ffmpeg and ffprobe, the engine, Playwright with Chromium and the ElevenLabs connector listed under [Requirements](#requirements), installs what it can, and tells you which outputs are ready.

OnCue's marketplace does not auto-update by default. To update, run `claude plugin update oncue@oncue` (or choose **Update now** on the **Installed** tab of `/plugin`), then `/reload-plugins` and set up again: that replaces any engine copy the old version made. To turn OnCue on for everyone in a repository, install it with `--scope project` and commit `.claude/settings.json`; each collaborator still runs the install once. Ask Claude to "share OnCue with my team" for the exact commands.

## Usage

### Make your first Short

1. Start Claude Code in the folder where the project should live.
2. Ask for a Short, and point Claude at the facts to use:

   ```text
   Make a 60-second explainer short about this repo's CLI. Use the README for facts,
   our logo at assets/logo.png, and end with "star it on GitHub".
   ```

   For YouTube rather than Shorts, ask for a widescreen or 16:9 video instead.

3. Claude copies the engine into `oncue-engine/` in that folder and installs it, once per session, then writes the storyboard.
4. **Check-in 1: the beats.** Claude shows the beat list with preview stills (or a Design canvas). Change, cut or reorder beats now: once the voiceover is recorded, a wording change means paying for a new recording.
5. **Check-in 2: the voice.** Claude names the voice it picked and gives you two takes. Pick one, or ask for another voice.
6. Claude builds the deck if you asked for one, checks stills against the real word timings, and renders the video in the background. Render time depends on the machine: on an Apple M4 Max the 75-second example rendered at about 30 frames a second, in 76 seconds. Slower machines take longer.
7. You get the MP4, plus the deck if you asked for one, with the take and voice used and the ElevenLabs credits spent.

Say "go ahead without stopping" to skip the check-ins.

### What to tell Claude

- **The subject and its sources:** a repo, README, docs page or notes. Claude uses real facts only and marks anything missing as `[YOUR FACT]`.
- **Length and audience.** Without them, Claude aims for 45–80 seconds in 6–10 beats.
- **The call to action:** install, follow, visit.
- **The brand and look:** a design system, a DESIGN.md or design tokens, a reference image or site, a few words such as "light, playful, rounded", colours, or a square PNG logo. Without one, Claude uses the product's logo and site; with neither, it picks a dark ground, one accent and one highlight from the subject and tells you.
- **The voice,** such as "a warm, unhurried narrator". Without one, Claude picks a clear voice suited to a product explainer.
- **Where it will be posted.** Shorts, Reels and TikTok get 1080×1920; a YouTube video or a landscape deck gets 1920×1080; name any other size you need.
- **The outputs,** if you want less than the whole pipeline: only the storyboard, only the deck, or a silent preview.

### What you get

```text
oncue-engine/        Claude's copy of the engine; every command runs from here
my-short/
  short.json         the spec: beats, scenes, cue words, brand
  research.md        sources, facts, topic ideas and visual ideas (research skill; the engine never reads it)
  logo.png
  images/            pictures for image beats (visuals skill): beat-03.png, ...
  voiceover.mp3      the chosen take (voiceover-take1.mp3, words-take1.json, ... while you choose)
  words.json         word timestamps for that take
  deck.pptx          editable 9:16 or 16:9 deck, voiceover in the speaker notes
  short.mp4          the spec's size (1080×1920, 1920×1080 or custom), 30fps, H.264 with AAC audio
  build/             scenes/, timeline.json and fit.json (rewritten each run), stills/ (new frames are added, old ones stay)
```

`short.json` is the source of truth. To change the copy, edit it (or ask Claude to) and rebuild; an edit made only in the `.pptx` leaves the deck and the video out of step.

### Without ElevenLabs

Record or generate the narration yourself and attach the MP3. Read it from the script (`node dist/cli.js script short.json`) word for word: each line is found in the transcript by its first word.

The animation is timed from a word-level transcript, not from the audio. With the ElevenLabs connector, Claude transcribes your MP3. Without it, put a `words.json` from any word-level transcriber beside `short.json`, in this shape:

```json
{ "words": [{ "text": "Ever", "start": 0.12, "end": 0.28 }] }
```

With neither, you still get the storyboard, the deck and a silent preview timed from an estimate.

### Run one stage at a time

Each stage is its own skill, so you can stop after any of them or start from an existing `short.json`.

| Skill | Ask for | You get |
| --- | --- | --- |
| [setup](plugins/oncue/skills/setup/SKILL.md) | "set up OnCue", "update OnCue" | The plugin version and how to update or share it; Node, ffmpeg, Playwright and ElevenLabs checked, the engine installed, and which outputs are ready |
| [explainer-video](plugins/oncue/skills/explainer-video/SKILL.md) | "make an explainer short about our CLI" | The whole pipeline, with check-ins at the beats and the voice |
| [research](plugins/oncue/skills/research/SKILL.md) | "suggest three Shorts about this tool", "fact-check the storyboard", "make beat 2 punchier" | `research.md` with ranked topics, sourced facts and visual ideas; narration rewrites shown before and after, applied only on your approval and never to recorded lines without naming the re-record cost |
| [storyboard](plugins/oncue/skills/storyboard/SKILL.md) | "storyboard a 60-second Short for this plugin" | `short.json`, a beat list, preview stills or a Design canvas |
| [visuals](plugins/oncue/skills/visuals/SKILL.md) | "add a diagram of how it works to beat 3", "use my screenshot in beat 4" | `image` beats from your screenshots, drawn diagrams, a generation tool or licensed pictures, with alt text, a cue word and credits; safe after the voiceover |
| [voiceover](plugins/oncue/skills/voiceover/SKILL.md) | "voice it with ElevenLabs" | Two takes as MP3, each with a word-level transcript |
| [vertical-deck](plugins/oncue/skills/vertical-deck/SKILL.md) | "make the 9:16 slides" or "make a 16:9 deck" | An editable .pptx, voiceover in the speaker notes |
| [animate-short](plugins/oncue/skills/animate-short/SKILL.md) | "render it, and animate the slides" | The final MP4, or a silent preview before audio exists |

## How it works

1. **Storyboard.** Claude writes the beats into `short.json`: each beat's voiceover line, a scene (`hook`, `list`, `card`, `chat`, `steps`, `grid`, `media`, `image` or `cta`), and for each element the word it should enter on. It also sets the look: brand colours and fonts, and an optional `theme` for corners, type size, spacing, background and header, taken from your words, a DESIGN.md, design tokens, Figma, a reference image or a site. See [the spec reference](plugins/oncue/skills/storyboard/references/spec.md).
2. **Voiceover.** The ElevenLabs connector reads the whole script in one take for a consistent voice, then transcribes it with word timestamps.
3. **Deck.** The engine writes real PowerPoint text and shapes in your brand colours, on a 9:16 or 16:9 slide by the spec's orientation.
4. **Video.** Each scene is an HTML page stepped frame by frame in headless Chromium at the spec's size; a scene too big for its frame is shrunk to fit, with a warning, with entrances on cue words, a typing effect, spotlight glows, drawn lines, scene transitions and a progress bar. ffmpeg encodes the frames and lays in the voice.

The worked example is Gleaner's own Short: [examples/gleaner/short.json](plugins/oncue/engine/examples/gleaner/short.json), with its voiceover and transcript beside it.

## Troubleshooting

| You see | Do this |
| --- | --- |
| The audio download is refused in a sandboxed session | Allow `storage.googleapis.com` in claude.ai Settings → Capabilities, or download the MP3 yourself and attach it. |
| `Playwright is not installed` | In `oncue-engine/`: `npm install --save-dev playwright && npx playwright install chromium`. |
| An `ENOENT` error naming `ffmpeg` or `ffprobe` | Install ffmpeg so both are on `PATH`. |
| `Font file missing` | A font in `brand.fonts` is not installed: `npm install @fontsource/<name>` in `oncue-engine/`. If it is installed, it lacks a weight the video uses (400, 600, 700 and 800 for `sans`; 400 and 600 for `mono`), so pick a font that has them. |
| `Line N (...) not found in the transcript` | The narrator changed that line's first word. Make its `vo` match what was said, or transcribe again. |
| `cue word "..." not heard in this line` | That element is spaced evenly instead of landing on its word. Change its `cue` to a word the narrator said. |
| `Pass --words and --audio together` | The transcript must be of that audio, so pass both or neither. |
| Text hidden behind the Shorts buttons and captions | Portrait layouts keep content out of the bottom ~350px of the frame and the bottom 1.4 inches of the deck; don't move it there. |
| `short.json format.width: must be even` (or `between 320 and 4096`, or `at most 2.4×`) | H.264 needs even sizes, and the layouts need a sensible shape. Use 1080×1920 or 1920×1080; square and 4:5 sizes use the portrait layout, which leaves less room, so dense scenes shrink. |
| `warning: scene N (...) shrunk to ...` | That scene had more than fits its frame, so it was scaled down. Cut its copy (fewer items, shorter titles) to show it full size. |
| `note: the deck is ... applies to the video only` | The deck is drawn for 9:16 and 16:9 only: landscape specs get 16:9, portrait and square ones 9:16. The video keeps the exact size. |

## The engine

The typed engine lives in [plugins/oncue/engine](plugins/oncue/engine). The skills copy it into your working folder and run it there:

```bash
node dist/cli.js check  short.json                       # validate; print the layout, beats and estimated length
node dist/cli.js script short.json                       # the voiceover script
node dist/cli.js deck   short.json --out deck.pptx
node dist/cli.js stills short.json --words words.json --audio voiceover.mp3
node dist/cli.js video  short.json --words words.json --audio voiceover.mp3 --out short.mp4
```

Without `--words` and `--audio`, timing is estimated from the script and the video is a silent preview. Outputs go to `build/` beside `short.json`; `deck` and `video` take `--out` to write elsewhere. `stills` and `video` also write `build/fit.json`, each scene's `scale` (1 unless the fit guard shrank it) and whether it `fits`.

To try it on the bundled Gleaner Short, run `npm install` in the engine folder, then `npm run example:check`, `example:deck`, `example:stills` or `example:video`. The results land in `examples/gleaner/build/`. `npm install` leaves out Playwright, an optional peer dependency, so run `npm install --no-save --save-dev playwright && npx playwright install chromium` before `example:stills` or `example:video`. Those flags install it on npm 12 too without editing the shipped `package.json`. Any later `npm install` removes it again, so repeat the command after one. Both examples also need ffprobe, because they time the frames to the bundled voiceover, and `example:video` needs ffmpeg as well.

To work on the engine, run `npm install` and then `npm run build` in its folder. Sources are strict TypeScript in `src/`; the compiled `dist/` is committed so the skills run without a build step.

## Development

```bash
npm run validate          # manifests, skill frontmatter, links, shipped engine build, claude plugin validate
npm run engine:typecheck  # strict TypeScript check of the engine
npm run engine:test       # node:test suites; the browser ones skip without Chromium, as in CI
claude plugin eval plugins/oncue --scaffold --allow-tools Write Edit --trust-plugin   # scored skill evals; run locally before a PR
```

The skill evals in `plugins/oncue/evals/` run real Claude sessions against fixed project folders and a model grades them, so they spend usage and need a Claude login: run them locally, not in CI. `--scaffold` copies each case's fixtures into its workspace; results land in `plugins/oncue/evals/results/`, which git ignores.

The plugin version lives only in `plugins/oncue/.claude-plugin/plugin.json`.

## Changelog

### 1.6.0 (2026-10-28)

- New `image` scene kind: a PNG or JPEG under the title, letterboxed on the `card` colour and never cropped, and never smaller than a third of the frame's short side (a frame too short for that, such as a square one, shrinks the scene to fit, with a warning), with required `alt`, an optional one-line `caption`, and `imageCue` and `captionCue`. It pops in on its cue with the spotlight glow, in the portrait and landscape layouts and the deck. `check` rejects a missing file, an extension other than `.png`, `.jpg` or `.jpeg`, and an empty `alt`, naming the field. Specs without image beats render as before: the Gleaner example's stills and slide XML are byte-identical to 1.5.0.
- The video uses an upright copy of each picture, at most 2160 px on the long side, in `build/scenes/images/beat-<n>.<ext>`; the deck places a full-size copy at its own aspect ratio with `alt` as its alt text. Both copies are upright and carry no metadata, so a phone photo's location never reaches a shared deck.
- New visuals skill: places the person's screenshots and photos, draws diagrams, charts and timelines as PNG with `npx playwright screenshot`, uses an image-generation tool only when the session has one, and records openly licensed images under Credits in `research.md`, flagging any licence it could not confirm. It never generates or draws a product's interface, a real person, a logo or a chart of real data; asked for one with nothing supplied, it asks for the real picture or offers a labelled diagram.
- The storyboard, research, animate-short and explainer-video skills and the spec reference point at the image kind and the visuals skill.
- New engine tests for image beats (`image-spec`, `image-scene`, `image-stills`), and a fourth skill eval, visuals-no-fake-ui.

### 1.5.0 (2026-10-28)

- New research skill. It joins at any stage and works out the stage from the files in the project folder: no `short.json`, a storyboard, any recorded take (unchosen ones such as `voiceover-take1.mp3` included) or a rendered `short.mp4`. It suggests 3 to 5 ranked topics with a hook line, an audience and sources; fact-checks a storyboard; rewrites narration before and after with sources, keeping each line's first word and cue words; and recommends icons and pictures per beat. Everything goes into `research.md` beside `short.json`.
- Once a take exists, the research skill changes no `vo` without asking, and names the re-record cost first (about 1,100 ElevenLabs credits a take, two takes by default, plus about 600 to transcribe).
- The explainer-video stage table, the storyboard skill's first step and the setup report now point at research.
- Skill evals in `plugins/oncue/evals/` (`claude plugin eval`): research-topics, research-narration and research-voiced-lock, each scoring 1.0 over 3 runs.

### 1.4.0 (2026-10-26)

- Theme tokens in both outputs. An optional `theme` in `short.json` sets `radius` (`sharp`, `soft`, `round`), `type` (`small`, `regular`, `large`), `density` (`compact`, `regular`, `airy`), `background` (`glow`, `subtle`, `flat`) and `header` (`brand`, `logo`, `none`). Each picks a scale for today's design, and the same scale drives the video and the deck; `background` is video only. `check` rejects an unknown key or value, naming the field and the allowed values.
- New optional `brand.deckFonts.mono`: the deck's font for kickers, inline code, tags and timestamps. It defaults to Courier New, which the deck always used, whatever `fonts.mono` said.
- `check` warns when a text-and-fill colour pair the renderers draw is under 4.5:1 contrast, naming both keys. It is a warning, not an error.
- The deck draws icon-dot glyphs and "you" chat bubble text in `ground` on `highlight` instead of `panelInk`: 6.42:1 instead of 2.71:1 for the Gleaner palette. This changes those shapes in every deck.
- The storyboard skill's first step now gathers the look: plain words, a DESIGN.md, design tokens, Figma, a reference image or a reference site, mapped to colours, fonts and `theme` by the new `references/theme.md`. A theme changes no `vo`, so restyling after the voiceover means rendering again, not recording again. Light palettes work: pair a light `ground` with `background: "flat"`, or `"subtle"` with a light `panel`.
- Specs without `theme` render the same video frames as 1.3.0.

### 1.3.0 (2026-10-26)

- Widescreen and custom sizes from the same `short.json`. A 1920×1080 `format` renders a landscape layout built for YouTube, with each scene kind arranged for the wide frame (header beside the body for lists, cards, chats and steps; above it for grids and media; hook and call to action centred). Any other size uses the layout for its orientation.
- A fit guard shrinks any scene that would overflow its frame instead of cutting it off, warns about each one, and records every scene in `build/fit.json`.
- The deck is 10×5.625 in for landscape specs, arranged like the video; other aspects snap to 9:16 or 16:9 with a note.
- `loadSpec` rejects sizes that would fail later: odd, fractional or non-number sides, sides outside 320 to 4096 px, and a long side over 2.4× the short one. Specs that passed before but break these limits now fail `check` with the field named.
- `check` prints the layout, and the 3-minute Shorts warning applies to portrait only.
- 9:16 output is unchanged for specs that fit their frame: the Gleaner example's stills and slide XML are byte-identical to 1.2.0. A 9:16 scene that overflowed now shrinks to fit instead of being cut off. In the deck, card rows close up when they would run past the card, and a steps scene with four steps and a result drops its connector lines instead of writing them with a negative height.
- New `npm run engine:test` (node:test), run in CI; the browser suites skip there without Chromium.
- Every skill description now names widescreen, landscape, 16:9 and YouTube video, so those requests reach OnCue.

### 1.2.0 (2026-10-25)

- The setup skill now covers the plugin itself: it reports the loaded version and install scope, flags an update waiting to load, and gives the commands to update OnCue or install it for collaborators at project scope.
- After an update, the setup and explainer-video skills replace an `oncue-engine/` copy made by an older version (found with `diff -rq` against the plugin's `engine/dist`) instead of reusing it, so the new engine actually runs.
- README: updating and project-scope installs.

### 1.1.0 (2026-10-25)

- New setup skill: checks Node, ffmpeg and ffprobe, Playwright with Chromium and the ElevenLabs connector, installs the engine, and reports which outputs are ready.
- Playwright installs now work on npm 12, which skips optional peer dependencies unless they are saved as dev dependencies. The skills, the engine's "Playwright is not installed" message and the README use `npm install --save-dev playwright`; `engine:typecheck` and the README's example step use `--no-save --save-dev`, so the shipped `package.json` stays unchanged.
- README: requirements by output, a usage guide and troubleshooting.

### 1.0.0 (2026-10-25)

- First release: the explainer-video, storyboard, voiceover, vertical-deck and animate-short skills, the typed engine, and the Gleaner example.
