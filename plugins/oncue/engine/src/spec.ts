/**
 * short.json — the single source of truth for one explainer.
 * The storyboard, the deck, the voiceover script and the animated video all read it.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Word in the voiceover that triggers an element. Matched as a prefix, case- and punctuation-insensitive. */
export interface Cue {
  word: string;
  /** Which occurrence inside the line, 1-based (default 1). */
  nth?: number;
  /** Seconds after the word starts (default 0). */
  offset?: number;
}

export interface Colors {
  ground: string; card: string; chip: string; rule: string;
  ink: string; muted: string;
  /** Headline accent and kickers. */
  accent: string;
  /** Strings, numbers, spotlight glow. */
  highlight: string;
  /** The "you" speaker label. */
  you: string;
  /** Saved-result card. */
  panel: string; panelInk: string; panelMuted: string; panelRule: string;
}

export interface Brand {
  name: string;
  /** Path to a square PNG, relative to short.json. */
  logo: string;
  colors: Colors;
  /** @fontsource package names used by the video, e.g. "plus-jakarta-sans". */
  fonts: { sans: string; mono: string };
  /** Fonts written into the .pptx (rendered by the viewer's PowerPoint). */
  deckFonts: { head: string; body: string };
}

/** Text may mark an accent span with {braces} and inline code with `backticks`. */
export type Rich = string;

export interface HookScene { kind: "hook"; headline: Rich; headlineCue?: Cue; sub?: Rich; subCue?: Cue }
export interface ListScene { kind: "list"; kicker: string; title: Rich; items: { icon: string; title: string; desc?: Rich; cue?: Cue }[] }
export interface CardScene {
  kind: "card"; kicker: string; title: Rich;
  card: { title: string; cue?: Cue; meta?: string; metaCue?: Cue; rows: { label: string; value: Rich; cue?: Cue }[]; tags?: string[]; tagsCue?: Cue };
}
export interface ChatScene { kind: "chat"; kicker: string; title: Rich; turns: { from: "you" | "app"; text: string; cue?: Cue }[] }
export interface StepsScene { kind: "steps"; kicker: string; title: Rich; steps: { title: string; desc?: Rich; cue?: Cue }[]; result?: { text: string; cue?: Cue } }
export interface GridScene { kind: "grid"; kicker: string; title: Rich; tiles: { icon: string; label: string; cue?: Cue }[] }
export interface MediaScene { kind: "media"; kicker: string; title: Rich; mediaCue?: Cue; moments: { time: string; label: string; cue?: Cue }[] }
export interface CtaScene { kind: "cta"; headline: Rich; sub?: Rich; subCue?: Cue; pill?: { icon: string; text: string; cue?: Cue }; follow?: Rich; followCue?: Cue }

export type Scene = HookScene | ListScene | CardScene | ChatScene | StepsScene | GridScene | MediaScene | CtaScene;
export type SceneKind = Scene["kind"];

export interface Line {
  /** Exactly what the narrator says for this beat. */
  vo: string;
  /** What the viewer sees and how it moves (a production note, not rendered). */
  motion?: string;
  scene: Scene;
}

export interface Format { width: number; height: number }

export interface Spec {
  title: string;
  /**
   * Output size in px: 1080×1920 for Shorts, Reels and TikTok, 1920×1080 for YouTube, or any custom size.
   * Wider than tall uses the landscape layout; anything else the portrait one. See checkFormat for limits.
   */
  format: Format;
  brand: Brand;
  lines: Line[];
}

export interface LoadedSpec { spec: Spec; dir: string; logoPath: string }

const KINDS: ReadonlySet<string> = new Set<SceneKind>(["hook", "list", "card", "chat", "steps", "grid", "media", "cta"]);
const HEX = /^#[0-9a-fA-F]{6}$/;

function fail(path: string, msg: string): never { throw new Error(`short.json ${path}: ${msg}`); }
function str(v: unknown, path: string): asserts v is string { if (typeof v !== "string" || !v.trim()) fail(path, "must be a non-empty string"); }

/** Sizes the H.264 encoder (yuv420p needs even sides) and both layouts can handle. */
export function checkFormat(format: unknown): asserts format is Format {
  const f = format as Partial<Record<keyof Format, unknown>> | null | undefined;
  if (!f || typeof f !== "object") fail("format", "needs width and height");
  for (const k of ["width", "height"] as const) {
    const v = f[k];
    if (typeof v !== "number" || !Number.isInteger(v)) fail(`format.${k}`, "must be a whole number of pixels");
    if (v < 320 || v > 4096) fail(`format.${k}`, `must be between 320 and 4096 (got ${v})`);
    if (v % 2) fail(`format.${k}`, `must be even, which H.264 video needs (got ${v})`);
  }
  const { width, height } = f as Format;
  if (Math.max(width, height) / Math.min(width, height) > 2.4) fail("format", `the long side may be at most 2.4× the short side (got ${width}×${height})`);
}

/** Which layout a format uses and its design canvas: the short side is always 1080 design px, scaled to the frame. */
export interface Stage { wide: boolean; width: number; height: number; scale: number }
export function stageFor(format: Format): Stage {
  const wide = format.width > format.height;
  const scale = Math.min(format.width, format.height) / 1080;
  return { wide, width: format.width / scale, height: format.height / scale, scale };
}

/**
 * How each scene kind is arranged in the landscape layout. Content scenes: "side" puts the kicker and
 * title in a column beside the body, "top" puts them above a body laid out across the width.
 * hook and cta: "stack" puts the logo above the headline, "side" beside it. The video and the deck both read this.
 */
export type Arrangement = "side" | "top" | "stack";
export const WIDE: { [K in SceneKind]: K extends "hook" | "cta" ? "stack" | "side" : "side" | "top" } = {
  hook: "stack", list: "side", card: "side", chat: "side", steps: "side", grid: "top", media: "top", cta: "stack",
};

/** Reads and checks short.json; every error names the field to fix. */
export function loadSpec(file: string): LoadedSpec {
  const spec = JSON.parse(readFileSync(file, "utf8")) as Spec;
  str(spec.title, "title");
  checkFormat(spec.format);
  const b = spec.brand;
  if (!b) fail("brand", "is required");
  str(b.name, "brand.name"); str(b.logo, "brand.logo");
  for (const [k, v] of Object.entries(b.colors ?? {})) if (!HEX.test(String(v))) fail(`brand.colors.${k}`, "must be #rrggbb");
  const needed: (keyof Colors)[] = ["ground", "card", "chip", "rule", "ink", "muted", "accent", "highlight", "you", "panel", "panelInk", "panelMuted", "panelRule"];
  for (const k of needed) if (!b.colors?.[k]) fail(`brand.colors.${k}`, "is required");
  str(b.fonts?.sans, "brand.fonts.sans"); str(b.fonts?.mono, "brand.fonts.mono");
  str(b.deckFonts?.head, "brand.deckFonts.head"); str(b.deckFonts?.body, "brand.deckFonts.body");
  if (!Array.isArray(spec.lines) || spec.lines.length === 0) fail("lines", "needs at least one line");
  spec.lines.forEach((l, i) => {
    str(l.vo, `lines[${i}].vo`);
    if (!l.scene || !KINDS.has(l.scene.kind)) fail(`lines[${i}].scene.kind`, `must be one of ${[...KINDS].join(", ")}`);
  });
  const dir = dirname(resolve(file));
  return { spec, dir, logoPath: resolve(dir, b.logo) };
}

/** Splits rich text into plain, accent ({…}) and code (`…`) runs. */
export interface Run { text: string; accent: boolean; code: boolean }
export function runs(rich: Rich): Run[] {
  const out: Run[] = [];
  const re = /\{([^}]*)\}|`([^`]*)`|([^{`]+)/g;
  for (const m of rich.matchAll(re)) {
    if (m[1] !== undefined) out.push({ text: m[1], accent: true, code: false });
    else if (m[2] !== undefined) out.push({ text: m[2], accent: false, code: true });
    else if (m[3] !== undefined) out.push({ text: m[3], accent: false, code: false });
  }
  return out;
}
export const plain = (rich: Rich): string => runs(rich).map((r) => r.text).join("");
