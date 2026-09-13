import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./types.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.join(ROOT, "data");
export const RESULTS_DIR = path.join(ROOT, "results");

const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

export function loadConfig(): AppConfig {
  const raw = fs.readFileSync(path.join(ROOT, "config", "searches.json"), "utf8");
  const config = JSON.parse(raw) as AppConfig;
  const districts = config.districts?.include;
  if (districts?.length) {
    for (const search of config.searches) {
      search.queries = search.queries.map((q) => ({ districtCode: districts, ...q }));
    }
  }
  return config;
}

export function loadPreferences(): { text: string; hash: string } {
  const text = fs.readFileSync(path.join(ROOT, "config", "preferences.md"), "utf8");
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 12);
  return { text, hash };
}
