---
name: storyboard
description: Plan a vertical or widescreen explainer as beats, voiceover lines and scenes, written to a short.json spec and optionally laid out as a storyboard on a Design canvas. Use when the user wants to storyboard, script, outline or plan a short, a Reel, a TikTok, a YouTube Short, a landscape 16:9 YouTube video or a presentation, such as "storyboard a short about our plugin", "plan a wide screen video" or "plan the beats before we build the video".
compatibility: 'Read supplied material and write access to save short.json. Text storyboards need no renderer. Node.js 22+ and the bundled engine for validation; Playwright and launchable Chromium for optional preview stills.'
argument-hint: '[topic, product, or path to an existing short.json]'
---

# Storyboard

Turn a topic into a locked set of beats: what the narrator says, what the viewer sees, and the word each element enters on. The result is `short.json`, which the deck, voiceover and video skills all read. Read [the spec reference](references/spec.md) before writing one.

## 1. Gather the material

- What it is, who it is for, and the one thing a viewer should do at the end (install, follow, visit).
- Real facts only: features, commands, names, links. Read the product's README, docs or code when they are available. Never invent numbers, quotes or results; mark a missing fact as `[YOUR FACT]` and say so.
- Read `research.md` beside `short.json` when it exists. When the subject is not the person's own product, or the facts are thin, run the research skill (`../research/SKILL.md`) first for sourced facts and topic ideas.
- Where it will be posted, which sets `format`: 1080×1920 (9:16) for YouTube Shorts, Reels and TikTok; 1920×1080 (16:9) for a YouTube video or a landscape presentation. Square and 4:5 sizes (1080×1080, 1080×1350) render, but with the portrait layout and its Shorts inset, so dense scenes shrink; say so before choosing one. Ask when it isn't clear; one spec renders one size.
- The look: logo, colours, fonts and an optional `theme` (corners, type size, spacing, background, header). Take it from what the person gives: plain words ("playful, light, rounded"), a DESIGN.md, design tokens (W3C DTCG or Style Dictionary JSON), Figma tokens, a reference image or screenshot, a reference site's CSS custom properties, or a Design System they name. When they give no look, only a few words such as "light", or ask to use their design system, search for one by "Spotting a look" in [the theme guide](references/theme.md), say what you found, and copy an earlier Short's look exactly. With nothing accepted, use the product's logo and site. With neither, pick a ground (dark unless their words say otherwise), one accent and one highlight from the subject and say what you chose. The theme guide maps each route to `short.json`. A theme changes no `vo`, so it is safe to change after the voiceover.

## 2. Shape the beats

- 6–10 beats of 5–12 seconds each. Aim for 45–80 seconds; YouTube Shorts allow up to 3 minutes.
- Classic arc: hook (the pain or promise) → problem → what it is → how it works (1–3 beats) → where it fits → call to action.
- One idea per beat, one sentence or two per `vo`. Write for the ear: short words, active verbs, things people type in quotes.
- Pick the scene `kind` that shows the idea (spec reference, Scene kinds), and give each element a `cue`: the word in that beat's `vo` that names it.
- A beat that needs a real picture (a screenshot, photo or diagram) becomes an `image` beat only once its picture exists, because `check` fails on an `image` beat whose file is missing. Storyboard it with another kind for now; the visuals skill (`../visuals/SKILL.md`) sources the picture and switches the beat to `image`, now or after the voiceover.
- Keep on-screen text shorter than the voiceover. A title says the point; the narrator explains it.

## 3. Write short.json

Write `short.json` in a writable project folder with the logo at the path `brand.logo` names, usually beside it. Without file access, return the draft JSON and beat table in the reply. Only when Node and the engine are ready, check it as below (set up as in the explainer-video skill, `../explainer-video/SKILL.md`):

```bash
node dist/cli.js check <folder>/short.json
```

When Node or the engine is unavailable, return the draft spec and beat table, state that validation and stills were not run, and continue text planning. Otherwise, `check` validates every field and prints the beats with an estimated length. Fix what it names, contrast warnings included. It does not open the logo, so confirm that file exists.

For "design my storyboard" or interactive editing, apply [storyboard surface routing](../setup/SKILL.md#storyboard-surface-routing) before choosing a tool. It honors explicit choices, reuses the project's editor, then selects a capability-checked host default. Browser editor routes use [storyboard-editor](../storyboard-editor/SKILL.md); canvas routes use the instructions below. Do not create an editor for a planning-only request. Return here with the edited spec for validation and engine stills.

## 4. Show the storyboard

Show the beats and the look so the person can change them before audio is recorded. Only the stills show the palette and `theme` as the video will, so include them whenever they render. Use the selected route for interactive work; for planning-only requests, show the available stills or beat table:

- **Silent preview stills (when the engine and Chromium are ready):** `node dist/cli.js stills <folder>/short.json` renders one frame per beat with estimated timing into `build/stills/`. Combine them into one contact sheet and show it with the beat list.
- **Design canvas (when the Artifact tool offers the Design type):** one 420×1080 artboard per beat, each with a frame sketch in the spec's aspect (9:16 or 16:9) on top, then the voiceover line, a motion note, and a timing chip. For a portrait frame, draw a dashed line over the bottom ~15% marking where the Shorts captions and buttons sit. Use the person's design system when one is installed.
- **A table in the reply** when neither fits.

Say plainly which details are placeholders (example titles, timestamps, numbers).

## 5. Lock the beats

Ask the person to change, cut or reorder beats now: after the voiceover is recorded, a wording change means recording again. When they approve, the spec is locked.

If the project has no DESIGN.md and the look came from neither an earlier Short nor a design system (a DESIGN.md, token files, the project's stylesheets or a Design System artifact), offer once the stills are approved (or the beats, where stills cannot render) to save it as a DESIGN.md at the project root, by "Saving the look as DESIGN.md" in [the theme guide](references/theme.md). Write it only on a yes. When told to go ahead without stopping, skip the offer and mention it at the end.

Then hand off to the voiceover skill (`../voiceover/SKILL.md`) or the vertical-deck skill (`../vertical-deck/SKILL.md`).
