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
export function estimateWords(spec: Spec): { words: Word[]; seconds: number } {
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

export function buildTimeline(spec: Spec, words: Word[], audioSeconds: number): Timeline {
  const warnings: string[] = [];
  // Split the transcript at the first word of each line, which must begin a sentence.
  const starts: number[] = [];
  let from = 0;
  spec.lines.forEach((line, li) => {
    const first = norm(line.vo.split(/\s+/)[0] ?? "");
    const ok = (k: number): boolean => k >= from && norm(words[k]!.text) === first && (k === 0 || /[.?!]["”']?$/.test(words[k - 1]!.text));
    let i = words.findIndex((_, k) => ok(k));
    if (i < 0) i = words.findIndex((w, k) => k >= from && norm(w.text) === first);
    if (i < 0) throw new Error(`Line ${li + 1} ("${line.vo.slice(0, 40)}…") not found in the transcript. Re-transcribe, or make lines[${li}].vo match what was said.`);
    starts.push(i);
    from = i + 1;
  });

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
