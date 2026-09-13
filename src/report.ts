import fs from "node:fs";
import path from "node:path";
import { RESULTS_DIR } from "./config.js";
import type { SearchConfig, StoredListing } from "./types.js";

const VERDICT_ICON: Record<string, string> = { strong: "STRONG", maybe: "maybe", skip: "skip" };

function sortListings(a: StoredListing, b: StoredListing): number {
  const sa = a.analysis?.score ?? -1;
  const sb = b.analysis?.score ?? -1;
  if (sa !== sb) return sb - sa;
  return (b.listedAt ?? "").localeCompare(a.listedAt ?? "");
}

function row(l: StoredListing): string {
  const score = l.analysis ? `${l.analysis.score}/10 ${VERDICT_ICON[l.analysis.verdict]}` : "—";
  const size = l.roomType
    ? [l.roomType, l.tenants].filter(Boolean).join(" · ")
    : `${l.beds ?? "?"}bd/${l.baths ?? "?"}ba · ${l.sqft ? `${l.sqft} sqft` : "?"}`;
  const mrt = l.mrt ? l.mrt.replace(/ from /, " · ") : "—";
  const drop = l.priceChanges.length > 1 ? ` (was S$${l.priceChanges[0].price.toLocaleString()})` : "";
  return `| ${score} | [${l.title}](${l.url}) | ${l.priceText}${drop} | ${size} | ${l.propertyType} | ${mrt} | ${l.listedText.replace("Listed on ", "")} |`;
}

const HEADER = `| Score | Listing | Price | Size | Type | MRT | Listed |\n|---|---|---|---|---|---|---|`;

export function writeResults(search: SearchConfig, listings: StoredListing[], newIds: Set<number>) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const sorted = [...listings].sort(sortListings);
  const now = new Date().toISOString();

  fs.writeFileSync(
    path.join(RESULTS_DIR, `${search.id}.json`),
    JSON.stringify(
      { search, generatedAt: now, count: sorted.length, newThisRun: [...newIds], listings: sorted },
      null,
      2,
    ),
  );

  const fresh = sorted.filter((l) => newIds.has(l.id));
  const strong = sorted.filter((l) => l.analysis?.verdict === "strong");
  const parts: string[] = [
    `# ${search.label} — PropertyGuru`,
    ``,
    `Generated ${now}. ${sorted.length} active listings, ${fresh.length} new this run, ${strong.length} strong matches.`,
    ``,
  ];
  if (fresh.length) {
    parts.push(`## New this run (${fresh.length})`, ``, HEADER, ...fresh.map(row), ``);
  }
  if (strong.length) {
    parts.push(`## Strong matches (${strong.length})`, ``, HEADER, ...strong.map(row), ``);
    parts.push(`### Why`, ``, ...strong.map((l) => `- **${l.title}** (${l.priceText}): ${l.analysis?.reason}`), ``);
  }
  parts.push(`## All active listings (${sorted.length})`, ``, HEADER, ...sorted.map(row), ``);
  fs.writeFileSync(path.join(RESULTS_DIR, `${search.id}.md`), parts.join("\n"));
}
