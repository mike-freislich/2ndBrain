# AGENTS.md

Context for AI agents working in this Obsidian vault. Companion to `CLAUDE.md` (which covers operational conventions in detail); this file covers the big picture and the owner's preferences.

## Vault overview

A professional project-management and knowledge repository for Mike (`mike@levelup.guide`). It is an [Obsidian](https://obsidian.md) Markdown vault — there is no build, lint, or test. The work is reading, creating, and editing notes while respecting structure and conventions.

The vault is organized by **context** (project/business area), not by general tags.

## Contexts

- **FLA** — event facilitation & scripting (e.g. `FLDay06`: StreamYard scripts, facilitation notes, speaker coordination); also `BusinessMap`.
- **Sigma** — portfolio management, software-engineering and Godot work, activity specs, facilitation.
- **InfinityModular** — modular product design (`MegaRack`, `TheMod`).
- **LevelUp** — Mike's own venture (`FL2D`).
- **Personal** — personal notes.

## Structure

- `Contexts/<Project>/...` — primary workspace; nest deeper for sub-projects and specific outputs (scripts, meeting notes, ideas).
- `Daily/YYYY-MM-DD.md` — chronological journal, created from `Templates/Daily Note.md`.
- `Templates/` — standardized formats (`Daily Note`, `meeting note`).
- `Files/` — non-Markdown attachments.
- `Unfiled/` — inbox for uncategorized notes and untitled drafts.

## Owner preferences

- Highly structured, siloed information management. Categorize by **Context** (folder), not tags.
- Writing style is action-oriented and functional — notes often serve as practical tools (email templates, talk scripts, meeting logs).
- Naming: `YYYY-MM-DD` for daily entries; descriptive lowercase titles for topical notes (e.g. `portfolio management`).

## Custom instructions

- Place project notes in the matching `Contexts/<Project>/` subfolder; preserve the existing hierarchy (e.g. `MegaRack` stays under `Contexts/InfinityModular/`).
- Create daily notes in `Daily/` using the `YYYY-MM-DD` format and the `Templates/Daily Note` template.
- When the right context is unclear, ask or use `Unfiled/` rather than guessing.
- Tasks use the obsidian-tasks emoji format — see `CLAUDE.md` for the checkbox states and emoji signifiers.
