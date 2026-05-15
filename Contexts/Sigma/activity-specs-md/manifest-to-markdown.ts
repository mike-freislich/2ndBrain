#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * manifest-to-markdown.ts
 *
 * Convert a Nanisca activity manifest JSON into a human-readable Markdown
 * document. Runs unchanged in Deno (preferred), Node 22+, and Bun.
 *
 * Usage (Deno):
 *   deno run --allow-read --allow-write manifest-to-markdown.ts <input.json> [output.md]
 *
 * Usage (Node 22+):
 *   node --experimental-strip-types manifest-to-markdown.ts <input.json> [output.md]
 *
 * Library use (any runtime):
 *   import { manifestToMarkdown } from "./manifest-to-markdown.ts";
 *   const md = manifestToMarkdown(JSON.parse(jsonText));
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";

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

interface ContextualisedFlow {
  settingKey: string;
  steps: Step[];
}

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

// ─── Helpers ────────────────────────────────────────────────────────────

const esc = (s: unknown): string => {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
};

const resolveRef = (ref: StringRef | unknown, strings: Record<string, string>): string => {
  if (typeof ref !== "object" || ref === null || !("$ref" in ref)) {
    return String(ref ?? "");
  }
  const key = (ref as StringRef).$ref.split("/").pop() ?? "";
  return `\`${key}\` — ${strings[key] ?? "(missing)"}`;
};

const renderAudio = (audio: AudioField | undefined, strings: Record<string, string>): string => {
  if (!audio) return "";
  if (Array.isArray(audio)) return audio.map((a) => resolveRef(a, strings)).join("<br>");
  return resolveRef(audio, strings);
};

const fmtLevelValue = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "min" in v && "max" in v) {
    return `${(v as { min: number; max: number }).min}–${(v as { min: number; max: number }).max}`;
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

// ─── Renderers ──────────────────────────────────────────────────────────

const renderStepRow = (step: Step, strings: Record<string, string>): string => {
  const flags: string[] = [];
  if (step.variant) flags.push(`variant: \`${step.variant}\``);
  if (step.condition) flags.push(`if \`${step.condition}\``);
  if (step.repeat) flags.push(`repeat: \`${step.repeat}\``);
  if (step.sceneDirection) flags.push(`scene: ${resolveRef(step.sceneDirection, strings)}`);

  return `| ${esc(step.phase)} | ${esc(step.step)} | ${step.required ? "yes" : "no"} | ${esc((step.actions ?? []).join(", "))} | ${esc(renderAudio(step.audio, strings))} | ${esc(step.sfx ?? "")} | ${esc(flags.join(" · "))} |`;
};

const renderLevels = (param: NovelParam): string => {
  const keys = Object.keys(param.levels).sort();
  if (!keys.length) return "";
  const header = `| ${keys.join(" | ")} |`;
  const sep = `|${keys.map(() => ":-:").join("|")}|`;
  const row = `| ${keys.map((k) => fmtLevelValue(param.levels[k])).join(" | ")} |`;
  return [header, sep, row].join("\n");
};

const renderNovelParams = (np: Record<string, NovelParam>): string => {
  if (!Object.keys(np).length) return "_None._";
  const blocks: string[] = [];
  for (const [name, p] of Object.entries(np)) {
    const metaLines: string[] = [`**Type:** \`${p.type}\``];
    if (p.enum) metaLines.push(`**Enum:** \`${p.enum.join(", ")}\``);
    if (p.logic) metaLines.push(`**Logic:** ${p.logic}`);
    blocks.push(`### \`${name}\`\n\n${metaLines.join("  \n")}\n\n${renderLevels(p)}\n`);
  }
  return blocks.join("\n");
};

const renderContentOption = (opt: ContentOption, sfxMap: Record<string, SfxEntry>): string => {
  const out: string[] = [];
  out.push(`#### \`${opt.key}\` — ${opt.label ?? ""}\n`);
  out.push(`**Objects:** ${opt.objects.map((o) => `\`${o}\``).join(", ")}\n`);
  if (opt.ambient) {
    out.push(`**Ambient SFX:** \`${opt.ambient}\` (${sfxMap[opt.ambient]?.label ?? ""})\n`);
  }
  if (opt.scenarioSfx?.length) {
    out.push(`**Scenario SFX:** ${opt.scenarioSfx.map((s) => `\`${s}\``).join(", ")}\n`);
  }
  if (opt.notes) {
    out.push(`**Notes:** ${opt.notes}\n`);
  }
  if (opt.items?.length) {
    out.push("**Items:**\n");
    out.push("| Key | Label |\n|:---|:---|");
    for (const it of opt.items) {
      out.push(`| \`${esc(it.key)}\` | ${esc(it.label)} |`);
    }
    out.push("");
  }
  return out.join("\n");
};

const renderStrings = (strings: Record<string, string>): string => {
  const rows: string[] = ["| Key | Text |", "|:---|:---|"];
  for (const [k, v] of Object.entries(strings)) {
    if (k === "_comment") continue;
    rows.push(`| \`${esc(k)}\` | ${esc(v)} |`);
  }
  return rows.join("\n");
};

const renderCharacters = (chars: Record<string, Character> | undefined): string => {
  if (!chars || !Object.keys(chars).length) return "_None._";
  const rows: string[] = ["| Key | Name | Role | Description |", "|:---|:---|:---|:---|"];
  for (const [k, c] of Object.entries(chars)) {
    rows.push(`| \`${esc(k)}\` | ${esc(c.name)} | ${esc(c.role)} | ${esc(c.description)} |`);
  }
  return rows.join("\n");
};

const renderSfx = (sfx: Record<string, SfxEntry> | undefined): string => {
  if (!sfx || !Object.keys(sfx).length) return "_None._";
  const rows: string[] = ["| Key | Label | Category |", "|:---|:---|:---|"];
  for (const [k, v] of Object.entries(sfx)) {
    rows.push(`| \`${esc(k)}\` | ${esc(v.label)} | ${esc(v.category)} |`);
  }
  return rows.join("\n");
};

const renderActionSequence = (
  seq: Manifest["actionSequence"],
  strings: Record<string, string>,
): string => {
  const header = "| Phase | Step | Required | Actions | Audio | SFX | Flags |\n|:---|:---|:---|:---|:---|:---|:---|";
  const out: string[] = [];

  out.push("### Core\n");
  out.push(header);
  for (const step of seq.core) out.push(renderStepRow(step, strings));
  out.push("");

  if (seq.contextualised?.length) {
    for (const ctx of seq.contextualised) {
      out.push(`### Contextualised — \`${ctx.settingKey}\`\n`);
      out.push(header);
      for (const step of ctx.steps) out.push(renderStepRow(step, strings));
      out.push("");
    }
  } else {
    out.push("_No contextualised flows._\n");
  }

  return out.join("\n");
};

// ─── Main conversion ─────────────────────────────────────────────────────

export const manifestToMarkdown = (m: Manifest): string => {
  const { meta, strings, sfx } = m;
  const md: string[] = [];

  // Title block
  md.push(`# ${meta.title}\n`);
  md.push(`**Identifier:** \`${meta.identifier}\`  `);
  md.push(`**Spec version:** ${m.specVersion}  `);
  md.push(`**Locale:** \`${m.locale}\`\n`);

  // Meta
  md.push("## Meta\n");
  md.push("| Field | Value |");
  md.push("|:---|:---|");
  for (const field of ["subject", "activityFamily", "activityType", "layoutTemplate", "description"] as const) {
    if (field in meta) {
      const v = (meta as Record<string, unknown>)[field];
      md.push(`| ${field} | ${esc(v) || "_(null)_"} |`);
    }
  }
  if (meta.subconstructs?.length) md.push(`| subconstructs | ${esc(meta.subconstructs.join(", "))} |`);
  if (meta.skillsMapping?.length) md.push(`| skillsMapping | ${esc(meta.skillsMapping.join(", "))} |`);
  if (meta.senAffordances) {
    md.push(`| senAffordances | ${esc(meta.senAffordances.join("; ")) || "_(none)_"} |`);
  }
  md.push("");

  // Suggested Global Params
  if (meta.suggestedGlobalParams && Object.keys(meta.suggestedGlobalParams).length) {
    md.push("## Suggested Global Params\n");
    md.push("_Hints only — the platform may override._\n");
    md.push("| Param | Value |");
    md.push("|:---|:---|");
    for (const [k, v] of Object.entries(meta.suggestedGlobalParams)) {
      md.push(`| \`${k}\` | ${esc(v)} |`);
    }
    md.push("");
  }

  // Novel Parameters
  md.push("## Novel Parameters\n");
  md.push(renderNovelParams(m.novelParams));
  md.push("");

  // Action Sequence
  md.push("## Action Sequence\n");
  md.push(renderActionSequence(m.actionSequence, strings));

  // Strings
  md.push("## Strings\n");
  md.push("_All localisable text. Placeholders use `{name}` syntax resolved at runtime._\n");
  md.push(renderStrings(strings));
  md.push("");

  // Characters
  md.push("## Characters\n");
  md.push(renderCharacters(m.characters));
  md.push("");

  // Content
  md.push("## Content\n");
  md.push(`**Default option:** \`${m.content.defaultOption}\`\n`);
  md.push("### Options\n");
  for (const opt of m.content.options) {
    md.push(renderContentOption(opt, sfx ?? {}));
  }

  // SFX
  md.push("## SFX\n");
  md.push(renderSfx(sfx));
  md.push("");

  // Instructional Hints
  md.push("## Instructional Hints\n");
  if (m.instructionalHints?.length) {
    for (const h of m.instructionalHints) md.push(`- \`${h}\``);
  } else {
    md.push("_None._");
  }
  md.push("");

  return md.join("\n");
};

// ─── CLI entrypoint ──────────────────────────────────────────────────────

const isMain = (): boolean => {
  // Deno: import.meta.main is true when run as the entrypoint script.
  // Node: import.meta.url matches the invoked URL.
  // @ts-ignore — Deno-only property
  if (typeof Deno !== "undefined" && import.meta && "main" in import.meta) {
    // @ts-ignore
    return import.meta.main === true;
  }
  if (typeof process !== "undefined" && process.argv?.[1]) {
    const invoked = process.argv[1];
    const here = new URL(import.meta.url).pathname;
    return invoked === here || invoked.endsWith(basename(here));
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
    console.error("Usage: manifest-to-markdown.ts <input.json> [output.md]");
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] ?? inputPath.replace(/\.json$/, "") + ".md";

  const raw = await readFile(inputPath, "utf-8");
  const manifest = JSON.parse(raw) as Manifest;
  const md = manifestToMarkdown(manifest);
  await writeFile(outputPath, md, "utf-8");

  console.log(`Wrote ${outputPath}`);
};

if (isMain()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
