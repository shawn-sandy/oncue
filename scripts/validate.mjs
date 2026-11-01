// @ts-check
/**
 * Static checks for the marketplace: manifests, skill frontmatter, local links, and the engine's
 * shipped build. No dependencies. Runs `claude plugin validate` too when the Claude CLI is on PATH.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;

/** @param {string} label @param {() => void} fn */
function check(label, fn) {
  try { fn(); console.log(`PASS ${label}`); } catch (e) { failures++; console.error(`FAIL ${label}: ${e instanceof Error ? e.message : e}`); }
}
/** @param {unknown} cond @param {string} msg @returns {asserts cond} */
function need(cond, msg) { if (!cond) throw new Error(msg); }
/** @param {string} rel */
const json = (rel) => /** @type {Record<string, any>} */ (JSON.parse(readFileSync(join(root, rel), "utf8")));

/**
 * Minimal frontmatter reader: top-level `key: value` lines between the first two `---` lines.
 * @param {string} src @returns {Record<string, string>}
 */
function frontmatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(src);
  need(m, "missing YAML frontmatter");
  /** @type {Record<string, string>} */
  const out = {};
  let previous = "";
  for (const line of m[1].split("\n")) {
    need(previous !== "compatibility" || !/^\s+\S/.test(line), "compatibility must be single-line");
    const kv = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (kv) {
      previous = kv[1];
      if (previous === "compatibility") {
        need(!(previous in out), "compatibility must appear only once");
        need(!/^[>|]/.test(kv[2]), "compatibility must be single-line");
        const raw = kv[2];
        const quoted = /^(['"])(.*)\1$/.test(raw);
        if (!quoted) {
          const plain = raw.replace(/(?:^|\s+)#.*$/, "").trim();
          need(plain && !/^[\[{'"]|^(?:null|~|true|false|[+-]?\d+(?:\.\d+)?)$/i.test(plain), "compatibility must be a nonempty string");
          kv[2] = plain;
        }
      }
      out[kv[1]] = kv[2].replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");
    }
  }
  return out;
}

/** Recursively include references, so a nested guide cannot evade checks. @param {string} dir @returns {string[]} */
function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    return statSync(file).isDirectory() ? markdownFiles(file) : file.endsWith(".md") ? [file] : [];
  });
}

/**
 * Keep host setup in setup and preserve only the explicitly guarded design-system adapter.
 * This is a prose regression check, not proof that the host exposes a particular tool.
 * @param {string} file @param {string} name @param {string} skillsDir
 */
function hostInstructions(file, name, skillsDir) {
  if (name === "setup") return;
  let src = readFileSync(file, "utf8");
  const label = `${relative(root, file)}: host-specific instructions belong in setup or a guarded adapter`;
  need(!/\bclaude\s+(?:plugin|mcp)\b|\/(?:plugin|mcp|reload-plugins)\b/i.test(src), label);
  if (file === join(skillsDir, "storyboard", "references", "theme.md")) {
    src = src.split(/(?=^## )/m).filter((section) => {
      if (!section.startsWith("## Design System artifacts\n")) return true;
      const guard = /Only in Claude sessions with an Artifact tool that supports the Design System type\. Otherwise skip this adapter\./;
      return !guard.test(section);
    }).join("");
  }
  need(!/\bclaude\b|\bcomputer\b[^.!?\n]*\blinked\b|\bWebFetch\b/i.test(src), label);
}

/** Markdown links and backticked ./ ../ paths outside code fences must exist. @param {string} file */
function links(file) {
  const src = readFileSync(file, "utf8").replace(/^```[\s\S]*?^```/gm, "");
  const targets = [...src.matchAll(/\]\(([^)\s]+)\)/g), ...src.matchAll(/`(\.\.?\/[^`\s]+)`/g)].map((m) => m[1]);
  for (const t of targets) {
    if (/^[a-z]+:|^#/i.test(t)) continue;
    const p = resolve(dirname(file), decodeURIComponent(t.split("#")[0]));
    need(existsSync(p), `${file.replace(root + "/", "")}: broken link ${t}`);
  }
}

const market = json(".claude-plugin/marketplace.json");
check("marketplace manifest", () => {
  for (const k of ["name", "description"]) need(typeof market[k] === "string" && market[k], `marketplace.${k} is required`);
  need(market.owner?.name, "marketplace.owner.name is required");
  need(Array.isArray(market.plugins) && market.plugins.length > 0, "marketplace.plugins must list at least one plugin");
  need(!("version" in market), "marketplace.json carries no version; it lives in plugin.json");
});

for (const entry of market.plugins ?? []) {
  const dir = join(root, entry.source);
  check(`plugin ${entry.name}: manifest`, () => {
    need(statSync(dir).isDirectory(), `source ${entry.source} is not a folder`);
    const p = json(join(entry.source, ".claude-plugin/plugin.json"));
    need(p.name === entry.name, `plugin.json name "${p.name}" differs from marketplace entry "${entry.name}"`);
    need(/^\d+\.\d+\.\d+$/.test(p.version ?? ""), "plugin.json version must be semver");
    need(p.description && p.author?.name, "plugin.json needs description and author.name");
  });

  const skillsDir = join(dir, "skills");
  for (const name of readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory())) {
    const file = join(skillsDir, name, "SKILL.md");
    check(`skill ${name}`, () => {
      need(existsSync(file), "SKILL.md is missing");
      const fm = frontmatter(readFileSync(file, "utf8"));
      need(fm.name === name, `frontmatter name "${fm.name}" must match folder "${name}"`);
      need(fm.description && fm.description.length <= 1024, "description is required and at most 1024 characters");
      need(!/[<>]/.test(fm.description), "description must not contain angle brackets");
      need(fm.compatibility?.trim() && fm.compatibility.length <= 500, "compatibility is required, nonempty and at most 500 characters");
      links(file);
      hostInstructions(file, name, skillsDir);
      const refs = join(skillsDir, name, "references");
      if (existsSync(refs)) for (const ref of markdownFiles(refs)) {
        links(ref);
        hostInstructions(ref, name, skillsDir);
      }
    });
  }

  const engine = join(dir, "engine");
  if (existsSync(engine)) check(`plugin ${entry.name}: engine build is shipped`, () => {
    for (const f of ["dist/cli.js", "dist/render.js", "package.json", "examples/gleaner/short.json"]) need(existsSync(join(engine, f)), `engine/${f} is missing (run npm run build in the engine)`);
    const spec = JSON.parse(readFileSync(join(engine, "examples/gleaner/short.json"), "utf8"));
    need(Array.isArray(spec.lines) && spec.lines.length > 0, "example short.json has no lines");
  });
}

check("README links", () => links(join(root, "README.md")));

const cli = spawnSync("claude", ["plugin", "validate", root], { encoding: "utf8" });
if (cli.error) console.log("SKIP claude plugin validate (Claude CLI not on PATH)");
else check("claude plugin validate", () => need(cli.status === 0, (cli.stdout + cli.stderr).trim()));

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log("\nAll checks passed");
