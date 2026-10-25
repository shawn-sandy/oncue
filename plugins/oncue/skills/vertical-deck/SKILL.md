---
name: vertical-deck
description: Build a native, editable 9:16 PowerPoint deck from a short.json explainer, one slide per beat with the voiceover in the speaker notes, ready to present on a phone or record into a YouTube Short. Use when the user wants a vertical, portrait or 9:16 presentation, a deck for Shorts, Reels or TikTok, or "the slides" for an explainer they storyboarded.
argument-hint: '[path to short.json]'
---

# Vertical deck

Write `deck.pptx` from `short.json`: 5.625 × 10 inches (exports as 1080×1920), the brand's colours, real text boxes and shapes the person can edit, icons as images, and each beat's voiceover in the speaker notes so PowerPoint or Keynote can record narration over it.

## When this is the right output

- The person wants a .pptx (to edit, present, or record in PowerPoint or Keynote), or an editable companion to the video.
- For a deck in landscape 16:9, use the session's Slides artifact type or the pptx skill instead; these layouts are portrait only.
- No spec yet? Run the storyboard skill (`../storyboard/SKILL.md`) first. A deck needs only `short.json` and the logo, not the voiceover.

## Build

From the engine folder (set up as in `../explainer-video/SKILL.md`):

```bash
node dist/cli.js deck <folder>/short.json --out <folder>/deck.pptx
```

Fonts written into the deck are `brand.deckFonts`; PowerPoint renders them on the viewer's machine, so keep them to fonts that ship with Office (Arial, Calibri, Cambria).

## Check

When the pptx skill is available, use its scripts to validate the file and render it to images (`office/validate.py`, then `soffice.py --convert-to pdf` and `pdftoppm`), and look at every slide. Without them, open the PDF export or rebuild the stills from the video skill, which share the same layout.

Look for text running past its box (titles over about 45 characters, a `desc` over two lines), content in the bottom 1.4 inches (covered by Shorts captions and buttons), and low contrast. Fix the copy in `short.json` and rebuild; never patch the .pptx by hand, or the deck and the video drift apart.

## Deliver

Send the file with a one-line note. Mention that File → Export → Create a Video in PowerPoint (or File → Export To → Movie in Keynote, custom 1080×1920) records the narration from the notes into an MP4. The animate-short skill (`../animate-short/SKILL.md`) makes an animated, voiced MP4 directly.
