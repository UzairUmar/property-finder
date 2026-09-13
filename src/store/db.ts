import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "../config.js";
import type { Analysis, Listing, StoredListing } from "../types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER NOT NULL,
  search_id TEXT NOT NULL,
  data TEXT NOT NULL,
  price INTEGER NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  PRIMARY KEY (id, search_id)
);
CREATE TABLE IF NOT EXISTS price_history (
  listing_id INTEGER NOT NULL,
  search_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analyses (
  listing_id INTEGER NOT NULL,
  search_id TEXT NOT NULL,
  prefs_hash TEXT NOT NULL,
  score INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  reason TEXT NOT NULL,
  model TEXT NOT NULL,
  analyzed_at TEXT NOT NULL,
  PRIMARY KEY (listing_id, search_id, prefs_hash)
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  pages INTEGER NOT NULL DEFAULT 0,
  seen INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT
);
`;

export class Store {
  private db: DatabaseSync;

  constructor(file = path.join(DATA_DIR, "listings.sqlite")) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  knownIds(searchId: string): Set<number> {
    const rows = this.db.prepare("SELECT id FROM listings WHERE search_id = ?").all(searchId) as { id: number }[];
    return new Set(rows.map((r) => r.id));
  }

  upsert(l: Listing, now: string): { isNew: boolean; priceChanged: boolean } {
    const existing = this.db
      .prepare("SELECT price FROM listings WHERE id = ? AND search_id = ?")
      .get(l.id, l.searchId) as { price: number } | undefined;
    const data = JSON.stringify(l);
    if (!existing) {
      this.db
        .prepare("INSERT INTO listings (id, search_id, data, price, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)")
        .run(l.id, l.searchId, data, l.price, now, now);
      this.db
        .prepare("INSERT INTO price_history (listing_id, search_id, price, seen_at) VALUES (?, ?, ?, ?)")
        .run(l.id, l.searchId, l.price, now);
      return { isNew: true, priceChanged: false };
    }
    const priceChanged = existing.price !== l.price;
    this.db
      .prepare("UPDATE listings SET data = ?, price = ?, last_seen = ? WHERE id = ? AND search_id = ?")
      .run(data, l.price, now, l.id, l.searchId);
    if (priceChanged) {
      this.db
        .prepare("INSERT INTO price_history (listing_id, search_id, price, seen_at) VALUES (?, ?, ?, ?)")
        .run(l.id, l.searchId, l.price, now);
    }
    return { isNew: false, priceChanged };
  }

  startRun(searchId: string, now: string): number {
    const r = this.db.prepare("INSERT INTO runs (search_id, started_at) VALUES (?, ?)").run(searchId, now);
    return Number(r.lastInsertRowid);
  }

  finishRun(id: number, patch: { pages: number; seen: number; newCount: number; status: string; error?: string }) {
    this.db
      .prepare(
        "UPDATE runs SET finished_at = ?, pages = ?, seen = ?, new_count = ?, status = ?, error = ? WHERE id = ?",
      )
      .run(new Date().toISOString(), patch.pages, patch.seen, patch.newCount, patch.status, patch.error ?? null, id);
  }

  needingAnalysis(searchId: string, prefsHash: string, staleAfterHours: number): Listing[] {
    const cutoff = new Date(Date.now() - staleAfterHours * 3600_000).toISOString();
    const rows = this.db
      .prepare(
        `SELECT l.data FROM listings l
         LEFT JOIN analyses a ON a.listing_id = l.id AND a.search_id = l.search_id AND a.prefs_hash = ?
         WHERE l.search_id = ? AND l.last_seen >= ? AND a.listing_id IS NULL`,
      )
      .all(prefsHash, searchId, cutoff) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Listing);
  }

  saveAnalyses(searchId: string, items: Analysis[]) {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO analyses (listing_id, search_id, prefs_hash, score, verdict, reason, model, analyzed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const a of items) {
      stmt.run(a.listingId, searchId, a.prefsHash, a.score, a.verdict, a.reason, a.model, a.analyzedAt);
    }
  }

  activeListings(searchId: string, prefsHash: string, staleAfterHours: number): StoredListing[] {
    const cutoff = new Date(Date.now() - staleAfterHours * 3600_000).toISOString();
    const rows = this.db
      .prepare(
        `SELECT l.data, l.first_seen, l.last_seen,
                a.score, a.verdict, a.reason, a.model, a.analyzed_at
         FROM listings l
         LEFT JOIN analyses a ON a.listing_id = l.id AND a.search_id = l.search_id AND a.prefs_hash = ?
         WHERE l.search_id = ? AND l.last_seen >= ?`,
      )
      .all(prefsHash, searchId, cutoff) as any[];
    const history = this.db
      .prepare("SELECT listing_id, price, seen_at FROM price_history WHERE search_id = ? ORDER BY seen_at")
      .all(searchId) as { listing_id: number; price: number; seen_at: string }[];
    const byId = new Map<number, { price: number; seenAt: string }[]>();
    for (const h of history) {
      const entries = byId.get(h.listing_id) ?? [];
      entries.push({ price: h.price, seenAt: h.seen_at });
      byId.set(h.listing_id, entries);
    }
    return rows.map((r) => {
      const l = JSON.parse(r.data) as Listing;
      return {
        ...l,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        analysis:
          r.score == null
            ? null
            : {
                listingId: l.id,
                score: r.score,
                verdict: r.verdict,
                reason: r.reason,
                model: r.model,
                analyzedAt: r.analyzed_at,
                prefsHash,
              },
        priceChanges: byId.get(l.id) ?? [],
      };
    });
  }
}
