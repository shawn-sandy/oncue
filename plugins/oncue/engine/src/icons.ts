/** Feather icons (react-icons/fi) as inline SVG or PNG, by name: "FiLayers", "FiBookmark", … */
import * as Fi from "react-icons/fi";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";

type IconProps = { color?: string; size?: number | string; strokeWidth?: number | string };
const table = Fi as unknown as Record<string, ComponentType<IconProps> | undefined>;

function component(name: string): ComponentType<IconProps> {
  const c = table[name];
  if (!c) throw new Error(`Unknown icon "${name}". Use a Feather name from react-icons/fi, e.g. FiLayers, FiFolder, FiGithub.`);
  return c;
}

/** Inline SVG markup, sized by CSS. */
export function iconSvg(name: string, hex: string): string {
  return renderToStaticMarkup(createElement(component(name), { color: hex, size: "100%" }));
}

/** base64 PNG data in the form pptxgenjs expects. */
export async function iconPng(name: string, hex: string): Promise<string> {
  const svg = renderToStaticMarkup(createElement(component(name), { color: hex, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
