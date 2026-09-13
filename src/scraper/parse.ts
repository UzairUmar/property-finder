import type { Listing } from "../types.js";

type Raw = Record<string, any>;

function num(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = s.replace(/,/g, "").match(/[\d.]+/);
  return m ? Number(m[0]) : null;
}

function flatten(x: unknown, acc: Raw[] = []): Raw[] {
  if (Array.isArray(x)) x.forEach((v) => flatten(v, acc));
  else if (x && typeof x === "object") acc.push(x as Raw);
  return acc;
}

function parseListedAt(text: string): string | null {
  const m = text.match(/Listed on ([A-Za-z]{3} \d{1,2}, \d{4})/);
  if (!m) return null;
  const d = new Date(m[1] + " 00:00:00 GMT+0800");
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalize(raw: Raw, searchId: string): Listing | null {
  const l = raw.listingData;
  if (!l?.id || !l?.url) return null;

  const features = flatten(l.listingFeatures);
  const byIcon = (prefix: string) =>
    num(features.find((f) => typeof f.iconName === "string" && f.iconName.startsWith(prefix))?.text);
  const sqft = num(features.find((f) => typeof f.text === "string" && /sqft/i.test(f.text))?.text);
  const textByIcon = (prefix: string) =>
    features.find((f) => typeof f.iconName === "string" && f.iconName.startsWith(prefix))?.text ?? null;

  return {
    id: Number(l.id),
    searchId,
    url: l.url,
    title: l.localizedTitle ?? "",
    address: l.fullAddress ?? "",
    area: l.shortAddress ?? "",
    price: Number(l.price?.value ?? 0),
    priceText: l.price?.pretty ?? "",
    psf: num(l.psfText),
    beds: byIcon("bed"),
    baths: byIcon("bath"),
    sqft,
    roomType: textByIcon("room"),
    tenants: textByIcon("people"),
    propertyType: l.property?.subTypeText ?? "",
    mrt: l.mrt?.nearbyText ?? null,
    listedText: l.recency?.text ?? "",
    listedAt: parseListedAt(l.recency?.text ?? ""),
    thumbnail: l.thumbnail ?? null,
    agentName: l.agent?.name ?? null,
    agencyName: l.agency?.name ?? null,
    badges: Array.isArray(l.badges) ? l.badges.map((b: Raw) => b.text).filter(Boolean) : [],
    isVerified: Boolean(l.isVerified),
  };
}
