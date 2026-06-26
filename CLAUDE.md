# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is **not a software project** — it is an [Obsidian](https://obsidian.md) vault (a personal Markdown knowledge base / "second brain"). There is no build, lint, or test step. "Working in this repository" means reading, creating, and editing Markdown notes while respecting the vault's structure, frontmatter, and plugin conventions.

The vault belongs to Mike (`mike@levelup.guide`) and covers professional project management across several business/project contexts.

## Versioning & backups

- The `obsidian-git` plugin auto-commits the vault on a schedule; commit messages look like `vault backup: YYYY-MM-DD HH:MM:SS`. Do **not** mimic that format for intentional commits — only commit when the user explicitly asks, with a real descriptive message.
- `.gitignore` excludes `.obsidian/workspace.json` (per-device UI state) and `.obsidian/cache/`. Avoid editing ignored files.

## Directory structure & where notes go

- **`Contexts/`** — primary workspace. One subfolder per project/business area: `FLA`, `Sigma`, `InfinityModular`, `LevelUp`, `Personal`. Complex projects nest further (e.g. `Contexts/FLA/FLDay06/`, `Contexts/InfinityModular/MegaRack/`). Place new project notes in the matching context subfolder and preserve the existing hierarchy.
- **`Daily/`** — chronological journal, one note per day named `YYYY-MM-DD.md`, created from `Templates/Daily Note.md`.
- **`Templates/`** — standardized note formats (`Daily Note`, `meeting note`). Reuse these for new notes of the same kind.
- **`Files/`** — non-Markdown attachments (PDFs, images, pasted screenshots).
- **`Unfiled/`** — inbox for notes not yet categorized; untitled drafts live here.
See `AGENTS.md` for the big-picture vault overview, per-context summaries, and owner preferences.

## Conventions

- **Naming**: daily notes are `YYYY-MM-DD`; topical/project notes use descriptive lowercase titles (e.g. `portfolio management`). Information is organized by *context* (folder), not by general tags.
- **Frontmatter**: notes carry YAML frontmatter. Daily notes use `tags: ["#daily"]` and a `title`. Meeting notes use `tags: [meeting]`, `date`, and `project`. Match the relevant template's frontmatter when creating notes.
- **Internal links**: use Obsidian wiki-link syntax `[[Note Name]]` to connect notes; attachments are embedded with `![[file]]`.

## Tasks (obsidian-tasks-plugin)

This vault uses the Tasks plugin in **emoji format** (`taskFormat: tasksPluginEmoji`). When writing or editing tasks:

- Checkbox tasks: `- [ ]` (TODO), `- [/]` (in progress), `- [x]` (done), `- [-]` (cancelled).
- Metadata uses emoji signifiers, e.g. `📅 2026-06-30` (due), `⏳` (scheduled), `🛫` (start), `🔼/⏫/🔽` (priority). Done date is added automatically on completion (`setDoneDate: true`).
- Daily notes embed a ` ```tasks ` query block that aggregates open tasks; don't hand-edit query results — edit the underlying tasks.

## Editing guidance

- Preserve YAML frontmatter exactly unless the change is the point; don't strip or reorder existing keys.
- Keep the writing style action-oriented and functional — many notes are practical tools (email templates, talk scripts, meeting logs).
- When unsure which context a note belongs to, ask or place it in `Unfiled/` rather than guessing.
