---
title: OnCue compatibility with Claude regression protection
status: todo
created: 2026-10-25
type: feature
---

# OnCue compatibility with Claude regression protection

## Summary

Support Claude and ChatGPT through shared skills and a shared rendering engine, with separate host metadata and an optional remote renderer.

**Preserving existing Claude behavior is a release requirement.** New OpenAI support must not introduce server, authentication, dependency, or workflow requirements into existing local Claude usage. Release only after the Claude regression checks pass; label unavailable checks as unverified.

## 1. Establish the Claude baseline

Before editing, capture the current package and results for:

- Marketplace installation as `oncue@oncue` and local loading with `--plugin-dir`.
- Discovery and invocation of all five existing skills.
- Storyboard creation, approval, preview stills, and conditional Design canvas output.
- The existing ElevenLabs generation and transcription sequence, including two takes, voice selection, and duplicate-charge protection.
- Deck generation, silent video, voiced video, and artifact delivery.

Use the bundled Gleaner example plus a fixture covering all eight scene kinds. Record output dimensions, slide count, speaker notes, scene timing, cue warnings, frame samples, and audio properties.

Preserve a baseline package for comparison and rollback. Do not alter the existing untracked root lockfile as part of this work.

## 2. Add packaging without changing Claude installation

- Retain Claude’s marketplace and plugin manifest at their existing locations.
- Preserve the marketplace name, plugin name, five skill names, directory layout, and installation commands.
- Add a portable plugin manifest and a separate OpenAI marketplace.
- Keep the Claude plugin manifest as the version source. Generate portable metadata through an explicit packaging command and validate synchronization.
- Package the complete engine and supporting resources; verify discovery from installed cache locations.
- Keep OpenAI-specific metadata out of Claude’s manifest.
- Preserve Claude-specific instructions in `CLAUDE.md`; add equivalent contributor guidance for other agents without changing runtime behavior.

**Acceptance:** both host packages validate, and existing Claude installation and skill invocation work without additional configuration.

## 3. Extend skills while preserving existing Claude workflows

- Add shared capability checks that run per operation: storyboard text must not require Chromium; deck generation must not require ffmpeg.
- Resolve resources from the installed skill location and install dependencies only in a copied, writable workspace.
- Prefer local rendering when available. Use remote rendering only when connected and needed, or explicitly requested.
- Before uploading local project assets remotely, explain the transfer and obtain authorization unless already granted.
- Keep Claude’s download-recovery instructions, canvas option, background-render guidance, and local delivery behavior as conditional host branches.
- Preserve storyboard approval before paid generation, existing authorization overrides, voice comparison, and stills inspection before full rendering.
- Keep stage-specific skills independently usable.

For voiceover:

- Discover available tools and schemas, then select a supported adapter.
- Preserve the full current `creative_*` adapter: flow linkage, voice selection, whole-script generation, two takes, polling, transcription, uploads, and saving files.
- Preserve supported current model selections; change them only when tool capabilities require it.
- Never silently switch voice providers or repeat a paid generation.
- Continue accepting supplied audio and timestamps without a connector.
- Preserve both Scribe-style transcript objects and bare word arrays. Ignore supported non-word records; normalize actual word records without dropping valid timestamps.
- Report malformed timing data with actionable errors; do not rewrite script wording or timing silently.

**Acceptance:** the Claude adapter completes its existing workflow, and missing optional tools produce accurate fallbacks rather than nonexistent tool calls.

## 4. Isolate engine and remote-service changes

Preserve these local interfaces:

- `check`, `script`, `deck`, `stills`, and `video` commands and existing flags.
- `short.json`, relative asset resolution, supported fonts, scene kinds, and cue behavior.
- Output filenames, default directories, silent-preview behavior, and paired audio/transcript requirements.
- Deterministic animation and committed compiled files.
- Playwright as an optional peer dependency.

Extract reusable rendering functions behind the existing CLI. Importing the engine must not start a server, execute the CLI, or require remote-service configuration.

Keep server dependencies in a separate package. Remote authentication, quotas, filesystem restrictions, retention, and deployment dependencies must not become requirements for local rendering.

Implement an optional asynchronous Streamable HTTP MCP service with:

| Tool | Contract |
|---|---|
| `prepare_asset_upload` | Validates file metadata and returns an expiring upload URL and asset ID |
| `submit_render` | Accepts spec, owned asset IDs, output selection, and idempotency key; returns job ID |
| `get_render_job` | Returns status, progress, warnings, and expiring artifact links |
| `cancel_render_job` | Cancels queued or active work and terminates rendering processes |

Use a Docker reference stack with API, worker, PostgreSQL queue, and persistent artifact storage. Protect it using an external OAuth provider and user allowlist. Hosting and identity-provider provisioning remain deferred.

Remote defaults: 1080×1920, 30 fps, maximum three minutes, 100 MB per asset, one active job per user, 30-minute timeout, 24-hour retention, and 15-minute download links. Validate uploaded assets, isolate users, and prohibit arbitrary server-side file paths and URL fetching.

**Acceptance:** local Claude rendering succeeds with the service disconnected and all remote configuration absent.

## 5. Verification, release, and rollback

Run checks after each subsystem change so failures can be attributed before further refactoring.

Required release checks:

- Existing repository validation, direct Claude plugin validation, engine type checks, and synchronized compiled output.
- Clean Claude marketplace installation and local plugin loading.
- All five Claude skills with remote tools absent; separate checks with remote tools connected.
- CLI compatibility and both accepted transcript formats.
- Baseline comparisons for slide structure, notes, scene timing, warnings, and representative rendered frames. Investigate differences rather than automatically updating expected results.
- Actual PowerPoint rendering inspection; HTML stills alone are insufficient.
- Silent and voiced MP4 verification through ffprobe and encoded-frame inspection.
- Voice-adapter tests with recorded tool responses, plus a separately authorized live integration check.
- ChatGPT local and remote workflows.
- Remote authorization, user isolation, idempotency, cancellation, worker interruption, timeout, and cleanup tests.

Bump the minor version only after the gates pass. Document every intentional behavior change. Do not claim full Claude regression verification when live connector or rendering checks remain unavailable.

Keep remote rendering disableable without disabling the plugin. If a regression is found, hold the release and restore the baseline behavior before continuing.

Production deployment, public-directory submission, push, and merge are separate actions. Public signup, billing, and a new voice integration remain excluded.
