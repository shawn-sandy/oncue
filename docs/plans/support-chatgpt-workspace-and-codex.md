---
status: todo
type: feature
created: 2026-10-26
modified: 2026-11-01
repo-name: oncue
workflow: never
artifact-url: https://claude.ai/artifact/Djf6ZAqSh2LMg17XWyQDCE
issue: https://github.com/shawn-sandy/oncue/issues/12
glance: OnCue 1.7.2 has eight skills and working local renders, but setup still assumes Claude and the renderer cannot select an installed browser. Keep the existing marketplace, give each host accurate setup and recovery instructions, declare each skill's requirements, and add a tested Chromium path override. Verify the installed plugin in Codex and test a branch or commit import in ChatGPT before claiming its outputs work there.
---

# Plan: Run OnCue in Codex and imported into ChatGPT, with setup that knows which product it is in

## Objective

Make the existing OnCue plugin usable in Codex and through a ChatGPT workspace marketplace import, while preserving Claude workflows. Give all eight skills accurate capability requirements and fallbacks, and let rendering use an installed Chromium through `ONCUE_CHROMIUM_PATH`; report each host's verified outputs and limitations.

## Context

Reviewed against `origin/main` at `071b12f`, OnCue 1.7.2, on 2026-11-01. This is an implementation plan; the review updates this document only. The compatibility changes below have not been implemented.

The current skills are `setup`, `research`, `storyboard`, `visuals`, `voiceover`, `vertical-deck`, `animate-short` and `explainer-video`. Since the original plan, OnCue added research and image workflows, theme and design-system discovery, landscape and custom output sizes, image decoding checks, timing-overlap warnings, and improved default still timing. Preserve those behaviors. A custom-size video retains the exact requested size; decks still select the supported portrait or landscape slide aspect.

The repository already has the engine `test` script, root `engine:test`, and CI steps for validation, typechecking and tests. Those are baseline infrastructure, not new deliverables. CI intentionally skips browser tests when Chromium is unavailable; that does not verify rendering.

Current compatibility gaps:

- `setup/SKILL.md` selects installation advice from whether `claude` exists on PATH, reads only the Claude manifest, and supplies only Claude connection and network instructions. Multiple CLIs can coexist on one machine.
- `explainer-video` and `voiceover` direct all hosts to claude.ai network settings. Delivery in `explainer-video` and `animate-short` assumes a linked computer.
- `engine/src/capture.ts` calls `chromium.launch()` without an executable override. A host with a usable browser outside Playwright's cache cannot select it. Browser availability and download restrictions in ChatGPT remain unobserved here.
- `storyboard/references/theme.md` contains both generic wording that assumes Claude and a legitimate, conditional adapter for claude.ai Design System artifacts. A blanket provider-name ban would remove working Claude behavior. The storyboard also calls preview stills “always available” despite requiring a browser.
- `visuals/SKILL.md` uses `npx playwright screenshot` for diagrams. Adding an engine-only override does not make that separate CLI honor `ONCUE_CHROMIUM_PATH`.

Official OpenAI documentation checked on 2026-11-01 supports the existing `.claude-plugin/marketplace.json` and local plugin source paths for workspace import. Import accepts a branch, tag or commit, and administrators can request **Sync now**. A test import need not wait for merge into `main`. Importing a plugin does not grant access to external apps or connect a member's account. Public-directory archive conversion is a separate route and is not a prerequisite for this plan.

Older reports about ChatGPT containers are not evidence of current Node versions, registry access, network settings, timeouts or browser availability. Probe the actual target session and keep local Codex results separate from ChatGPT results.

### Evidence recorded on 2026-11-01

- Local checkout: `071b12f`, plugin 1.7.2; eight skill folders. Existing untracked plan and root lockfile were preserved.
- Local `npm run validate`: passed, including Claude plugin validation.
- Local engine `npm ci`: passed. After installing the optional Playwright package, `npm run typecheck` in `plugins/oncue/engine`: passed.
- Local `npm run engine:test`: 107 passed, zero failed, zero skipped when Chromium was allowed to launch outside the filesystem/process sandbox. The sandboxed run passed 96 and skipped 11 browser tests; that run alone was insufficient.
- Local `node dist/cli.js check examples/gleaner/short.json`: nine beats and `OK.` These results establish the current baseline, not correctness of the future override.
- Local `codex plugin --help`, `codex plugin add --help` and `codex plugin marketplace upgrade --help` expose the planned command families. Help describes upgrade as refreshing marketplace snapshots; whether an installed copy also refreshes still needs an isolated install/update experiment.
- Codex installed-session discovery: not tested in this review. The earlier plan reported an isolated 1.2.0 install, which is historical and does not verify the current eight skills.
- ChatGPT container probe: not tested. Node, npm installation, native dependency loading, Chromium, ffmpeg/ffprobe, audio downloads and command duration remain unknown.
- Import: workspace import not tested. Mounting `engine/` alongside the skills and resolving `../../engine` remain target-host release checks.

### Capability Contract

Check the operation requested, rather than blocking every stage on all dependencies. Use these distinctions in compatibility metadata, setup's report and the README:

| Operation | Required capability | Fallback or limitation |
| --- | --- | --- |
| Research and text storyboard | Read supplied material; search for claims requiring outside sources; write access to save files | Use supplied sources and return text when tools or file access are absent; mark unverified facts |
| Spec validation and script extraction | Node 22+, installed engine dependencies, readable spec and referenced assets | Return draft text; say engine checks were not run |
| Deck | Validation requirements and writable output folder | No browser, ffmpeg or voice connector required |
| Preview stills | Engine plus Playwright package and a launchable Chromium | Return the beat table; do not label stills universally available |
| Visual placement | Supplied or sourced image, writable project, engine to validate placement | Image generation is optional; retain truth rules and attribution; do not change narration |
| Diagram rasterization | Engine's Playwright package and the same browser selection as stills | Keep a source diagram and report PNG generation unverified when no browser runs |
| Silent preview video | Stills requirements plus ffmpeg | Deliver spec, table, deck or stills according to availability |
| Generated voiceover | Connected ElevenLabs tools matching the workflow, approved script and generation cost | Supplied MP3 plus matching `words.json`; MP3 alone still needs transcription capability |
| Voice-timed stills | Stills requirements, matching audio/timestamps and ffprobe | Estimated preview stills only when the user accepts the fallback |
| Final video | Video requirements, matching audio/timestamps and ffprobe | Report the exact missing capability; never present a silent preview as final audio output |

## Decisions

- **Scope:** retain the existing marketplace and `.claude-plugin/plugin.json` as the single version source. Do not add a second manifest, separate marketplace, hosted renderer, server package, OAuth service, or generated standalone skill in this change. The existing untracked `docs/plans/claude-chatgpt-compatibility.md` describes a broader proposal and is not adopted or edited by this plan.
- **Host selection:** use the product running the conversation and its available capabilities, not CLI presence. Distinguish local Codex, locally executed ChatGPT Work and cloud execution when reporting filesystem and network access. Unknown capabilities are untested, not missing.
- **Version lookup:** report the version from the installed plugin's readable manifest or host-provided metadata. Support a converted `.codex-plugin/plugin.json` when present, without adding it to the source package. If no version metadata is readable, say so and continue capability checks.
- **Requirements:** add a single-line `compatibility` field to every current skill, at most 500 characters. This is descriptive metadata, not proof the host can execute the workflow. Keep `argument-hint` for the current distribution; strict standalone Agent Skills validation remains a separate follow-up.
- **Provider wording:** shared workflow prose is neutral. Keep installation, account and network commands in setup's explicit host branches. Preserve the explicitly Claude-only Design System adapter in `storyboard/references/theme.md`, guarded by the actual tool and supported type; other hosts skip it. Generic tools named “Artifact” do not establish compatibility with that API.
- **Browser:** export `launchOptions(env = process.env)` and pass its result to Chromium. An unset or empty `ONCUE_CHROMIUM_PATH` returns `{}`; a nonempty path returns `{ executablePath }` unchanged, including spaces. An invalid override fails visibly and never silently falls back. The Playwright package is still required; an executable override does not install it or guarantee browser-version compatibility.
- **Installation:** copy the bundled engine into a writable workspace before installing. Keep Playwright an optional peer and retain the existing `--save-dev` installation guidance for the copied engine. Do not ship `node_modules`, change the engine's dependency policy, or mutate the plugin cache.
- **Voiceover:** discover the available ElevenLabs tools and schemas before using the documented `creative_*` flow. Preserve whole-script generation, two takes, approval checkpoints and duplicate-charge protection. If this tool set is unavailable, offer the existing supplied MP3 plus matching timestamps path; never invent tools or switch providers silently. Live paid generation is not a compatibility smoke test.
- **Release:** at the reviewed baseline, the next minor would be 1.8.0. Re-read the actual base version before implementation and choose its next minor, because another release may land first. A documentation-only update to this plan needs no plugin version bump.
- **Completion:** local compatibility work may ship with ChatGPT explicitly marked untested or partially available when the target session cannot be exercised. Do not mark the complete plan finished or advertise verified ChatGPT rendering until the target-host acceptance criteria pass.

## Files

- docs/plans/support-chatgpt-workspace-and-codex.md (modified) — record probe, import and verification evidence
- plugins/oncue/engine/src/capture.ts (modified) — shared browser launch options
- plugins/oncue/engine/dist/capture.js (generated) — rebuild from TypeScript
- plugins/oncue/engine/test/capture.test.mjs (new) — launch-option unit coverage
- plugins/oncue/engine/test/capture-smoke.test.mjs (new) — CLI smoke proving the override reaches launch
- plugins/oncue/engine/test/helpers/browser.mjs (new) — shared browser prerequisites
- plugins/oncue/engine/test/fit.test.mjs (modified) — use shared browser selection
- plugins/oncue/engine/test/image-stills.test.mjs (modified) — use shared browser selection
- plugins/oncue/engine/test/landscape.test.mjs (modified) — use shared browser selection
- scripts/validate.mjs (modified) — requirements metadata and scoped wording checks
- scripts/test/validate.test.mjs (new) — isolated validator fixtures
- plugins/oncue/skills/setup/SKILL.md (modified) — requirements and host/capability instructions
- plugins/oncue/skills/research/SKILL.md (modified) — requirements and host/capability instructions
- plugins/oncue/skills/storyboard/SKILL.md (modified) — requirements and host/capability instructions
- plugins/oncue/skills/visuals/SKILL.md (modified) — requirements and host/capability instructions
- plugins/oncue/skills/voiceover/SKILL.md (modified) — requirements and host/capability instructions
- plugins/oncue/skills/vertical-deck/SKILL.md (modified) — requirements and host/capability instructions
- plugins/oncue/skills/animate-short/SKILL.md (modified) — requirements and host/capability instructions
- plugins/oncue/skills/explainer-video/SKILL.md (modified) — requirements and host/capability instructions
- plugins/oncue/skills/storyboard/references/theme.md (modified) — generic wording, guarded Claude adapter and fetch fallback
- README.md (modified) — install paths, limitations, override and implementation changelog
- plugins/oncue/.claude-plugin/plugin.json (modified) — next minor implementation release
- package.json (modified) — run validator tests while retaining engine scripts
- .github/workflows/validate.yml (modified) — run validator tests while retaining existing checks

## Steps

### Phase: Probe

1. Capture a fresh baseline and probe the actual ChatGPT target session, recording the product, execution environment, date and loaded plugin version in Decisions. Check `node --version`, `npm --version`, registry metadata for `pptxgenjs`, `sharp` and `playwright`, and separately locate ffmpeg, ffprobe and Chromium; inspect existing Playwright resolution and executable paths when available. In a disposable writable engine copy, attempt the real dependency installation and load `sharp` and `pptxgenjs`, recording errors and exit codes. Exercise a small representative command/render under the host's execution lifecycle instead of a 150-second idle sleep. Why: registry metadata alone cannot prove installation or native binary loading, and another product's sandbox says nothing about ChatGPT. Verify: the record contains an observed result or “not tested” for every capability, with no asserted global ChatGPT network policy and no paid connector calls.
2. Test installed resource discovery using a fresh temporary `CODEX_HOME` and, when a workspace administrator can test it, a ChatGPT import pinned to the proposed branch or commit. Resolve all eight skills, sibling references and `<plugin>/engine/dist/cli.js` from the loaded skill path; report the actual readable manifest. Why: a source checkout cannot prove installed mounts preserve `../../engine`, and an import can be tested before merging. Verify: record the selected commit, installation/import report, eight discovered skill names and a successful bundled-example check from the copied engine, or explicitly record which checks were not tested.

### Phase: Engine

3. Write `capture.test.mjs` and a CLI-level `capture-smoke.test.mjs` before adding the override. Cover unset, empty, explicit and space-containing paths; exercise stills with a valid browser and an invalid override in a temporary project with real assets. Why: a helper-only test can pass even when `chromium.launch` ignores its result. Verify: the new tests fail against the current build because the override is absent or ignored; retain the actual failure output without requiring one specific Node import-error message.
4. Implement `launchOptions` in `src/capture.ts`, pass it to Chromium, rebuild committed `dist/`, and have browser-test prerequisites/direct launches share it through `test/helpers/browser.mjs`. Why: the override must work in both CLI rendering and the existing browser regression suites without changing default behavior. Verify: typechecking and unit tests pass; a valid override produces viewable stills, an invalid override exits nonzero naming its path, default rendering still works, and the full browser-enabled suite reports zero skips.

### Phase: Skills and validation

5. Add fixture tests and checks to `scripts/validate.mjs` for nonempty single-line `compatibility` values of at most 500 characters on every discovered skill. Add requirements to all eight skills using the Capability Contract. Why: the plan must cover research and visuals as well as the original six skills, while keeping text-only work available without the renderer. Verify: isolated fixtures with missing, empty, multiline or oversized values fail, valid values pass, all eight real skills validate, and fixture cleanup leaves the checkout untouched.
6. Add scoped provider-wording checks covering skill bodies and recursive Markdown references, then update shared network, fetch and delivery instructions. Reject Claude-specific commands outside setup and unguarded product assumptions; allow provider names only in setup's host branches and the documented Claude Design System adapter. Keep that adapter conditional, and correct the storyboard's “always available” stills claim. Why: scanning only SKILL.md misses the new theme guide, while banning every occurrence of “Claude” breaks supported behavior. Verify: negative fixtures catch unconditional Claude commands/settings and linked-computer assumptions; positive fixtures retain guarded host instructions; manually inspect the guard and confirm both browserless storyboard and Claude design-system routes have usable next steps.
7. Rewrite setup's plugin, installation, browser, connector and network checks into explicit host branches, preserving writable engine copies and version comparison. Verify Codex install/update behavior in an isolated home before documenting commands; for ChatGPT, report the loaded version and explain the administrator's branch/commit selection, daily sync and Sync now. Report each operation independently, never send ChatGPT users to claude.ai settings, and preserve the supplied-audio fallback when ElevenLabs is unavailable. Why: host identity and observed capabilities determine valid recovery, not whether a CLI happens to be installed. Verify: Codex commands work against the test package without changing user configuration, missing Node/browser/ffmpeg/ffprobe/connector cases match the Capability Contract, and ChatGPT claims trace to official documentation or dated target-session evidence.
8. Update the visuals diagram recipe to launch Playwright with the same `launchOptions` as the engine instead of relying on the screenshot CLI to honor the custom variable. Why: otherwise stills work with an installed browser but the new visuals workflow still attempts the missing default browser. Verify: rasterize a small diagram to a PNG with an explicit browser path, inspect it, and confirm an invalid override is reported rather than silently ignored.

### Phase: Verification and release

9. Run the new validator fixture tests in root validation and CI, retaining the existing engine typecheck/test scripts and Playwright optional-peer policy. Update README installation, capability limitations and browser-override instructions; bump the plugin's next minor version and add its changelog entry only when implementing the runtime change. Why: the current repository already runs engine tests, and release instructions must describe the final package rather than the old six-skill proposal. Verify: root validation includes the new fixture tests, the three existing root checks pass, a clean engine build leaves no uncommitted dist differences, and the manifest version matches the first changelog heading.
10. Verify the installed candidate in Claude, Codex and the accessible ChatGPT target, recording outputs by host and selected commit. Exercise preview stills, deck, a short silent video and a short video with bundled matching audio/timestamps; include landscape/custom-size and image-beat regressions through the existing suite. Why: local tests prove engine behavior but not ChatGPT mounting, installation, downloads or execution duration. Verify: inspect stills and deck slides where an office renderer is available, probe MP4 size/audio with ffprobe, inspect encoded frames, preserve Claude approvals and fallback behavior, and record every unavailable live check as unverified before making any compatibility claim.

## Tests

Tier 1 — the implementation changes rendering code and skill validation. Existing engine coverage remains part of the regression baseline.

- Objective: `engine/test/capture-smoke.test.mjs` invokes the shipped CLI with an explicit valid browser, proves a still is written with the fixture's expected content, and asserts an invalid path fails visibly. `scripts/test/validate.test.mjs` runs the actual validator against temporary package fixtures to prove requirements and wording checks. Run: `npm run validate && npm run engine:test`; root validation executes the validator fixtures and the engine runner executes the browser smoke. In CI without a browser, report the browser smoke as skipped; local release verification requires it to execute.
- **Unit:** `engine/test/capture.test.mjs` checks exact launch options for an unset value, empty value, explicit executable and a path containing spaces. Existing defaults remain unchanged. No shell concatenation of paths.
- **Integration:** existing fit, landscape and image-stills tests use the same override for browser prerequisites and CLI children. Test diagram rasterization with that browser too. Verify preexisting timing-overlap warnings, default still selection, image validation, themes and deck aspect selection remain covered by their existing tests.
- **Installed-host E2E:** verify all eight skills and sibling engine/reference paths from installed caches in Codex and the selected ChatGPT import. Exercise the available output pipeline and inspect results, keeping local and cloud evidence separate. Use the bundled example audio to avoid paid generation. A live ElevenLabs generation remains separately authorized and is not required to claim the supplied-audio route works.

## Acceptance Criteria

- [ ] All eight skills are discoverable in an installed Codex session, with sibling references and engine files reachable.
- [ ] All eight skills have validated requirements consistent with the Capability Contract; missing optional rendering tools do not block research or text storyboard output.
- [ ] Setup uses the conversation's host, reports readable version metadata or its absence, and gives accurate host-specific install, update, connection and download recovery instructions.
- [ ] Shared skills and references have no unconditional Claude-only command, settings or linked-computer assumptions; Claude's guarded Design System adapter still works when its actual tool is available.
- [ ] The explicit browser override works for engine stills/video, diagrams and browser test prerequisites; an invalid override fails visibly, and an unset/empty override preserves defaults.
- [ ] Root validation, engine typechecking and engine tests pass; the local browser-enabled verification reports zero skipped browser tests and generated dist matches a clean build.
- [ ] Claude retains existing install paths, approval checkpoints, voice workflow, local delivery and optional artifact behavior; no server or new external account is required for local rendering.
- [ ] A dated ChatGPT branch/commit import record confirms all eight skills, readable engine files, dependency installation and the outputs claimed in the README. Any unavailable operation is identified as blocked or untested with its observed reason.
- [ ] Small silent and supplied-audio video outputs are inspected and probed in each host claimed to support them; deck structure and output dimensions retain the current orientation rules.
- [ ] The implementation version is the next minor of its actual base and matches the README changelog; a release with incomplete ChatGPT evidence makes that limitation explicit and leaves the affected criteria unchecked.

## Verification

Before implementation, refresh the default-branch baseline and re-read the version and skill inventory. After changes, run `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` from the repo root, then build the engine and confirm generated files match the candidate. Browser launch permissions must allow tests to execute; a zero exit code with browser skips is incomplete verification. In a writable copy, run the example deck and voice-timed stills, then the short silent and supplied-audio video checks; inspect actual outputs, not just log messages.

Install the candidate into an isolated Codex home, check the installed version, then verify discovery in an interactive signed-in session without copying or modifying the user's credentials. Exercise an update from an older package so README instructions distinguish marketplace refresh from installed-copy refresh. Verify the existing Claude loading paths and the unchanged approval/connector behaviors; label unavailable live voice checks explicitly.

For ChatGPT, have an authorized administrator test the repository URL with an explicit candidate branch or commit, read the saved import report and start a new session with that installed version. Use Sync now when needed; wait for an observed successful import, not an assumed daily schedule. Verify eight skills, referenced files, writable engine setup and the per-operation output report. This is a separate target environment from the local Codex sandbox. If no test workspace is available, record “workspace import not tested,” keep its acceptance criteria unchecked and label the README accordingly. Merging and public submission remain separate actions.

## Next Steps

- Address missing host binaries only after observation.
  ```text
  In shawn-sandy/oncue, use the dated ChatGPT probe in docs/plans/support-chatgpt-workspace-and-codex.md to identify an output blocked by ffmpeg, ffprobe, Chromium or npm. Investigate the smallest host-supported remedy and verify it in that same target session. Do not infer binary availability from npm metadata or add a hosted service without a separate approved plan.
  ```
- Package for standalone uploads or public distribution separately.
  ```text
  In shawn-sandy/oncue, plan a self-contained skill or public plugin archive only for the distribution route requested. Include all eight current skills and their references, the engine and generated metadata from the existing version source. Verify the target host's validator and installed resource paths, and keep the current Claude marketplace installation working.
  ```

## Unresolved Questions

- Which ChatGPT target can be tested?
  ```text
  For docs/plans/support-chatgpt-workspace-and-codex.md in shawn-sandy/oncue, identify an available ChatGPT workspace administrator and the intended execution surface. Test an explicit candidate branch or commit without changing an existing production marketplace configuration unless authorized. If unavailable, record workspace import not tested and keep runtime claims limited to the hosts actually exercised.
  ```

## Resources

- [OpenAI: Import and sync plugins from GitHub](https://learn.chatgpt.com/docs/enterprise/plugin-management) — supported Claude marketplace layout, administrator access, branch/tag/commit selection, import reports and Sync now; checked 2026-11-01.
- [OpenAI: Submit a Claude Code plugin](https://developers.openai.com/plugins/guides/submit-claude-plugin) — provider-neutral shared instructions, product-specific exceptions, archive conversion and clean-environment resource checks; public submission is outside this plan.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) — skill structure, discovery and optional dependency metadata.
- [Agent Skills specification](https://agentskills.io/specification) — requirements metadata; strict standalone validation is outside this distribution change.
- `docs/plans/support-other-voice-engines.md` — overlapping setup/voiceover work; rebase onto whichever implementation lands first and preserve its supported adapter behavior.
- `docs/plans/add-guided-project-setup.md` — overlapping setup work; inspect the actual base before editing or choosing a release version.

## Review Notes (2026-11-01)

Direct source review applied these corrections: six skills became eight; obsolete test/CI creation tasks became integration with the existing runner; stale 1.3.0/1.4.0 examples became a next-minor rule; container assertions became target-session probes; metadata-only npm checks became actual installation/native-loading checks; idle timeout probing became representative work; main-only post-merge verification became a branch/commit test import; the blanket provider ban became scoped checks with a preserved Claude adapter; and diagram browser selection plus end-to-end override testing were added. The separate untracked remote-renderer proposal remains unchanged. The reviewer-panel Workflow tool was unavailable, so no panel findings or consensus are claimed.

Publication: the existing artifact URL is preserved, but this review has not republished that external page. The Markdown file is the updated source of truth.
