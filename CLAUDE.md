# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Scheduled scraper for PropertyGuru Singapore rentals (1-bed and 2-bed searches), with Claude-based scoring of listings against the user's written preferences. Runs every 12h via launchd on the user's Mac. Personal tool, single user.

## Commands

```bash
npm run typecheck                    # tsc --noEmit; no test suite exists
npm run lint                         # biome check (lint + format + import order)
npm run lint:fix                     # apply Biome's safe fixes
npm run scrape -- --max-pages 2 --no-ai   # fastest end-to-end check (opens a Chrome window)
npm run scrape -- --full             # ignore early-stop, crawl maxPages per search
npm run scrape -- --search 1bed      # one search only
npm run report                       # rebuild results/ from SQLite without scraping
npm run schedule:status              # launchd job state; also install / uninstall / run-now
```

Runtime is `tsx` directly on `src/` — no build step. ESM throughout (`"type": "module"`, imports use `.js` extensions). Node 22+ required for built-in `node:sqlite`. Scheduled runs log to `logs/launchd.log`; `logs/`, `data/`, `results/`, `.env` are gitignored.

## Pipeline (src/jobs/scrape.ts)

Per search in `config/searches.json`, for each of its `queries`: `scrapeQuery()` yields pages newest-first → listings matching `exclude` strings are dropped → `Store.upsert()` marks new vs known and records price changes → early-stop after `stopAfterKnownPages` consecutive pages with nothing new → then `analyzeListings()` scores anything lacking an analysis for the current preferences hash → `writeResults()` + `writeDashboard()`. `src/jobs/report.ts` is the same tail without scraping.

Key contracts:
- **Listing shape** comes from `src/scraper/parse.ts::normalize()`, which reads PropertyGuru's embedded `__NEXT_DATA__` JSON (`props.pageProps.pageData.data.listingsData[]`, 20 per page, `paginationData.totalPages`). No HTML parsing. If the site changes its Next.js payload, this is the only file to fix.
- **Search queries** in `config/searches.json` are passed verbatim as PropertyGuru URL query params (`loadConfig()` prepends `districts.include` as `districtCode` to each); `sort=date&order=desc` is always appended by `searchUrl()`. Confirmed param names: `bedrooms`, `maxPrice`, `districtCode` (repeatable), `isRoomRental=true`, `roomType=master`. User-requested filters go in config, not code. Room-rental listings have no bed/bath/sqft — they carry `roomType` and `tenants` instead, and all three output layers branch on `roomType`.
- **Preferences hash** (`loadPreferences()` in `src/config.ts`) keys the `analyses` table. Editing `config/preferences.md` invalidates every score, so the next run re-scores all active listings (~80 API calls per 1,500 listings).
- **"Active"** = `last_seen` within `staleAfterHours`. Nothing is ever deleted from SQLite.
- **AI scoring** (`src/ai/analyze.ts`) uses `client.messages.parse` with a Zod schema, `claude-opus-5`, batches of 20, `cache_control` on the system prompt. Skipped silently if `ANTHROPIC_API_KEY` is unset.
- **Dashboard** (`src/dashboard.ts`) is a single self-contained HTML file with the JSON payload inlined (must work over `file://`). All scraped strings pass through `esc()` — they are untrusted.

## Cloudflare constraints — do not regress

PropertyGuru is behind Cloudflare managed challenge. Empirically (2026-09):
- curl, Playwright headless shell, Chromium new-headless, and real Chrome headless all hang on "Just a moment..." forever.
- Stock Playwright headed also fails. Only `patchright` + `channel: "chrome"` + `headless: false` + persistent profile (`~/.property-finder/chrome-profile`) passes.
- Adding `locale`, `timezoneId`, or `userAgent` to the launch options makes every page fail the non-interactive JS challenge. `src/scraper/browser.ts` deliberately sets none of these.
- `cf_clearance` persists in the profile with a 1-year expiry. Once set, pages load with no challenge.
- When Cloudflare shows the interactive "Verify you are human" checkbox, the code notifies the user and waits up to `challengeWaitSec`. **Never automate that click.**

Consequence: a visible Chrome window opens on every run. This is expected, not a bug.

## Coding standards

Biome enforces formatting and lint (`biome.json`: 2-space, 120 cols, double quotes, semicolons, trailing commas, sorted imports, no non-null assertions). A `PostToolUse` hook in `.claude/settings.json` runs `scripts/check-file.sh` after every Write/Edit: Biome on the touched `.ts`/`.json` file, then `tsc` for `.ts`. Findings come back as a blocking error — fix them before moving on rather than working around the hook.

## Testing changes

There are no unit tests. Verify with `npm run lint`, `npm run typecheck`, then a real short run (`--max-pages 2 --no-ai`). For dashboard changes, `npm run report` regenerates `results/dashboard.html` from existing data; the Chrome extension cannot open `file://` URLs, so serve `results/` with `python3 -m http.server` to inspect it, and note that hidden tabs never trigger lazy image loading.
