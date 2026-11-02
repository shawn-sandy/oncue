---
name: voiceover
description: Record a narrator voiceover for a short.json explainer, a vertical Short or a widescreen landscape 16:9 YouTube video, with the ElevenLabs connector, then transcribe it with word timestamps so slides and animations land on the right word. Use when the user wants a voiceover, narration or AI voice for a short, deck, YouTube video or explainer, such as "add a voiceover with ElevenLabs" or "narrate the storyboard".
compatibility: 'ElevenLabs creative tools with the documented schemas, or supplied MP3 plus matching words.json. Node.js 22+ and the bundled engine for script/timing checks; Playwright Chromium and ffprobe for voice-timed preview stills.'
argument-hint: '[path to short.json] [voice description]'
---

# Voiceover

Produce two files beside `short.json`: `voiceover.mp3` and `words.json` (every word with start and end seconds). The video skill needs both; the timing is what makes each element appear on its word.

## Before you start

- The beats should be locked (storyboard skill, `../storyboard/SKILL.md`). Changing a `vo` line after recording means recording again.
- This needs the ElevenLabs connector. Discover the available tools and read their schemas before starting; use the `creative_*` flow below only when that tool set and its arguments are supported. If they are not in the session, search the connector registry for ElevenLabs and suggest connecting it; or ask for a supplied MP3 and matching `words.json`, then continue at step 4. An MP3 alone still needs a supported transcription tool; say when none is available. Never invent a tool or silently switch voice providers.
- Generation spends the person's ElevenLabs credits. For reference, a 75-second read cost about 1,100 credits a take, and transcribing it about 600.

## 1. Get the script

```bash
node dist/cli.js script <folder>/short.json
```

This prints every beat's `vo`, separated by blank lines. Read it once more for anything a narrator would stumble on: spell out symbols, keep quoted commands short.

## 2. Pick a voice and generate

1. `creative_create_flow` first, and pass its `flow_id` to every call below so the speech, the reference audio and the transcripts share one flow.
2. `creative_list_voices` with the person's description, or, without one, filters like `use_cases: ["social_media", "informative_educational"]` and `descriptives: ["upbeat", "confident"]`. Pick a clear voice whose description fits a product explainer; never invent a voice id. Say which you picked.
3. `creative_generate_speech` once, with the **whole script as one prompt** (blank lines between beats) and `model_id: "eleven_v4"`. One continuous read keeps the voice and pace consistent across beats. Leave `generations_count` at its default of two takes. Never call it again to retry; that charges again.
4. Poll `creative_get_flow_run_status` until `all_completed`. Each generation has `duration_secs` and a `content_url`.

## 3. Transcribe each take

For each take: `creative_attach_reference_file` with the take's `content_url` and the `flow_id`, then `creative_transcribe_audio` with `model_id: "eleven_scribe_v1"` and `connect_from: [<that node_id>]`. Poll until done. Each transcript has `words` and a `words_download_url`.

Skip a take the person has already rejected; each transcription costs credits.

## 4. Save the files

For supplied audio and matching word timestamps, copy those attachments beside `short.json` and skip generation, transcription and URL downloads. Otherwise download into the project folder using an allowed download tool:

```bash
curl -sS -o <folder>/voiceover.mp3 "<content_url of the chosen take>"
curl -sS -o <folder>/words.json "<words_download_url of that take's transcript>"
```

Signed URLs expire after about two hours. If the download is refused by the sandbox network (`storage.googleapis.com` blocked), say so and follow the current host's recovery instructions in the setup skill (`../setup/SKILL.md`), or ask the person to attach the MP3 and matching word timestamps. Do not try a different tool to bypass a refused download. When only the MP3 arrives and the required connector tools are available, attach it to the flow (`creative_create_asset_upload` → upload → `creative_finalize_asset_upload`) and transcribe it as in step 3; when the transcript text is in the tool result but the file can't be downloaded, write `words.json` yourself as `{ "words": [ { "text", "start", "end" } ] }` from the result.

Keep both takes when the person hasn't chosen; name them `voiceover-take1.mp3` and `words-take1.json`, and so on.

## 5. Check the timing

```bash
node dist/cli.js stills <folder>/short.json --words <folder>/words.json --audio <folder>/voiceover.mp3
```

If the engine, browser or ffprobe is unavailable, save the supplied/generated files, report timing checks as unverified and stop before claiming a final timed render. A line that can't be found stops with an error naming it: the narrator probably changed its first word, so fix that line's `vo` to match what was said. A cue word that isn't heard gives a warning and the element is spaced evenly; change the cue to a word that was said. Look at the stills before rendering the full video.
