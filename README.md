# OnCue

**Explainer Shorts where every word lands on cue.**

Give Claude a topic and get a finished vertical explainer: storyboarded beats, an ElevenLabs voiceover, a native 9:16 PowerPoint deck, and an animated 1080×1920 MP4 where every card, step and tile appears on the exact word that names it. Ready for YouTube Shorts, Reels and TikTok.

One file, `short.json`, drives the storyboard, the voiceover script, the deck and the video, so they always match.

## Requirements

What you need depends on how far you go:

| To make | You need |
| --- | --- |
| A storyboard (`short.json` and a beat list) | Node.js 22 or newer |
| The deck (an editable 9:16 `.pptx`) | Node.js |
| Preview stills, or a silent preview video | Node.js and Playwright with Chromium; the video also needs ffmpeg |
| The voiceover (`voiceover.mp3` and `words.json`) | The ElevenLabs connector and credits, or your own files (see [Without ElevenLabs](#without-elevenlabs)) |
| The final voiced MP4 | All of the above, with `ffmpeg` and `ffprobe` on `PATH` |

Setting them up:

- **Node.js 22 or newer.** Check with `node --version`.
- **ffmpeg and ffprobe.** One package installs both: `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Debian or Ubuntu.
- **Playwright with Chromium.** Claude installs it in its copy of the engine the first time it is needed (`npm install playwright && npx playwright install chromium`). Where Playwright is already installed, as in many sandboxes, Claude uses that one.
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

## Usage

### Make your first Short

1. Start Claude Code in the folder where the project should live.
2. Ask for a Short, and point Claude at the facts to use:

   ```text
   Make a 60-second explainer short about this repo's CLI. Use the README for facts,
   our logo at assets/logo.png, and end with "star it on GitHub".
   ```

3. Claude copies the engine into `oncue-engine/` in that folder and installs it, once per session, then writes the storyboard.
4. **Check-in 1: the beats.** Claude shows the beat list with preview stills (or a Design canvas). Change, cut or reorder beats now: once the voiceover is recorded, a wording change means paying for a new recording.
5. **Check-in 2: the voice.** Claude names the voice it picked and gives you two takes. Pick one, or ask for another voice.
6. Claude builds the deck if you asked for one, checks stills against the real word timings, and renders the video in the background. Rendering runs at about 3–4 frames a second, so roughly 10 minutes for a 75-second Short.
7. You get the MP4 (and the deck), with the take and voice used and the ElevenLabs credits spent.

Say "go ahead without stopping" to skip the check-ins.

### What to tell Claude

- **The subject and its sources:** a repo, README, docs page or notes. Claude uses real facts only and marks anything missing as `[YOUR FACT]`.
- **Length and audience.** Without them, Claude aims for 45–80 seconds in 6–10 beats.
- **The call to action:** install, follow, visit.
- **The brand:** a design system, colours, or a square PNG logo. Without one, Claude uses the product's logo and site; with neither, it picks a dark ground, one accent and one highlight from the subject and tells you.
- **The voice,** such as "a warm, unhurried narrator". Without one, Claude picks a clear voice suited to a product explainer.
- **The outputs,** if you want less than the whole pipeline: only the storyboard, only the deck, or a silent preview.

### What you get

```text
oncue-engine/        Claude's copy of the engine; every command runs from here
my-short/
  short.json         the spec: beats, scenes, cue words, brand
  logo.png
  voiceover.mp3      the chosen take (voiceover-take1.mp3, words-take1.json, ... while you choose)
  words.json         word timestamps for that take
  deck.pptx          editable 9:16 deck, voiceover in the speaker notes
  short.mp4          1080×1920, 30fps, H.264 with AAC audio
  build/             scenes/ and timeline.json (rewritten each run), stills/ (new frames are added, old ones stay)
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
| [explainer-video](plugins/oncue/skills/explainer-video/SKILL.md) | "make an explainer short about our CLI" | The whole pipeline, with check-ins at the beats and the voice |
| [storyboard](plugins/oncue/skills/storyboard/SKILL.md) | "storyboard a 60-second Short for this plugin" | `short.json`, a beat list, preview stills or a Design canvas |
| [voiceover](plugins/oncue/skills/voiceover/SKILL.md) | "voice it with ElevenLabs" | Two takes as MP3, each with a word-level transcript |
| [vertical-deck](plugins/oncue/skills/vertical-deck/SKILL.md) | "make the 9:16 slides" | An editable .pptx, voiceover in the speaker notes |
| [animate-short](plugins/oncue/skills/animate-short/SKILL.md) | "render it, and animate the slides" | The final MP4, or a silent preview before audio exists |

## How it works

1. **Storyboard.** Claude writes the beats into `short.json`: each beat's voiceover line, a scene (`hook`, `list`, `card`, `chat`, `steps`, `grid`, `media` or `cta`), and for each element the word it should enter on. See [the spec reference](plugins/oncue/skills/storyboard/references/spec.md).
2. **Voiceover.** The ElevenLabs connector reads the whole script in one take for a consistent voice, then transcribes it with word timestamps.
3. **Deck.** The engine writes real PowerPoint text and shapes in your brand colours.
4. **Video.** Each scene is an HTML page stepped frame by frame in headless Chromium, with entrances on cue words, a typing effect, spotlight glows, drawn lines, scene transitions and a progress bar. ffmpeg encodes the frames and lays in the voice.

The worked example is Gleaner's own Short: [examples/gleaner/short.json](plugins/oncue/engine/examples/gleaner/short.json), with its voiceover and transcript beside it.

## Troubleshooting

| You see | Do this |
| --- | --- |
| The audio download is refused in a sandboxed session | Allow `storage.googleapis.com` in claude.ai Settings → Capabilities, or download the MP3 yourself and attach it. |
| `Playwright is not installed` | In `oncue-engine/`: `npm install playwright && npx playwright install chromium`. |
| An `ENOENT` error naming `ffmpeg` or `ffprobe` | Install ffmpeg so both are on `PATH`. |
| `Font file missing` | A font in `brand.fonts` is not installed: `npm install @fontsource/<name>` in `oncue-engine/`. If it is installed, it lacks a weight the video uses (400, 600, 700 and 800 for `sans`; 400 and 600 for `mono`), so pick a font that has them. |
| `Line N (...) not found in the transcript` | The narrator changed that line's first word. Make its `vo` match what was said, or transcribe again. |
| `cue word "..." not heard in this line` | That element is spaced evenly instead of landing on its word. Change its `cue` to a word the narrator said. |
| `Pass --words and --audio together` | The transcript must be of that audio, so pass both or neither. |
| Text hidden behind the Shorts buttons and captions | Keep content out of the bottom ~350px of the frame (about 1.8 inches of the deck). |

## The engine

The typed engine lives in [plugins/oncue/engine](plugins/oncue/engine). The skills copy it into your working folder and run it there:

```bash
node dist/cli.js check  short.json                       # validate; print beats and estimated length
node dist/cli.js script short.json                       # the voiceover script
node dist/cli.js deck   short.json --out deck.pptx
node dist/cli.js stills short.json --words words.json --audio voiceover.mp3
node dist/cli.js video  short.json --words words.json --audio voiceover.mp3 --out short.mp4
```

Without `--words` and `--audio`, timing is estimated from the script and the video is a silent preview. Outputs go to `build/` beside `short.json`; `deck` and `video` take `--out` to write elsewhere.

To try it on the bundled Gleaner Short, run `npm install` in the engine folder, then `npm run example:check`, `example:deck`, `example:stills` or `example:video`. The results land in `examples/gleaner/build/`.

To work on the engine, run `npm install` and then `npm run build` in its folder. Sources are strict TypeScript in `src/`; the compiled `dist/` is committed so the skills run without a build step.

## Development

```bash
npm run validate          # manifests, skill frontmatter, links, shipped engine build, claude plugin validate
npm run engine:typecheck  # strict TypeScript check of the engine
```

The plugin version lives only in `plugins/oncue/.claude-plugin/plugin.json`.

## Changelog

### 1.0.0 (2026-10-25)

- First release: the explainer-video, storyboard, voiceover, vertical-deck and animate-short skills, the typed engine, and the Gleaner example.
