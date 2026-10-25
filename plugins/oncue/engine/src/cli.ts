#!/usr/bin/env node
/**
 * oncue engine.
 *
 *   node dist/cli.js check    <short.json>                     validate; print beats, VO script and estimated length
 *   node dist/cli.js script   <short.json>                     print the voiceover script, one line per beat
 *   node dist/cli.js deck     <short.json> [--out deck.pptx]    native, editable 9:16 PowerPoint (VO in speaker notes)
 *   node dist/cli.js stills   <short.json> [--words w.json --audio vo.mp3] [--at 1,5,9]   QA frames (default: one per scene)
 *   node dist/cli.js video    <short.json> [--words w.json --audio vo.mp3] [--out short.mp4]
 *
 * Without --words/--audio, timings are estimated from the script and the video is silent: a preview.
 * Outputs go to build/ next to short.json unless --out is given.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderStills, renderVideo, type Size } from "./capture";
import { writeDeck } from "./deck";
import { writeScenes } from "./scenes";
import { loadSpec, type LoadedSpec } from "./spec";
import { buildTimeline, estimateWords, readWords, type Timeline } from "./timeline";

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

function prepare(loaded: LoadedSpec, opt: Record<string, string>): { html: string; tl: Timeline; audio: string | null; build: string; size: Size } {
  const build = join(loaded.dir, "build");
  mkdirSync(build, { recursive: true });
  const html = writeScenes(loaded, join(build, "scenes"), ENGINE);
  const { tl, audio } = timeline(loaded, opt);
  writeFileSync(join(build, "timeline.json"), JSON.stringify(tl, null, 2));
  for (const w of tl.warnings) console.warn("warning:", w);
  return { html, tl, audio, build, size: { width: loaded.spec.format.width, height: loaded.spec.format.height } };
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opt } = flags(rest);
  const specFile = pos[0];
  if (!cmd || !specFile) { console.log(readHelp()); process.exit(cmd ? 1 : 0); }
  const loaded = loadSpec(resolve(specFile));
  const { spec } = loaded;

  switch (cmd) {
    case "check": {
      const est = estimateWords(spec);
      spec.lines.forEach((l, i) => console.log(`${String(i + 1).padStart(2)} ${l.scene.kind.padEnd(5)}  ${l.vo}`));
      console.log(`\n${spec.lines.length} beats, about ${Math.round(est.seconds)}s of voiceover. OK.`);
      if (est.seconds > 170) console.warn("warning: YouTube Shorts allow up to 3 minutes; this is close to or over the limit.");
      return;
    }
    case "script":
      console.log(spec.lines.map((l) => l.vo).join("\n\n"));
      return;
    case "deck": {
      const out = resolve(opt["out"] ?? join(loaded.dir, "build", "deck.pptx"));
      mkdirSync(resolve(out, ".."), { recursive: true });
      console.log("wrote", await writeDeck(loaded, out));
      return;
    }
    case "stills": {
      const p = prepare(loaded, opt);
      const times = opt["at"] ? opt["at"].split(",").map(Number)
        : p.tl.scenes.map((s) => Number((s.start + 0.85 * (s.end - s.start)).toFixed(2)));
      const dir = join(p.build, "stills");
      mkdirSync(dir, { recursive: true });
      for (const f of await renderStills(p.html, p.tl, p.size, dir, times)) console.log(f);
      return;
    }
    case "video": {
      const p = prepare(loaded, opt);
      const out = resolve(opt["out"] ?? join(p.build, p.audio ? "short.mp4" : "preview-silent.mp4"));
      await renderVideo(p.html, p.tl, p.size, out, p.audio);
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
