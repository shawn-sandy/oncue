/**
 * Turns short.json + a word-timestamped transcript into timeline.json:
 * when each scene starts and when each animated slot enters.
 */
import { readFileSync } from "node:fs";
import type { Spec } from "./spec";
import { slots } from "./cues";

export interface Word { text: string; type?: string; start: number; end: number }
export interface SceneTiming { start: number; end: number; cues: Record<string, number> }
export interface Timeline { lead: number; tail: number; duration: number; scenes: SceneTiming[]; warnings: string[] }

/** Anything with one voiceover line per beat or slide: a Spec, or a deck's narration. */
export interface Script { lines: { vo: string }[] }

export const LEAD = 0.3;
export const TAIL = 1.6;

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Accepts ElevenLabs Scribe output ({ words: [...] }) or a bare array of { text, start, end }. */
export function readWords(file: string): Word[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as { words?: Word[] } | Word[];
  const list = Array.isArray(raw) ? raw : raw.words ?? [];
  return list.filter((w) => (w.type ?? "word") === "word" && Number.isFinite(w.start));
}

/**
 * Estimated word timings from the script alone (about 15 characters a second with sentence pauses),
 * for a silent preview before any voiceover exists.
 */
export function estimateWords(spec: Script): { words: Word[]; seconds: number } {
  const words: Word[] = [];
  let t = 0;
  for (const line of spec.lines) {
    for (const text of line.vo.split(/\s+/).filter(Boolean)) {
      const d = Math.max(0.16, text.replace(/[^A-Za-z0-9]/g, "").length / 15);
      words.push({ text, start: t, end: t + d });
      t += d + (/[.?!]["”']?$/.test(text) ? 0.45 : /[,;:]$/.test(text) ? 0.22 : 0.06);
    }
  }
  return { words, seconds: t };
}

/** render.ts starts fading a scene out this long before its end. */
const EXIT = 0.12;

/**
 * The default still for each beat: its last moment before the fade out. Entrances only move forward in time,
 * so no earlier frame in the beat shows more of it, however late its last cue lands.
 */
export function stillTimes(tl: Timeline): number[] {
  return tl.scenes.map((s) => Number(Math.max(s.start, s.end - EXIT).toFixed(2)));
}

/**
 * Splits the transcript at the first word of each line, which must begin a sentence; returns those word indexes.
 * Stops at the first line it cannot find, so a short result means that line is missing.
 */
function lineStarts(spec: Script, words: Word[]): number[] {
  const starts: number[] = [];
  let from = 0;
  for (const line of spec.lines) {
    const first = norm(line.vo.split(/\s+/)[0] ?? "");
    const ok = (k: number): boolean => k >= from && norm(words[k]!.text) === first && (k === 0 || /[.?!]["”']?$/.test(words[k - 1]!.text));
    let i = words.findIndex((_, k) => ok(k));
    if (i < 0) i = words.findIndex((w, k) => k >= from && norm(w.text) === first);
    if (i < 0) break;
    starts.push(i);
    from = i + 1;
  }
  return starts;
}

/**
 * For each line, the line its split start lands in, found by running the split on the script itself. A line that lands
 * in an earlier one would start there, too early: only a sentence the split can still reach matters, not every repeat.
 */
function hosts(spec: Script): number[] {
  const lineOf = spec.lines.flatMap((l, b) => l.vo.split(/\s+/).filter(Boolean).map(() => b));
  return lineStarts(spec, estimateWords(spec).words).map((word) => lineOf[word]!);
}

/**
 * One warning per beat the split would start inside an earlier beat. A warning, not an error, because a
 * transcript punctuated differently may still place the beat. A line it cannot find at all is left for stills to report.
 */
export function splitWarnings(spec: Script): string[] {
  return hosts(spec).flatMap((host, b) => {
    if (host >= b) return [];
    const first = spec.lines[b]!.vo.split(/\s+/)[0];
    return [`beat ${b + 1}'s first word "${first}" is also heard inside beat ${host + 1}, so beat ${b + 1} may start there, too early; reword one of them.`];
  });
}

export function buildTimeline(spec: Spec, words: Word[], audioSeconds: number): Timeline {
  const warnings: string[] = [];
  const starts = lineStarts(spec, words);
  const li = starts.length, missing = spec.lines[li];
  if (missing) throw new Error(`Line ${li + 1} ("${missing.vo.slice(0, 40)}…") not found in the transcript. Re-transcribe, or make lines[${li}].vo match what was said.`);
  const duration = audioSeconds + LEAD + TAIL;
  const scenes: SceneTiming[] = starts.map((wi, s) => {
    const endIdx = s + 1 < starts.length ? starts[s + 1]! : words.length;
    const lineWords = words.slice(wi, endIdx);
    const first = words[wi]!;
    const start = s === 0 ? 0 : LEAD + (words[wi - 1]!.end + first.start) / 2;
    const lineStart = LEAD + first.start;
    const lineEnd = LEAD + (lineWords.at(-1)?.end ?? first.end);
    const cues: Record<string, number> = { line: lineStart };
    const list = slots(spec.lines[s]!.scene);
    list.forEach((slot, k) => {
      if (slot.cue) {
        const want = norm(slot.cue.word);
        const hits = lineWords.filter((w) => norm(w.text).startsWith(want));
        const hit = hits[(slot.cue.nth ?? 1) - 1];
        if (hit) { cues[slot.id] = LEAD + hit.start + (slot.cue.offset ?? 0); return; }
        warnings.push(`scene ${s + 1} ${slot.id}: cue word "${slot.cue.word}" not heard in this line; spacing it evenly instead`);
      }
      // No cue (or not found): spread the slots evenly across the line.
      cues[slot.id] = lineStart + ((k + 0.5) / list.length) * Math.max(0.6, lineEnd - lineStart);
    });
    return { start, end: duration, cues };
  });
  scenes.forEach((sc, i) => { if (i + 1 < scenes.length) sc.end = scenes[i + 1]!.start; });
  return { lead: LEAD, tail: TAIL, duration, scenes, warnings };
}

export type Source = "notes" | "drafted" | "none";
/** One slide's narration: `n` is its place among the visible slides, `source` where the line came from. */
export interface SlideLine { n: number; source: Source; vo: string }
export interface SlideSpan { n: number; start: number; end: number }
/** One recording: a `run` is consecutive slides read in one take, a `clip` is a single slide the split could not place. */
export interface Run { kind: "run" | "clip"; slides: number[]; script: string }

/**
 * When each slide of one take is on screen, in that take's own seconds: from its first word (cut midway through the
 * pause before it, as buildTimeline does) to the next slide's, the last one to the end of the audio.
 */
export function buildSlideTimeline(slides: { n: number; vo: string }[], words: Word[], audioSeconds: number): SlideSpan[] {
  const starts = lineStarts({ lines: slides }, words);
  const missing = slides[starts.length];
  if (missing) throw new Error(`Slide ${missing.n} ("${missing.vo.slice(0, 40)}…") not found in its transcript. Re-transcribe, or check that this take reads that slide's line.`);
  const at = starts.map((wi, s) => (s === 0 ? 0 : (words[wi - 1]!.end + words[wi]!.start) / 2));
  return slides.map((slide, s) => ({ n: slide.n, start: at[s]!, end: at[s + 1] ?? audioSeconds }));
}

/**
 * Groups narrated slides into recordings. Slides the split can place share one continuous take, even across a silent
 * slide. A slide whose first word would be found inside an earlier slide of the take gets its own clip instead, so
 * its line never has to change; the take resumes after it.
 */
export function planSlides(lines: SlideLine[]): { runs: Run[]; silent: number[]; warnings: string[] } {
  const groups: { kind: Run["kind"]; lines: SlideLine[] }[] = [];
  const warnings: string[] = [];
  let open: SlideLine[] | null = null;
  for (const line of lines.filter((l) => l.source !== "none")) {
    const trial = [...(open ?? []), line];
    const host = hosts({ lines: trial }).at(-1)!;
    if (host === trial.length - 1) {
      if (!open) groups.push({ kind: "run", lines: (open = []) });
      open.push(line);
      continue;
    }
    const first = line.vo.split(/\s+/)[0];
    warnings.push(`slide ${line.n}'s first word "${first}" is also heard inside slide ${trial[host]!.n}, so one continuous read would start slide ${line.n} there, too early; ` +
      (line.source === "notes"
        ? `slide ${line.n} keeps its notes unchanged and is recorded as its own clip, an extra take.`
        : `reword slide ${line.n}'s drafted line to open differently, or it is recorded as its own clip, an extra take.`));
    groups.push({ kind: "clip", lines: [line] });
    open = null;
  }
  return {
    runs: groups.map((g) => ({ kind: g.kind, slides: g.lines.map((l) => l.n), script: g.lines.map((l) => l.vo).join("\n\n") })),
    silent: lines.filter((l) => l.source === "none").map((l) => l.n),
    warnings,
  };
}
