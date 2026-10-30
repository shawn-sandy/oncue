#!/usr/bin/env node
/**
 * oncue engine.
 *
 *   node dist/cli.js check    <short.json>                     validate; print the layout, beats, VO script, estimated length and low-contrast colour pairs
 *   node dist/cli.js script   <short.json>                     print the voiceover script, one line per beat
 *   node dist/cli.js deck     <short.json> [--out deck.pptx]    native, editable PowerPoint, 9:16 or 16:9 (VO in speaker notes)
 *   node dist/cli.js stills   <short.json> [--words w.json --audio vo.mp3] [--at 1,5,9]   QA frames (default: one per scene, just before it fades out)
 *   node dist/cli.js video    <short.json> [--words w.json --audio vo.mp3] [--out short.mp4]
 *
 * The size comes from short.json's format: wider than tall renders the landscape layout, anything else the portrait one.
 * stills and video write build/fit.json and warn about any scene shrunk to fit its frame.
 * Without --words/--audio, timings are estimated from the script and the video is silent: a preview.
 * Outputs go to build/ next to short.json unless --out is given.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderStills, renderVideo, type Fit, type Size } from "./capture";
import { deckSize, writeDeck } from "./deck";
import { writeScenes } from "./scenes";
import { checkPictures, contrastWarnings, loadSpec, stageFor, type LoadedSpec, type Spec } from "./spec";
import { buildTimeline, estimateWords, readWords, stillTimes, type Timeline } from "./timeline";

const ENGINE = resolve(__dirname, "..");

function flags(argv: string[]): { pos: string[]; opt: Record<string, string> } {
  const pos: string[] = [], opt: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) { opt[a.slice(2)] = argv[i + 1] ?? ""; i++; } else pos.push(a);
  }
  return { pos, opt };
}

const audioSeconds = (file: string): number =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());

function timeline(loaded: LoadedSpec, opt: Record<string, string>): { tl: Timeline; audio: string | null } {
  const { words: w, audio: a } = opt;
  if ((w && !a) || (a && !w)) throw new Error("Pass --words and --audio together (the transcript must be of that audio).");
  if (w && a) {
    const tl = buildTimeline(loaded.spec, readWords(resolve(w)), audioSeconds(resolve(a)));
    return { tl, audio: resolve(a) };
  }
  const est = estimateWords(loaded.spec);
  return { tl: buildTimeline(loaded.spec, est.words, est.seconds), audio: null };
}

async function prepare(loaded: LoadedSpec, opt: Record<string, string>): Promise<{ html: string; tl: Timeline; audio: string | null; build: string; size: Size }> {
  const build = join(loaded.dir, "build");
  mkdirSync(build, { recursive: true });
  const html = await writeScenes(loaded, join(build, "scenes"), ENGINE);
  const { tl, audio } = timeline(loaded, opt);
  writeFileSync(join(build, "timeline.json"), JSON.stringify(tl, null, 2));
  for (const w of tl.warnings) console.warn("warning:", w);
  return { html, tl, audio, build, size: { width: loaded.spec.format.width, height: loaded.spec.format.height } };
}

/** Writes build/fit.json for tests and tools, and one warning per scene the fit guard shrank, for people. */
function reportFit(build: string, spec: Spec, fit: Fit[]): void {
  writeFileSync(join(build, "fit.json"), JSON.stringify(fit, null, 2));
  const { width, height } = spec.format;
  for (const f of fit) {
    if (f.scale >= 1 && f.fits) continue;
    const kind = spec.lines[f.scene - 1]?.scene.kind ?? "?";
    console.warn(`warning: scene ${f.scene} (${kind}) ${f.fits ? `shrunk to ${f.scale}×` : `still overflows at ${f.scale}×`} to fit ${width}×${height}; cut its copy to show it full size.`);
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opt } = flags(rest);
  const specFile = pos[0];
  if (!cmd || !specFile) { console.log(readHelp()); process.exit(cmd ? 1 : 0); }
  const loaded = loadSpec(resolve(specFile));
  await checkPictures(loaded);
  const { spec } = loaded;

  switch (cmd) {
    case "check": {
      const est = estimateWords(spec);
      const { wide } = stageFor(spec.format);
      console.log(`format ${spec.format.width}×${spec.format.height}: ${wide ? "landscape" : "portrait"} layout\n`);
      spec.lines.forEach((l, i) => console.log(`${String(i + 1).padStart(2)} ${l.scene.kind.padEnd(5)}  ${l.vo}`));
      console.log(`\n${spec.lines.length} beats, about ${Math.round(est.seconds)}s of voiceover. OK.`);
      for (const w of contrastWarnings(spec.brand.colors)) console.warn("warning:", w);
      if (!wide && est.seconds > 170) console.warn("warning: YouTube Shorts allow up to 3 minutes; this is close to or over the limit.");
      return;
    }
    case "script":
      console.log(spec.lines.map((l) => l.vo).join("\n\n"));
      return;
    case "deck": {
      const out = resolve(opt["out"] ?? join(loaded.dir, "build", "deck.pptx"));
      mkdirSync(resolve(out, ".."), { recursive: true });
      const d = deckSize(spec.format);
      if (Math.abs(d.width / d.height - spec.format.width / spec.format.height) > 0.01)
        console.log(`note: the deck is ${d.width}×${d.height} in (${d.width > d.height ? "landscape specs get 16:9" : "portrait and square specs get 9:16"}); ${spec.format.width}×${spec.format.height} applies to the video only.`);
      console.log("wrote", await writeDeck(loaded, out));
      return;
    }
    case "stills": {
      const p = await prepare(loaded, opt);
      const times = opt["at"] ? opt["at"].split(",").map(Number) : stillTimes(p.tl);
      const dir = join(p.build, "stills");
      mkdirSync(dir, { recursive: true });
      const { files, fit } = await renderStills(p.html, p.tl, p.size, dir, times);
      for (const f of files) console.log(f);
      reportFit(p.build, spec, fit);
      return;
    }
    case "video": {
      const p = await prepare(loaded, opt);
      const out = resolve(opt["out"] ?? join(p.build, p.audio ? "short.mp4" : "preview-silent.mp4"));
      reportFit(p.build, spec, await renderVideo(p.html, p.tl, p.size, out, p.audio));
      return;
    }
    default:
      throw new Error(`Unknown command "${cmd}".\n${readHelp()}`);
  }
}

function readHelp(): string {
  return "usage: node dist/cli.js <check|script|deck|stills|video> <short.json> [--words words.json --audio vo.mp3] [--out file] [--at t1,t2]";
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
