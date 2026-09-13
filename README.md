# Property Finder

Scrapes PropertyGuru Singapore every 12 hours for 1-bedroom units and master rooms (≤ S$1,600) and 2-bedroom units (≤ S$3,200) in selected districts, stores everything in a local SQLite database, scores each listing with Claude against your written preferences, and writes ranked results you can browse in a dashboard.

## How it works

1. **Scrape** — Opens real Chrome (via [patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright)) and reads each search page's embedded `__NEXT_DATA__` JSON. Newest listings first; stops early once two consecutive pages contain nothing new.
2. **Store** — `data/listings.sqlite` tracks every listing, when it was first/last seen, and price changes.
3. **Score** — New listings are sent to `claude-opus-5` in batches of 20 along with `config/preferences.md`. Each gets a 1–10 score, a verdict (`strong` / `maybe` / `skip`), and a one-line reason. Editing the preferences file re-scores everything on the next run.
4. **Report** — Writes `results/dashboard.html`, plus `results/<search>.md` and `.json` per search.
5. **Notify** — macOS notification with new-listing counts after each run.

## Setup

```bash
npm install
cp .env.example .env        # then put your ANTHROPIC_API_KEY in .env
npm run scrape -- --full    # first crawl: builds the baseline
npm run schedule:install    # launchd job, every 12h
```

Requirements: Node 22+ (uses built-in `node:sqlite`), Google Chrome installed, macOS for the scheduler and notifications.

## Viewing results

Open `results/dashboard.html` in a browser. Tabs per search; sort by clicking column headers; filter by text, price, size, type, area, verdict, new-this-run, price drops. Click a row to open the listing on PropertyGuru.

`results/1bed.md` and `results/2bed.md` are plain-text alternatives with the same data.

## Configuration

### `config/searches.json`

```json
{
  "listingType": "rent",
  "districts": { "include": ["D01", "D02", "..."] },
  "searches": [
    {
      "id": "1bed",
      "label": "1 Bedroom",
      "queries": [
        { "bedrooms": "1", "maxPrice": "1600" },
        { "isRoomRental": "true", "roomType": "master", "maxPrice": "1600" }
      ],
      "exclude": ["Ang Mo Kio", "Yishun"]
    }
  ],
  "maxPages": 40,
  "stopAfterKnownPages": 2,
  "pageDelayMs": [1500, 3500],
  "challengeWaitSec": 180,
  "staleAfterHours": 72
}
```

- Each search has one or more `queries`. Every query is a set of PropertyGuru URL parameters, passed through verbatim; results from all queries in a search are merged into one result set. Useful params: `bedrooms`, `minPrice` / `maxPrice`, `isRoomRental=true` + `roomType=master|common|shared`, `propertyTypeGroup=N|H|L` (condo / HDB / landed), `furnishing`, `minSize`. Anything you can set in PropertyGuru's filter UI and see in the URL works.
- `districts.include` is added as `districtCode` to every query. District map: D01–D15 central and city fringe, D16 Bedok, D17–D18 Changi / Pasir Ris / Tampines, D19 Hougang / Punggol / Sengkang, D20 Ang Mo Kio / Bishan / Thomson, D21 Upper Bukit Timah, D22–D24 Jurong / Boon Lay / Tuas / CCK / Bukit Panjang / Tengah, D25 Woodlands, D26 Upper Thomson, D27 Yishun / Sembawang, D28 Seletar.
- `exclude` drops any listing whose title, address, or area contains one of these strings (case-insensitive). Use it for areas smaller than a district.
- `maxPages` — pages per query per run (20 listings each).
- `stopAfterKnownPages` — stop a query once this many consecutive pages had no new listings. `--full` ignores this.
- `staleAfterHours` — listings not seen for this long drop out of results (assumed rented out).

Changing filters does not remove already-stored listings; they age out after `staleAfterHours`. To start clean, delete `data/listings.sqlite` and run `npm run scrape -- --full`.

### `config/preferences.md`

Plain English. Budget, districts, MRT lines, furnishing, move-in date, deal-breakers. This is the only input to the AI scoring, so be specific.

## Commands

| Command | What it does |
|---|---|
| `npm run scrape` | Incremental run: scrape → score → report |
| `npm run scrape -- --full` | Ignore early-stop, crawl `maxPages` pages |
| `npm run scrape -- --search 1bed` | One search only |
| `npm run scrape -- --max-pages 3` | Override page limit |
| `npm run scrape -- --no-ai` | Skip Claude scoring |
| `npm run report` | Regenerate dashboard and markdown from the database without scraping |
| `npm run schedule:install` | Install the 12-hour launchd job |
| `npm run schedule:status` | Show job state and last exit code |
| `npm run schedule:run-now` | Trigger a run immediately |
| `npm run schedule:uninstall` | Remove the job |
| `npm run typecheck` | `tsc` |

Scheduled runs log to `logs/launchd.log`.

## Cloudflare

PropertyGuru sits behind Cloudflare bot protection. Headless browsers and plain HTTP requests are blocked outright, so the scraper drives a visible Chrome window using a dedicated profile at `~/.property-finder/chrome-profile`. The window opens for a few minutes each run and closes itself.

Occasionally Cloudflare will show a "Verify you are human" checkbox. The scraper never clicks it. Instead it sends a macOS notification and waits up to `challengeWaitSec` for you to click. The clearance cookie is then saved in the profile (currently valid for a year), so this should be rare. If nobody clicks in time, the run fails and retries at the next scheduled slot.

Do not add `locale`, `timezoneId`, or `userAgent` overrides to `src/scraper/browser.ts` — those make every page fail Cloudflare's JavaScript check.

## Layout

```
config/          searches.json, preferences.md
src/scraper/     browser launch, page fetch, listing normalisation
src/store/       SQLite schema and queries
src/ai/          Claude scoring
src/report.ts    markdown + JSON output
src/dashboard.ts self-contained HTML dashboard
src/jobs/        scrape (main job), report (regenerate only)
scripts/         run.sh (launchd entry), schedule.sh (install/uninstall/status)
launchd/         plist template
data/            SQLite database (gitignored)
results/         generated output (gitignored)
logs/            run logs (gitignored)
```
