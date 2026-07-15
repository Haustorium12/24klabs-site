// Single source of truth for listing slugs + lookups. Imported by BOTH the static Astro pages
// (index.astro, listing/[slug].astro) AND the Pages Functions (card.svg, api/v1/verify,
// billboard/*), so a home card, its snapshot page, and the API all agree on the same slug.
//
// Slugs are STABLE and URL-safe: derived from the listing name (falling back to the URL host),
// with deterministic de-duplication in editorial order (-2, -3, ...). Because editorial.json is
// append-mostly, existing slugs stay put as long as earlier rows don't change.

import editorial from '../data/editorial.json';

function baseSlug(entry) {
  let s = (entry.name || '').toLowerCase().trim();
  if (!s && entry.url) {
    try { s = new URL(entry.url).host.replace(/^www\./, ''); } catch { s = entry.url; }
  }
  s = s
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')   // collapse anything non-alphanumeric to a single dash
    .replace(/^-+|-+$/g, '');       // trim leading/trailing dashes
  return s || 'listing';
}

// Build the enriched, slugged list ONCE at module load (deterministic — no Date/random).
const seen = new Map();
export const listings = editorial.map((entry, index) => {
  const base = baseSlug(entry);
  const n = (seen.get(base) || 0) + 1;
  seen.set(base, n);
  const slug = n === 1 ? base : `${base}-${n}`;
  return { ...entry, slug, index };
});

const BY_SLUG = new Map(listings.map((e) => [e.slug, e]));
export function bySlug(slug) {
  return BY_SLUG.get(slug) || null;
}

// URL matching (mirrors functions/badge.svg.js normalization) so /api/v1/verify and card.svg
// can resolve an arbitrary resource URL to a listing by url OR badge_resource endpoint.
export function normalizeUrl(u) {
  if (!u) return '';
  return String(u).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

const BY_URL = new Map();
for (const e of listings) {
  if (e.url) BY_URL.set(normalizeUrl(e.url), e);
  if (e.badge_resource) BY_URL.set(normalizeUrl(e.badge_resource), e);
}
export function byResource(resourceUrl) {
  return BY_URL.get(normalizeUrl(resourceUrl)) || null;
}
