/** Stitches a deck's page pictures and its recorded narration into an MP4 with ffmpeg. No browser is involved. */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { readNarration } from "./narration";
import { readSlides } from "./slides";
import { LEAD, TAIL, buildSlideTimeline, estimateWords, planSlides, readWords } from "./timeline";

/** Seconds a slide with no narration stays on screen. */
export const DWELL = 4;
const FPS = 30;

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

/**
 * Writes `<dir>/deck.mp4`, or `preview-silent.mp4` with estimated timing when nothing has been recorded yet.
 * The picture keeps the deck's own shape, scaled to fit 1920×1080 with even sides.
 */
export async function assemble(dir: string, out?: string): Promise<string> {
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

  // Whole frames per slide, taken from the running total so rounding never drifts the picture away from the sound.
  const inputs: string[] = [], filters: string[] = [];
  let t = 0, frame = 0;
  plan.video.forEach((v, i) => {
    t += v.seconds;
    const frames = Math.max(1, Math.round(t * FPS) - frame);
    frame += frames;
    inputs.push("-framerate", String(FPS), "-loop", "1", "-t", ((frames + 1) / FPS).toFixed(3), "-i", join(dir, slides[i]!.page));
    filters.push(`[${i}:v]trim=end_frame=${frames},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`);
  });
  filters.push(`${plan.video.map((_, i) => `[v${i}]`).join("")}concat=n=${plan.video.length}:v=1:a=0[v]`);

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
