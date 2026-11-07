---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: '1.0.0'
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Fetch fresh guidelines before each review:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Use WebFetch to retrieve the latest rules. The fetched content contains all the rules and output format instructions.

## Usage

When a user provides a file or pattern argument:

1. Fetch guidelines from the source URL above
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.

## Design-review checklist (monki-trips)

Run this after the fetched guidelines on any screen, component or mock, and
report each miss as `file:line` like the other findings. The tokens live in
`docs/design/DESIGN.md` and the ui-kit; a hard-coded value is itself a
finding.

- **Spacing on a 4 px grid.** Every margin, padding, gap and size comes from
  the spacing tokens (multiples of 4 px). No `13px`, no one-off `rem`.
- **One accent, for interaction only.** The accent colour marks what can be
  tapped or is selected (primary button, link, focus ring, active tab).
  Status uses the semantic tokens; decoration never uses the accent.
- **Hairlines, not boxes.** Separate content with 1 px dividers and
  whitespace. No card-in-card, no border plus shadow plus background on the
  same element, no nested outlines.
- **Tabular figures** (`font-variant-numeric: tabular-nums`) wherever
  numbers line up or change: money, times, dates, counts, durations.
- **Honest empty states.** Say what is missing and offer the one action that
  fixes it. No fake placeholder data, no "Lorem ipsum", no spinner where
  there is simply nothing yet. Offline states say so plainly.
- **Both themes checked.** Light and dark, on the real token values: text
  contrast (`scripts/check-contrast.mjs`), focus ring visibility, images and
  the mascot on both backgrounds. Screenshots of both go in the PR.
- **Reduced motion.** Every animation and transition has a
  `prefers-reduced-motion: reduce` path (none or an opacity fade); nothing
  conveys meaning through motion alone.
