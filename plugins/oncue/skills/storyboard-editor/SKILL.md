---
name: storyboard-editor
description: Open a visual storyboard editor for OnCue. Edit scene text, colors, theme, narration and cue words; reorder or duplicate beats; export short.json for vertical or widescreen videos. Use when someone says "design my storyboard", wants to edit it interactively, or requests a hosted or local storyboard editor before rendering.
compatibility: 'A browser and file downloads. Optional Sites tools for a hosted editor; filesystem access for a local HTML editor. Engine validation and exact previews require Node.js 22+, engine dependencies and launchable Chromium.'
argument-hint: '[project folder or short.json]'
---

# Storyboard editor

Use the bundled [editor](assets/editor.html) to edit the existing scene contract. It is a self-contained static page with no external scripts, network requests or account requirements. It imports and exports the complete spec, preserving fields it does not expose. It offers approximate layout previews, not the engine render or a freeform canvas.

## Prepare

Find the requested project and its `short.json`. For a new storyboard, use [storyboard](../storyboard/SKILL.md) to create real beats and a valid spec first. Keep the original spec and assets intact. Never substitute the bundled example for the person's project.

Provide the editor and the project's JSON as separate files. Import the JSON through the editor's file picker. The editor begins with narration and order locked, including for new projects. Explain that unlocking permits changes that can invalidate an existing recording or word alignment. Check for any audio take or word transcript in the project before recommending an unlock; call out re-recording costs before changing recorded narration.

## Choose the available surface

First apply [storyboard surface routing](../setup/SKILL.md#storyboard-surface-routing). Use the explicit choice, existing project editor, or capability-checked host default in that order. If it selects a Design canvas or text output, return to [storyboard](../storyboard/SKILL.md) for that surface rather than forcing the browser editor.

When routing selects a hosted editor and Sites tools are available, use the installed Sites skill and its current creation, source and publication workflow. Copy the editor to the static site's index.html. Keep the initial editor empty: do not embed the person's spec, images, narration or credentials in hosted source. Imports stay in the browser's memory. Preserve access settings for an existing site. Never change an existing marketing site into an editor unless explicitly asked.

When routing selects a local editor, copy the HTML into the person's project as `storyboard-editor.html` and open it with the host's file/browser preview. If that preview cannot load local HTML, provide the downloadable HTML and explain how to open it in a browser. Do not require a hosted service to use the editor. Do not claim publication succeeded without the host's confirmation. Retain the editor reference in project notes as described by the routing instructions so future sessions reuse it.

## Edit and return to rendering

Select a beat to edit its text, numeric cue fields and asset paths. Brand and theme controls affect the whole storyboard. Asset previews require selecting the local pictures; selection does not upload or package them. There is no autosave: export JSON to retain changes. Keep logo and image files beside the spec at their original relative paths.

The editor supports the existing hook, list, card, chat, steps, grid, media, image and cta layouts. It does not add arbitrary element positions or translate custom HTML into standard scenes. For freeform design, explain that the engine needs a separate layout extension rather than silently dropping those edits.

Import the exported `short.json` back into the project as a candidate, keeping a backup of the original. Review the diff, especially narration, beat order, paths and cue words. Run the engine's `check` on the candidate in a folder containing its assets. Fix schema and picture errors, and address contrast warnings before replacing the original. The browser performs only basic structural checks; successful export is not engine validation.

Render stills with [animate-short](../animate-short/SKILL.md), using the existing audio and words together only when narration and order remain compatible. Show these exact stills for approval before recording new narration or rendering an expensive output. Report unavailable checks explicitly. Save the approved spec as the source of truth; browser edits alone do not change the project files.
