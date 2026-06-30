# KitchenAsty

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Self-hosted restaurant ordering, reservations, and management platform — a TypeScript npm-workspaces monorepo (Express + Prisma + PostgreSQL backend, React/Vite admin & storefront, Expo mobile, VitePress docs).

## Project Memory

Project memory lives in `.claude/memory/`. **Read relevant memory files at the start of every task** — they contain conventions, patterns, and decisions that apply across sessions.

### Key Memory Files

| File | When to Read |
|------|-------------|
| `project-profile.md` | Any command or agent — packages, test commands, build commands, constraints |

## Workflow

This project uses the [`wf` Claude Code plugin](https://github.com/augmented-fifth/developer-workflow-plugin) for spec-driven development.

Most-used commands:

| Command | Purpose |
|---|---|
| `/wf:spec` | Write a new spec |
| `/wf:develop` | Execute a spec phase-by-phase |
| `/wf:finalize` | Close out a completed spec |
| `/wf:commit` | Write a conventional commit message |

Run `/wf:init` after plugin updates to pick up any newly-expected scaffolding.
