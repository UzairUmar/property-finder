import { parseArgs } from "node:util";
import { analyzeListings, hasApiKey } from "../ai/analyze.js";
import { loadConfig, loadPreferences } from "../config.js";
import { type DashboardSection, writeDashboard } from "../dashboard.js";
import { notifyMac } from "../notify.js";
import { writeResults } from "../report.js";
import { launch } from "../scraper/browser.js";
import { scrapeQuery } from "../scraper/propertyguru.js";
import { Store } from "../store/db.js";

const { values: args } = parseArgs({
  options: {
    search: { type: "string" },
    "max-pages": { type: "string" },
    full: { type: "boolean", default: false },
    "no-ai": { type: "boolean", default: false },
  },
});

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

const config = loadConfig();
const prefs = loadPreferences();
const maxPages = args["max-pages"] ? Number(args["max-pages"]) : config.maxPages;
const searches = args.search ? config.searches.filter((s) => s.id === args.search) : config.searches;
if (searches.length === 0) throw new Error(`No search matches --search=${args.search}`);

const useAi = !args["no-ai"] && hasApiKey();
if (!args["no-ai"] && !useAi) log("ANTHROPIC_API_KEY not set — skipping AI scoring");

const store = new Store();
const ctx = await launch();
const summary: string[] = [];
const sections: DashboardSection[] = [];

try {
  for (const search of searches) {
    const startedAt = new Date().toISOString();
    const runId = store.startRun(search.id, startedAt);
    const known = store.knownIds(search.id);
    const newIds = new Set<number>();
    let pages = 0;
    let seen = 0;
    let excluded = 0;
    let priceChanges = 0;
    const excludeRe = search.exclude?.length
      ? new RegExp(search.exclude.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i")
      : null;

    log(
      `[${search.id}] start — ${known.size} known listings, ${search.queries.length} queries, maxPages=${maxPages}${args.full ? " (full crawl)" : ""}`,
    );
    try {
      for (const [qi, params] of search.queries.entries()) {
        const tag = search.queries.length > 1 ? `[${search.id} q${qi + 1}]` : `[${search.id}]`;
        let consecutiveKnown = 0;
        for await (const result of scrapeQuery(ctx, search.id, params, {
          listingType: config.listingType,
          maxPages,
          delayMs: config.pageDelayMs,
          challengeWaitMs: config.challengeWaitSec * 1000,
          log,
        })) {
          pages++;
          let newOnPage = 0;
          for (const l of result.listings) {
            if (excludeRe?.test(`${l.title} ${l.address} ${l.area}`)) {
              excluded++;
              continue;
            }
            seen++;
            const { isNew, priceChanged } = store.upsert(l, startedAt);
            if (isNew) {
              newIds.add(l.id);
              newOnPage++;
            }
            if (priceChanged) priceChanges++;
          }
          log(`${tag} page ${result.page}/${result.totalPages}: ${result.listings.length} listings, ${newOnPage} new`);
          consecutiveKnown = newOnPage === 0 && known.size > 0 ? consecutiveKnown + 1 : 0;
          if (!args.full && consecutiveKnown >= config.stopAfterKnownPages) {
            log(`${tag} ${consecutiveKnown} pages with no new listings — stopping early`);
            break;
          }
        }
      }
      store.finishRun(runId, { pages, seen, newCount: newIds.size, status: "ok" });
    } catch (err) {
      store.finishRun(runId, { pages, seen, newCount: newIds.size, status: "error", error: String(err) });
      log(`[${search.id}] scrape failed after ${pages} pages: ${err}`);
    }
    log(
      `[${search.id}] scraped ${seen} listings — ${newIds.size} new, ${priceChanges} price changes, ${excluded} excluded by area`,
    );

    if (useAi) {
      const pending = store.needingAnalysis(search.id, prefs.hash, config.staleAfterHours);
      if (pending.length) {
        const analyses = await analyzeListings(pending, prefs, log);
        store.saveAnalyses(search.id, analyses);
        log(`[${search.id}] scored ${analyses.length} listings`);
      }
    }

    const active = store.activeListings(search.id, prefs.hash, config.staleAfterHours);
    writeResults(search, active, newIds);
    sections.push({ search, listings: active, newIds: [...newIds] });
    log(`[${search.id}] wrote results/${search.id}.md (${active.length} active)`);
    const strongNew = active.filter((l) => newIds.has(l.id) && l.analysis?.verdict === "strong").length;
    summary.push(`${search.label}: ${newIds.size} new${useAi ? ` (${strongNew} strong)` : ""}`);
  }
  writeDashboard(sections);
  log("wrote results/dashboard.html");
  notifyMac("Property Finder", summary.join(" · "));
} finally {
  await ctx.close();
  store.close();
}
