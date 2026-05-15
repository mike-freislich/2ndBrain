#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * manifest-to-toml.ts
 *
 * Convert a Nanisca activity manifest JSON into TOML. Runs unchanged in
 * Deno (preferred), Node 22+, and Bun.
 *
 * Usage (Deno):
 *   deno run --allow-read --allow-write manifest-to-toml.ts <input.json> [output.toml]
 *
 * Usage (Node 22+):
 *   node --experimental-strip-types manifest-to-toml.ts <input.json> [output.toml]
 *
 * Library use:
 *   import { manifestToToml } from "./manifest-to-toml.ts";
 *   const toml = manifestToToml(JSON.parse(jsonText));
 *
 * NOTE on $ref handling:
 *   The JSON manifest uses `{ "$ref": "#/strings/foo" }` to reference strings
 *   from action-sequence audio and sceneDirection fields. In TOML these are
 *   flattened to plain string keys: `audio = "foo"`. Resolve them against the
 *   [strings] table when reading.
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

// ─── Types ──────────────────────────────────────────────────────────────

type StringRef = { $ref: string };
type AudioField = null | StringRef | StringRef[];

interface Step {
  phase: "intro" | "demo" | "main" | "outro";
  step: number;
  required: boolean;
  repeat?: string | null;
  variant?: string;
  condition?: string;
  actions?: string[];
  sceneDirection?: StringRef;
  audio?: AudioField;
  sfx?: string | null;
}

interface ContextualisedFlow { settingKey: string; steps: Step[] }

interface NovelParam {
  type: "integer" | "integerRange" | "string" | "boolean";
  enum?: string[];
  logic?: string;
  levels: Record<string, unknown>;
}

interface ContentItem { key: string; label: string }

interface ContentOption {
  key: string;
  label?: string;
  objects: string[];
  items: ContentItem[];
  ambient?: string | null;
  scenarioSfx?: string[];
  notes?: string;
}

interface SfxEntry { label: string; category: string }
interface Character { name: string; role: string; description: string }

interface Manifest {
  specVersion: string;
  locale: string;
  meta: {
    identifier: string;
    title: string;
    subject?: string;
    subconstructs?: string[];
    skillsMapping?: string[];
    activityFamily?: string;
    activityType?: string;
    layoutTemplate?: string | null;
    description?: string;
    senAffordances?: string[];
    suggestedGlobalParams?: Record<string, unknown>;
  };
  novelParams: Record<string, NovelParam>;
  actionSequence: { core: Step[]; contextualised?: ContextualisedFlow[] };
  strings: Record<string, string>;
  characters?: Record<string, Character>;
  content: { defaultOption: string; options: ContentOption[] };
  sfx?: Record<string, SfxEntry>;
  instructionalHints?: string[];
}

// ─── TOML primitives ────────────────────────────────────────────────────

const BARE_KEY_RE = /^[A-Za-z0-9_-]+$/;

const tomlKey = (k: string): string =>
  BARE_KEY_RE.test(k) ? k : `"${k.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const tomlString = (s: string): string => {
  // Basic single-line string with the standard escapes.
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
};

const tomlScalar = (v: unknown): string => {
  if (v === null || v === undefined) return '""';
  if (typeof v === "string") return tomlString(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : '""';
  if (typeof v === "boolean") return String(v);
  return tomlString(String(v));
};

const tomlInline = (v: unknown): string => {
  if (Array.isArray(v)) {
    return "[" + v.map(tomlInline).join(", ") + "]";
  }
  if (v !== null && typeof v === "object") {
    const entries = Object.entries(v).map(
      ([k, val]) => `${tomlKey(k)} = ${tomlInline(val)}`,
    );
    return "{ " + entries.join(", ") + " }";
  }
  return tomlScalar(v);
};

const tomlInlineMultiline = (arr: unknown[]): string => {
  // Multi-line array form for readability when items are objects or long strings.
  if (arr.length === 0) return "[]";
  const rendered = arr.map((v) => "  " + tomlInline(v) + ",");
  return ["[", ...rendered, "]"].join("\n");
};

const refKey = (ref: unknown): string => {
  if (typeof ref === "object" && ref !== null && "$ref" in ref) {
    return (ref as StringRef).$ref.split("/").pop() ?? "";
  }
  return String(ref);
};

const audioToToml = (audio: AudioField | undefined): string | null => {
  if (!audio) return null;
  if (Array.isArray(audio)) {
    return "[" + audio.map((a) => tomlString(refKey(a))).join(", ") + "]";
  }
  return tomlString(refKey(audio));
};

// ─── Section renderers ──────────────────────────────────────────────────

const renderHeader = (m: Manifest): string => {
  const lines = [
    "# Nanisca activity manifest (TOML form).",
    `# Identifier: ${m.meta.identifier}`,
    "#",
    "# Convention: `audio` and `sceneDirection` values are KEYS into the [strings] table,",
    "# not literal text. The JSON manifest remains the source of truth.",
    "",
    `specVersion = ${tomlString(m.specVersion)}`,
    `locale      = ${tomlString(m.locale)}`,
  ];
  // Top-level arrays must precede any [table] block in TOML, so emit
  // instructionalHints here in the header rather than at the bottom.
  if (m.instructionalHints?.length) {
    lines.push(`instructionalHints = ${tomlInline(m.instructionalHints)}`);
  }
  return lines.join("\n");
};

const renderMeta = (meta: Manifest["meta"]): string => {
  const lines: string[] = ["[meta]"];
  const order = [
    "identifier",
    "title",
    "subject",
    "subconstructs",
    "skillsMapping",
    "activityFamily",
    "activityType",
    "layoutTemplate",
    "description",
    "senAffordances",
  ] as const;
  for (const k of order) {
    if (!(k in meta)) continue;
    const v = (meta as Record<string, unknown>)[k];
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    lines.push(`${k} = ${tomlInline(v)}`);
  }

  if (meta.suggestedGlobalParams && Object.keys(meta.suggestedGlobalParams).length) {
    lines.push("");
    lines.push("[meta.suggestedGlobalParams]");
    for (const [k, v] of Object.entries(meta.suggestedGlobalParams)) {
      lines.push(`${tomlKey(k)} = ${tomlInline(v)}`);
    }
  }
  return lines.join("\n");
};

const renderNovelParams = (np: Record<string, NovelParam>): string => {
  const sections: string[] = ["# ─── Novel Parameters ─────────────────────────────────────────────", ""];
  for (const [name, p] of Object.entries(np)) {
    const lines: string[] = [];
    lines.push(`[novelParams.${tomlKey(name)}]`);
    lines.push(`type = ${tomlString(p.type)}`);
    if (p.enum) lines.push(`enum = ${tomlInline(p.enum)}`);
    if (p.logic) lines.push(`logic = ${tomlString(p.logic)}`);
    lines.push("");
    lines.push(`[novelParams.${tomlKey(name)}.levels]`);
    for (const [lk, lv] of Object.entries(p.levels)) {
      lines.push(`${lk} = ${tomlInline(lv)}`);
    }
    sections.push(lines.join("\n"));
    sections.push("");
  }
  return sections.join("\n");
};

const renderStep = (step: Step, header: string): string => {
  const lines: string[] = [header];
  lines.push(`phase    = ${tomlString(step.phase)}`);
  lines.push(`step     = ${step.step}`);
  lines.push(`required = ${step.required}`);
  if (step.repeat) lines.push(`repeat   = ${tomlString(step.repeat)}`);
  if (step.variant) lines.push(`variant  = ${tomlString(step.variant)}`);
  if (step.condition) lines.push(`condition = ${tomlString(step.condition)}`);
  if (step.actions?.length) {
    lines.push(`actions  = ${tomlInline(step.actions)}`);
  }
  if (step.sceneDirection) {
    lines.push(`sceneDirection = ${tomlString(refKey(step.sceneDirection))}`);
  }
  const audioToml = audioToToml(step.audio);
  if (audioToml !== null) lines.push(`audio    = ${audioToml}`);
  if (step.sfx) lines.push(`sfx      = ${tomlString(step.sfx)}`);
  return lines.join("\n");
};

const renderActionSequence = (seq: Manifest["actionSequence"]): string => {
  const sections: string[] = ["# ─── Action Sequence ──────────────────────────────────────────────", ""];
  for (const step of seq.core) {
    sections.push(renderStep(step, "[[actionSequence.core]]"));
    sections.push("");
  }
  if (seq.contextualised?.length) {
    for (const ctx of seq.contextualised) {
      sections.push(`[[actionSequence.contextualised]]`);
      sections.push(`settingKey = ${tomlString(ctx.settingKey)}`);
      sections.push("");
      for (const step of ctx.steps) {
        sections.push(renderStep(step, "[[actionSequence.contextualised.steps]]"));
        sections.push("");
      }
    }
  }
  return sections.join("\n");
};

const renderStrings = (strings: Record<string, string>): string => {
  const lines: string[] = [
    "# ─── Strings ──────────────────────────────────────────────────────",
    "# All localisable text. Placeholders use {name} syntax resolved at runtime.",
    "",
    "[strings]",
  ];
  // Compute column width for visual alignment
  const keys = Object.keys(strings).filter((k) => k !== "_comment");
  const maxKey = keys.reduce((m, k) => Math.max(m, tomlKey(k).length), 0);
  for (const k of keys) {
    const key = tomlKey(k);
    const pad = " ".repeat(maxKey - key.length);
    lines.push(`${key}${pad} = ${tomlString(strings[k])}`);
  }
  return lines.join("\n");
};

const renderCharacters = (chars: Record<string, Character>): string => {
  const sections: string[] = ["# ─── Characters ───────────────────────────────────────────────────", ""];
  for (const [k, c] of Object.entries(chars)) {
    sections.push(`[characters.${tomlKey(k)}]`);
    sections.push(`name        = ${tomlString(c.name)}`);
    sections.push(`role        = ${tomlString(c.role)}`);
    sections.push(`description = ${tomlString(c.description)}`);
    sections.push("");
  }
  return sections.join("\n");
};

const renderContent = (content: Manifest["content"]): string => {
  const sections: string[] = ["# ─── Content ──────────────────────────────────────────────────────", ""];
  sections.push("[content]");
  sections.push(`defaultOption = ${tomlString(content.defaultOption)}`);
  sections.push("");
  for (const opt of content.options) {
    const lines: string[] = ["[[content.options]]"];
    lines.push(`key     = ${tomlString(opt.key)}`);
    if (opt.label) lines.push(`label   = ${tomlString(opt.label)}`);
    if (opt.objects?.length) lines.push(`objects = ${tomlInline(opt.objects)}`);
    if (opt.ambient) lines.push(`ambient = ${tomlString(opt.ambient)}`);
    if (opt.scenarioSfx?.length) lines.push(`scenarioSfx = ${tomlInline(opt.scenarioSfx)}`);
    if (opt.notes) lines.push(`notes   = ${tomlString(opt.notes)}`);
    if (opt.items?.length) {
      lines.push(`items   = ${tomlInlineMultiline(opt.items)}`);
    }
    sections.push(lines.join("\n"));
    sections.push("");
  }
  return sections.join("\n");
};

const renderSfx = (sfx: Record<string, SfxEntry>): string => {
  const sections: string[] = ["# ─── SFX ──────────────────────────────────────────────────────────", ""];
  for (const [k, v] of Object.entries(sfx)) {
    sections.push(`[sfx.${tomlKey(k)}]`);
    sections.push(`label    = ${tomlString(v.label)}`);
    sections.push(`category = ${tomlString(v.category)}`);
    sections.push("");
  }
  return sections.join("\n");
};

// ─── Main conversion ────────────────────────────────────────────────────

export const manifestToToml = (m: Manifest): string => {
  const sections: string[] = [];
  sections.push(renderHeader(m));
  sections.push("");
  sections.push(renderMeta(m.meta));
  sections.push("");
  sections.push(renderNovelParams(m.novelParams));
  sections.push(renderActionSequence(m.actionSequence));
  sections.push(renderStrings(m.strings));
  sections.push("");
  if (m.characters && Object.keys(m.characters).length) {
    sections.push(renderCharacters(m.characters));
  }
  sections.push(renderContent(m.content));
  if (m.sfx && Object.keys(m.sfx).length) {
    sections.push(renderSfx(m.sfx));
  }
  // instructionalHints is emitted in the header (must precede tables in TOML).
  return sections.join("\n");
};

// ─── CLI entrypoint ─────────────────────────────────────────────────────

const isMain = (): boolean => {
  // @ts-ignore — Deno-only property
  if (typeof Deno !== "undefined" && import.meta && "main" in import.meta) {
    // @ts-ignore
    return import.meta.main === true;
  }
  if (typeof process !== "undefined" && process.argv?.[1]) {
    const here = new URL(import.meta.url).pathname;
    return process.argv[1] === here || process.argv[1].endsWith(basename(here));
  }
  return false;
};

const getArgs = (): string[] => {
  // @ts-ignore — Deno-only
  if (typeof Deno !== "undefined" && Deno.args) return Deno.args;
  return process.argv.slice(2);
};

const main = async (): Promise<void> => {
  const args = getArgs();
  if (args.length < 1) {
    console.error("Usage: manifest-to-toml.ts <input.json> [output.toml]");
    process.exit(1);
  }
  const inputPath = args[0];
  const outputPath = args[1] ?? inputPath.replace(/\.json$/, "") + ".toml";
  const raw = await readFile(inputPath, "utf-8");
  const manifest = JSON.parse(raw) as Manifest;
  const toml = manifestToToml(manifest);
  await writeFile(outputPath, toml, "utf-8");
  console.log(`Wrote ${outputPath}`);
};

if (isMain()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
