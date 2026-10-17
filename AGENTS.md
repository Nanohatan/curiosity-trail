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

- Interests: `src/content/interests/<id>.md` (frontmatter: name, category, started, status, summary)
- Action logs: `src/data/logs.yaml` (list of: date, interest, action, kind?, note?, url?)
- Schemas live in `src/content.config.ts`. Dates are `YYYY-MM-DD` strings.
- Period stats (week/month/year) are computed in the browser from embedded JSON, so the site does not need to be rebuilt daily. Weeks start on Monday.
- Pure date/stat logic is in `src/lib/trail.ts` with tests in `src/lib/trail.test.ts` (`npm test`).
- Use `url()` from `src/lib/url.ts` for internal links so the GitHub Pages base path works.
