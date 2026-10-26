---
name: storyboard
description: Plan a vertical or widescreen explainer as beats, voiceover lines and scenes, written to a short.json spec and optionally laid out as a storyboard on a Design canvas. Use when the user wants to storyboard, script, outline or plan a short, a Reel, a TikTok, a YouTube Short, a landscape 16:9 YouTube video or a presentation, such as "storyboard a short about our plugin", "plan a wide screen video" or "plan the beats before we build the video".
argument-hint: '[topic, product, or path to an existing short.json]'
---

# Storyboard

Turn a topic into a locked set of beats: what the narrator says, what the viewer sees, and the word each element enters on. The result is `short.json`, which the deck, voiceover and video skills all read. Read [the spec reference](references/spec.md) before writing one.

## 1. Gather the material

- What it is, who it is for, and the one thing a viewer should do at the end (install, follow, visit).
- Real facts only: features, commands, names, links. Read the product's README, docs or code when they are available. Never invent numbers, quotes or results; mark a missing fact as `[YOUR FACT]` and say so.
- Where it will be posted, which sets `format`: 1080×1920 (9:16) for YouTube Shorts, Reels and TikTok; 1920×1080 (16:9) for a YouTube video or a landscape presentation. Square and 4:5 sizes (1080×1080, 1080×1350) render, but with the portrait layout and its Shorts inset, so dense scenes shrink; say so before choosing one. Ask when it isn't clear; one spec renders one size.
- The brand: a design system the person names or has (colours, fonts, logo), else the product's logo and site. With none, pick a dark ground, one accent and one highlight from the subject and say what you chose.

## 2. Shape the beats

- 6–10 beats of 5–12 seconds each. Aim for 45–80 seconds; YouTube Shorts allow up to 3 minutes.
- Classic arc: hook (the pain or promise) → problem → what it is → how it works (1–3 beats) → where it fits → call to action.
- One idea per beat, one sentence or two per `vo`. Write for the ear: short words, active verbs, things people type in quotes.
- Pick the scene `kind` that shows the idea (spec reference, Scene kinds), and give each element a `cue`: the word in that beat's `vo` that names it.
- Keep on-screen text shorter than the voiceover. A title says the point; the narrator explains it.

## 3. Write short.json

Write `short.json` in a project folder with the logo beside it. Then check it with the engine (set up as in the explainer-video skill, `../explainer-video/SKILL.md`):

```bash
node dist/cli.js check <folder>/short.json
```

`check` validates every field and prints the beats with an estimated length. Fix what it names.

## 4. Show the storyboard

Show the beats so the person can change them before audio is recorded. Pick what the session supports:

- **Silent preview stills (always available):** `node dist/cli.js stills <folder>/short.json` renders one frame per beat with estimated timing into `build/stills/`. Combine them into one contact sheet and show it with the beat list.
- **Design canvas (when the Artifact tool offers the Design type):** one 420×1080 artboard per beat, each with a frame sketch in the spec's aspect (9:16 or 16:9) on top, then the voiceover line, a motion note, and a timing chip. For a portrait frame, draw a dashed line over the bottom ~15% marking where the Shorts captions and buttons sit. Use the person's design system when one is installed.
- **A table in the reply** when neither fits.

Say plainly which details are placeholders (example titles, timestamps, numbers).

## 5. Lock the beats

Ask the person to change, cut or reorder beats now: after the voiceover is recorded, a wording change means recording again. When they approve, the spec is locked; hand off to the voiceover skill (`../voiceover/SKILL.md`) or the vertical-deck skill (`../vertical-deck/SKILL.md`).
