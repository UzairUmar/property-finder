# Graph Report - property-finder  (2026-09-15)

## Corpus Check
- Corpus is ~5,827 words - fits in a single context window. You may not need a graph.

## Summary
- 183 nodes · 276 edges · 13 communities (10 shown, 3 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 50,000 input · 6,848 output

## Community Hubs (Navigation)
- Dashboard & Results Output
- Package Dependencies
- Biome Config
- PropertyGuru Scraper & Parsing
- Scrape Pipeline Orchestration
- Config, Preferences & Store
- TypeScript Config
- npm Scripts
- AI Listing Scoring
- Cloudflare Bypass Strategy
- run.sh Launcher
- Lint Hook Script
- launchd Scheduler Script

## God Nodes (most connected - your core abstractions)
1. `Store` - 12 edges
2. `scripts` - 10 edges
3. `compilerOptions` - 10 edges
4. `Listing` - 9 edges
5. `normalize()` - 8 edges
6. `config/searches.json` - 8 edges
7. `analyzeListings()` - 7 edges
8. `writeResults()` - 7 edges
9. `loadPage()` - 7 edges
10. `StoredListing` - 7 edges

## Surprising Connections (you probably didn't know these)
- `writeResults()` --references--> `Room-rental listing (roomType, tenants; no bed/bath/sqft)`  [INFERRED]
  src/report.ts → CLAUDE.md
- `Preferences Hash (keys analyses table)` --rationale_for--> `analyzeListings()`  [EXTRACTED]
  CLAUDE.md → src/ai/analyze.ts
- `analyzeListings()` --implements--> `AI Scoring (claude-opus-5, Zod schema, batches of 20, prompt caching)`  [EXTRACTED]
  src/ai/analyze.ts → CLAUDE.md
- `analyzeListings()` --references--> `config/preferences.md (rental preferences)`  [EXTRACTED]
  src/ai/analyze.ts → config/preferences.md
- `writeResults()` --implements--> `results/ output (dashboard.html, <search>.md, .json)`  [EXTRACTED]
  src/report.ts → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scrape pipeline: query -> normalize -> upsert -> analyze -> report/dashboard** — src_scraper_propertyguru_scrapequery, src_scraper_parse_normalize, src_store_db_store_upsert, src_ai_analyze_analyzelistings, src_report_writeresults, src_dashboard_writedashboard [EXTRACTED 1.00]
- **Cloudflare bypass strategy (headed patchright, no emulation overrides, persistent cf_clearance, human-only checkbox)** — claude_cloudflare_challenge, claude_patchright_headed_chrome, claude_cf_clearance_cookie, claude_human_verification_wait, src_scraper_browser [EXTRACTED 1.00]
- **Preference-driven re-scoring (preferences.md -> hash -> analyses table -> analyzeListings)** — config_preferences, src_config_loadpreferences, claude_preferences_hash, claude_sqlite_store, src_ai_analyze_analyzelistings [EXTRACTED 1.00]

## Communities (13 total, 3 thin omitted)

### Community 0 - "Dashboard & Results Output"
Cohesion: 0.10
Nodes (23): results/ output (dashboard.html, <search>.md, .json), DATA_DIR, envPath, RESULTS_DIR, ROOT, DashboardSection, esc() (HTML escaping of untrusted strings), writeDashboard() (+15 more)

### Community 1 - "Package Dependencies"
Cohesion: 0.08
Nodes (24): allowScripts, @biomejs/biome@2.5.13, esbuild@0.28.2, fsevents@2.3.3, author, dependencies, @anthropic-ai/sdk, patchright (+16 more)

### Community 2 - "Biome Config"
Cohesion: 0.08
Nodes (23): source, assist, actions, files, includes, formatter, enabled, indentStyle (+15 more)

### Community 3 - "PropertyGuru Scraper & Parsing"
Cohesion: 0.16
Nodes (18): PropertyGuru __NEXT_DATA__ JSON payload, notifyMac(), flatten(), normalize(), num(), parseListedAt(), Raw, ChallengeTimeoutError (+10 more)

### Community 4 - "Scrape Pipeline Orchestration"
Cohesion: 0.13
Nodes (15): Biome lint + PostToolUse check-file hook, Early-stop after stopAfterKnownPages, launchd 12h schedule, Property Finder (PropertyGuru rental scraper), Scrape Pipeline (scrape -> store -> score -> report), patchright, config, log() (+7 more)

### Community 5 - "Config, Preferences & Store"
Cohesion: 0.20
Nodes (14): Active listing (last_seen within staleAfterHours), Preferences Hash (keys analyses table), Room-rental listing (roomType, tenants; no bed/bath/sqft), SQLite store (node:sqlite, data/listings.sqlite, nothing deleted), config/preferences.md (rental preferences), Budget (1-bed <= S$1,600, 2-bed <= S$3,200), Location preferences (avoid far east/west, AMK, Yishun, Woodlands; central preferred), Nice-to-have: MRT under 10 min walk, fewer tenants (+6 more)

### Community 6 - "TypeScript Config"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck, strict (+3 more)

### Community 7 - "npm Scripts"
Cohesion: 0.20
Nodes (10): scripts, lint, lint:fix, report, schedule:install, schedule:run-now, schedule:status, schedule:uninstall (+2 more)

### Community 8 - "AI Listing Scoring"
Cohesion: 0.25
Nodes (8): AI Scoring (claude-opus-5, Zod schema, batches of 20, prompt caching), Score 1-10 + verdict strong/maybe/skip + reason, @anthropic-ai/sdk, zod, analyzeListings(), hasApiKey(), ResultSchema, slim()

### Community 9 - "Cloudflare Bypass Strategy"
Cohesion: 0.50
Nodes (5): cf_clearance cookie (1-year expiry in profile), Cloudflare Managed Challenge constraints, Never automate 'Verify you are human'; notify and wait challengeWaitSec, patchright + headed Chrome + persistent profile, macOS notification after each run

## Knowledge Gaps
- **79 isolated node(s):** `$schema`, `includes`, `enabled`, `indentStyle`, `indentWidth` (+74 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 88 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `patchright` connect `Scrape Pipeline Orchestration` to `Package Dependencies`, `PropertyGuru Scraper & Parsing`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `scripts` connect `npm Scripts` to `Package Dependencies`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `Store` connect `Dashboard & Results Output` to `Scrape Pipeline Orchestration`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `$schema`, `includes`, `enabled` to the rest of the system?**
  _79 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard & Results Output` be split into smaller, more focused modules?**
  _Cohesion score 0.0990990990990991 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._