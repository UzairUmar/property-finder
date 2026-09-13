export type ListingType = "rent" | "sale";

export type QueryParams = Record<string, string | string[]>;

export interface SearchConfig {
  id: string;
  label: string;
  queries: QueryParams[];
  exclude?: string[];
}

export interface AppConfig {
  listingType: ListingType;
  districts?: { include: string[] };
  searches: SearchConfig[];
  maxPages: number;
  stopAfterKnownPages: number;
  pageDelayMs: [number, number];
  challengeWaitSec: number;
  staleAfterHours: number;
}

export interface Listing {
  id: number;
  searchId: string;
  url: string;
  title: string;
  address: string;
  area: string;
  price: number;
  priceText: string;
  psf: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  roomType: string | null;
  tenants: string | null;
  propertyType: string;
  mrt: string | null;
  listedText: string;
  listedAt: string | null;
  thumbnail: string | null;
  agentName: string | null;
  agencyName: string | null;
  badges: string[];
  isVerified: boolean;
}

export type Verdict = "strong" | "maybe" | "skip";

export interface Analysis {
  listingId: number;
  score: number;
  verdict: Verdict;
  reason: string;
  model: string;
  analyzedAt: string;
  prefsHash: string;
}

export interface StoredListing extends Listing {
  firstSeen: string;
  lastSeen: string;
  analysis: Analysis | null;
  priceChanges: { price: number; seenAt: string }[];
}
