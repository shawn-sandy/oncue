/** Stitches a deck's page pictures and its recorded narration into an MP4 with ffmpeg. No browser is involved. */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { readNarration } from "./narration";
import { readSlides, type Transition } from "./slides";
import { LEAD, TAIL, buildSlideTimeline, estimateWords, planSlides, readWords } from "./timeline";

/** Seconds a slide with no narration stays on screen. */
export const DWELL = 4;
const FPS = 30;
/** Seconds each slide change fades over, centred on the cut. 0 keeps hard cuts. */
export const FADE = 0.5;

/** A stretch of the soundtrack: seconds `from`–`to` of recording `run`, or that much silence when there is no run. */
export interface Piece { run?: number; from: number; to: number }
export interface Layout { video: { n: number; seconds: number }[]; audio: Piece[]; duration: number }

export const audioSeconds = (file: string): number =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());

/**
 * Lays slides out in order. A narrated slide plays its span of its recording; a slide with no span is held for DWELL in
 * silence, which cuts the recording at that boundary. The first slide also holds the lead, the last the tail.
 */
export function layout(order: number[], spans: Map<number, { run: number; start: number; end: number }>): Layout {
  const video: Layout["video"] = [];
  const audio: Piece[] = [{ from: 0, to: LEAD }];
  for (const n of order) {
    const span = spans.get(n);
    video.push({ n, seconds: span ? span.end - span.start : DWELL });
    const last = audio.at(-1)!;
    if (!span) audio.push({ from: 0, to: DWELL });
    else if (last.run === span.run && last.to === span.start) last.to = span.end;
    else audio.push({ run: span.run, from: span.start, to: span.end });
  }
  audio.push({ from: 0, to: TAIL });
  if (video.length) { video[0]!.seconds += LEAD; video.at(-1)!.seconds += TAIL; }
  return { video, audio, duration: video.reduce((t, v) => t + v.seconds, 0) };
}

const SIDES: Record<string, string> = { l: "left", r: "right", u: "up", d: "down" };

/**
 * The ffmpeg `xfade` transition for a slide's own: a push slides, a wipe wipes, each in its direction (left when the deck
 * gives none); every other kind, or none, is a plain fade. The length is always `--fade`, not the deck's speed.
 */
export function xfadeKind(t: Transition | undefined): string {
  const side = SIDES[t?.dir ?? "l"] ?? "left";
  return t?.kind === "push" ? `slide${side}` : t?.kind === "wipe" ? `wipe${side}` : "fade";
}

/**
 * Whole frames per still and, per slide change, where its fade starts and how long it is, on the output timeline.
 * Cut frames come from the running total, so rounding never drifts the picture away from the sound. Each fade is
 * centred on its cut and shortened so the two fades of a short slide never meet; a slide too short for any fade gets cuts. Every still is held half a fade
 * longer on each faded side, so the joined video is exactly as long as with hard cuts.
 */
export function fadePlan(video: { seconds: number }[], fade: number, fps: number): { frames: number[]; fades: { start: number; frames: number }[] } {
  const cuts: number[] = [], base: number[] = [];
  let t = 0, frame = 0;
  for (const v of video) {
    t += v.seconds;
    const frames = Math.max(1, Math.round(t * fps) - frame);
    frame += frames;
    base.push(frames);
    cuts.push(frame);
  }
  const full = Math.round(fade * fps), lead = Math.floor(full / 2);
  // Both sides share the shorter neighbour's limit, so a shortened fade stays centred; 0 means that change is a cut.
  const parts = base.slice(1).map((b, i) => {
    const room = Math.min(Math.floor(base[i]! / 2), Math.floor(b / 2));
    return { before: Math.min(lead, room), after: Math.min(full - lead, room) };
  });
  return {
    frames: base.map((b, i) => b + (parts[i - 1]?.before ?? 0) + (parts[i]?.after ?? 0)),
    fades: parts.map((p, i) => ({ start: cuts[i]! - p.before, frames: p.before + p.after })),
  };
}

/**
 * Joins stills `[v0]`…`[vN]` into `[v]`: an `xfade` of `kinds[i]` at each planned fade, or a `concat` where a fade has no
 * frames. `xfade` with a zero duration never starts when the stream before it is already over, which shifts every later
 * slide, so a cut must stay a cut. `concat` outputs a microsecond time base, which a later `xfade` rejects, so it is set back to 1/fps.
 */
export function joinFilters(fades: { start: number; frames: number }[], kinds: string[], fps: number): string[] {
  return fades.map((f, i) => {
    const a = i ? `[x${i}]` : "[v0]", b = `[v${i + 1}]`, out = i === fades.length - 1 ? "[v]" : `[x${i + 1}]`;
    return f.frames > 0
      ? `${a}${b}xfade=transition=${kinds[i] ?? "fade"}:duration=${(f.frames / fps).toFixed(4)}:offset=${(f.start / fps).toFixed(4)}${out}`
      : `${a}${b}concat=n=2:v=1:a=0,settb=1/${fps}${out}`;
  });
}

/**
 * Writes `<dir>/deck.mp4`, or `preview-silent.mp4` with estimated timing when nothing has been recorded yet.
 * The picture keeps the deck's own shape, scaled to fit 1920×1080 with even sides.
 */
export async function assemble(dir: string, out?: string, fade = FADE): Promise<string> {
  const slides = readSlides(dir);
  const { lines } = readNarration(dir);
  const { runs } = planSlides(lines);
  const vo = new Map(lines.map((l) => [l.n, l.vo]));

  // One recording may be saved under the voiceover skill's plain names.
  const files = runs.map((_, k) => {
    const nn = String(k + 1).padStart(2, "0");
    const plain = runs.length === 1 && !existsSync(join(dir, `voiceover-${nn}.mp3`));
    return { audio: join(dir, plain ? "voiceover.mp3" : `voiceover-${nn}.mp3`), words: join(dir, plain ? "words.json" : `words-${nn}.json`) };
  });
  const absent = files.flatMap((f) => [f.audio, f.words]).filter((f) => !existsSync(f));
  const silent = absent.length === files.length * 2;
  if (absent.length && !silent) throw new Error(`Some recordings are missing: ${absent.join(", ")}. Record every take in recording-plan.json, or remove them all for a silent preview.`);

  const spans = new Map<number, { run: number; start: number; end: number }>();
  runs.forEach((r, k) => {
    const script = r.slides.map((n) => ({ n, vo: vo.get(n)! }));
    const est = silent ? estimateWords({ lines: script }) : null;
    const timed = buildSlideTimeline(script, est ? est.words : readWords(files[k]!.words), est ? est.seconds : audioSeconds(files[k]!.audio));
    for (const s of timed) spans.set(s.n, { run: k, start: s.start, end: s.end });
  });
  const plan = layout(slides.map((s) => s.n), spans);

  const first = await sharp(join(dir, slides[0]!.page)).metadata();
  const scale = Math.min(1920 / first.width, 1080 / first.height);
  const even = (px: number): number => Math.max(2, Math.round((px * scale) / 2) * 2);
  const [w, h] = [even(first.width), even(first.height)];

  // Joined by `concat` (hard cuts) or a chain of `xfade`s at the planned offsets, which keeps the same length.
  const timing = fadePlan(plan.video, fade, FPS);
  const faded = timing.fades.some((f) => f.frames > 0);
  const inputs: string[] = [], filters: string[] = [];
  timing.frames.forEach((frames, i) => {
    inputs.push("-framerate", String(FPS), "-loop", "1", "-t", ((frames + 1) / FPS).toFixed(3), "-i", join(dir, slides[i]!.page));
    filters.push(`[${i}:v]trim=end_frame=${frames},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`);
  });
  if (!faded) filters.push(`${plan.video.map((_, i) => `[v${i}]`).join("")}concat=n=${plan.video.length}:v=1:a=0[v]`);
  else if (timing.frames.length === 1) filters.push("[v0]null[v]");
  else filters.push(...joinFilters(timing.fades, slides.slice(1).map((s) => xfadeKind(s.transition)), FPS));

  const pieces = silent ? [{ from: 0, to: plan.duration }] : plan.audio;
  let input = plan.video.length;
  pieces.forEach((p, j) => {
    const length = (p.to - p.from).toFixed(3);
    if (p.run === undefined) { filters.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${length}[a${j}]`); return; }
    inputs.push("-ss", p.from.toFixed(3), "-t", length, "-i", files[p.run]!.audio);
    filters.push(`[${input++}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${j}]`);
  });
  filters.push(`${pieces.map((_, j) => `[a${j}]`).join("")}concat=n=${pieces.length}:v=0:a=1[a]`);

  const file = resolve(out ?? join(dir, silent ? "preview-silent.mp4" : "deck.mp4"));
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", file,
  ], { stdio: ["ignore", "inherit", "inherit"] });
  console.log(`wrote ${file}: ${plan.video.length} slides, ${plan.duration.toFixed(1)}s, ${w}×${h}${silent ? ", silent preview with estimated timing" : ""}`);
  return file;
}
