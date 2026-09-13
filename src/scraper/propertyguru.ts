import type { BrowserContext, Page } from "patchright";
import type { Listing, ListingType, QueryParams } from "../types.js";
import { normalize } from "./parse.js";
import { notifyMac } from "../notify.js";

const BASE = "https://www.propertyguru.com.sg";

export function searchUrl(type: ListingType, params: QueryParams, page: number): string {
  const folder = type === "rent" ? "property-for-rent" : "property-for-sale";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const item of Array.isArray(v) ? v : [v]) qs.append(k, item);
  qs.set("sort", "date");
  qs.set("order", "desc");
  return `${BASE}/${folder}${page > 1 ? "/" + page : ""}?${qs}`;
}

export interface PageResult {
  page: number;
  totalPages: number;
  listings: Listing[];
}

export class ChallengeTimeoutError extends Error {
  constructor(url: string) {
    super(`Cloudflare verification not completed in time at ${url}`);
  }
}

// Both helpers tolerate the challenge page reloading mid-call.
async function nextDataJson(page: Page): Promise<string | null> {
  return page.evaluate(() => document.getElementById("__NEXT_DATA__")?.textContent ?? null).catch(() => null);
}

async function isChallenge(page: Page): Promise<boolean> {
  return /just a moment|security verification/i.test(await page.title().catch(() => ""));
}

async function needsHuman(page: Page): Promise<boolean> {
  const body = await page.locator("body").innerText({ timeout: 2000 }).catch(() => "");
  return /verify you are human/i.test(body);
}

async function loadPage(page: Page, url: string, challengeWaitMs: number, log: (m: string) => void): Promise<Record<string, any>> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  let json = await nextDataJson(page);
  if (!json && (await isChallenge(page))) {
    const deadline = Date.now() + challengeWaitMs;
    let notified = false;
    while (Date.now() < deadline) {
      await page.waitForTimeout(1500);
      json = await nextDataJson(page);
      if (json) break;
      if (!notified && (await needsHuman(page))) {
        notified = true;
        log(`Cloudflare needs a human — click "Verify you are human" in the Chrome window (waiting up to ${Math.round(challengeWaitMs / 1000)}s)`);
        notifyMac("Property Finder", "PropertyGuru needs a human check. Click the checkbox in the Chrome window.");
        await page.bringToFront().catch(() => {});
      }
    }
    if (json) log(notified ? "Verification passed — continuing" : "Cloudflare auto-check passed");
  }
  if (!json) throw new ChallengeTimeoutError(url);
  return JSON.parse(json);
}

export interface ScrapeOptions {
  listingType: ListingType;
  maxPages: number;
  delayMs: [number, number];
  challengeWaitMs: number;
  log: (msg: string) => void;
}

export async function* scrapeQuery(
  ctx: BrowserContext,
  searchId: string,
  params: QueryParams,
  opts: ScrapeOptions,
): AsyncGenerator<PageResult> {
  const page = await ctx.newPage();
  try {
    let totalPages = Infinity;
    for (let n = 1; n <= Math.min(opts.maxPages, totalPages); n++) {
      if (n > 1) {
        const [lo, hi] = opts.delayMs;
        await page.waitForTimeout(lo + Math.random() * (hi - lo));
      }
      const data = await loadPage(page, searchUrl(opts.listingType, params, n), opts.challengeWaitMs, opts.log);
      const pd = data.props?.pageProps?.pageData?.data;
      const raw: any[] = pd?.listingsData ?? [];
      const result: PageResult = {
        page: Number(pd?.paginationData?.currentPage ?? n),
        totalPages: Number(pd?.paginationData?.totalPages ?? 1),
        listings: raw.map((r) => normalize(r, searchId)).filter((l): l is Listing => l !== null),
      };
      totalPages = result.totalPages;
      yield result;
      if (result.listings.length === 0) break;
    }
  } finally {
    await page.close();
  }
}
