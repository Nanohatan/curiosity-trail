# AGENTS.md

## Project

This is a personal interest and activity tracking website.

The site records:
- what I was interested in
- when I became interested in it
- what actions I took
- how my interests changed over time

The site is intended to be a long-term personal archive rather than a social network or productivity app.

## Tech Stack

- Astro
- TypeScript
- Markdown / MDX when appropriate
- GitHub Pages for deployment
- npm for package management

Avoid adding frontend frameworks such as React, Vue, or Svelte unless there is a clear need.

## Data

- Records come from a public Google Sheet (form responses), fetched in the browser as CSV via the gviz endpoint. See `src/lib/sheet.ts` (`SHEET_ID`, column matching by header text).
- Columns: 名前, カテゴリ, 何をした？, 日付, 熱量, きっかけ. Interests are derived from logs (name = id).
- Status is automatic: `dormant` when the last log is more than 1 month old, otherwise `active`.
- Pages are static shells; `src/scripts/app.ts` loads the sheet and renders. Interest detail is `/interest/?name=…`.
- Pure date/stat logic is in `src/lib/trail.ts` and `src/lib/sheet.ts` with tests (`npm test`).
- Use `url()` from `src/lib/url.ts` for internal links so the GitHub Pages base path works.
