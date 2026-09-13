import { loadConfig, loadPreferences } from "../config.js";
import { type DashboardSection, writeDashboard } from "../dashboard.js";
import { writeResults } from "../report.js";
import { Store } from "../store/db.js";

const config = loadConfig();
const prefs = loadPreferences();
const store = new Store();
const sections: DashboardSection[] = [];
for (const search of config.searches) {
  const active = store.activeListings(search.id, prefs.hash, config.staleAfterHours);
  writeResults(search, active, new Set());
  sections.push({ search, listings: active, newIds: [] });
  console.log(`results/${search.id}.md — ${active.length} active listings`);
}
writeDashboard(sections);
console.log("results/dashboard.html");
store.close();
