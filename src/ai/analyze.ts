import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Analysis, Listing } from "../types.js";

const MODEL = "claude-opus-5";
const CHUNK = 20;

const ResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      score: z.number().int().min(1).max(10),
      verdict: z.enum(["strong", "maybe", "skip"]),
      reason: z.string(),
    }),
  ),
});

const SYSTEM_INTRO = `You are a Singapore rental property analyst helping one person shortlist units on PropertyGuru.
Score each listing from 1 (clearly wrong for them) to 10 (near-perfect match) against their preferences below.
Verdict rules: "strong" = 8-10, "maybe" = 5-7, "skip" = 1-4.
Reason: one sentence, concrete, mention the deciding factor (price, location, MRT distance, size, type). No filler.
Any listing violating a must-have or deal-breaker scores at most 3.
Return one result per listing id you were given, no extras.

## Preferences
`;

function slim(l: Listing) {
  return {
    id: l.id,
    title: l.title,
    address: l.address,
    area: l.area,
    price_sgd_month: l.price,
    psf: l.psf,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    room_type: l.roomType,
    tenants_in_unit: l.tenants,
    type: l.propertyType,
    mrt: l.mrt,
    listed: l.listedText,
    badges: l.badges,
  };
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function analyzeListings(
  listings: Listing[],
  preferences: { text: string; hash: string },
  log: (msg: string) => void,
): Promise<Analysis[]> {
  const client = new Anthropic();
  const out: Analysis[] = [];

  for (let i = 0; i < listings.length; i += CHUNK) {
    const batch = listings.slice(i, i + CHUNK);
    log(`AI scoring ${i + 1}-${i + batch.length} of ${listings.length}`);
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: SYSTEM_INTRO + preferences.text,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Score these listings:\n\n${JSON.stringify(batch.map(slim), null, 1)}`,
        },
      ],
      output_config: { format: zodOutputFormat(ResultSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) {
      log(`AI returned unparseable output for batch at ${i} (stop_reason=${response.stop_reason})`);
      continue;
    }
    const now = new Date().toISOString();
    const ids = new Set(batch.map((l) => l.id));
    for (const r of parsed.results) {
      if (!ids.has(r.id)) continue;
      out.push({
        listingId: r.id,
        score: r.score,
        verdict: r.verdict,
        reason: r.reason,
        model: MODEL,
        analyzedAt: now,
        prefsHash: preferences.hash,
      });
    }
  }
  return out;
}
