// src/lib/shelf.js — how many endpoints we actually sell, counted at build.
//
// WHY THIS FILE EXISTS
//   /about said "Six live AI services" for weeks while the manifests served 147.
//   Nobody lied; somebody typed a number once and the shelf grew past it. A count
//   that is typed is a count that goes stale, and it goes stale silently, in the
//   flattering direction — you never notice the page underselling you.
//
//   /products/index.astro already solved this on 2026-09-03 by fetching the
//   manifests at build. That logic lived inside one page, so the next page to want
//   the number typed it instead. This file is that logic, lifted out, so there is
//   exactly one place the number comes from and no page can get it wrong.
//
// THE RULE, AND IT IS THE WHOLE POINT
//   If the manifests do not answer, this returns null and the caller renders NO
//   number. Not a cached one, not a fallback constant, not "approximately". A page
//   that prints a stale count while the probe was failing is the failure mode this
//   file was written to end. No count is better than a wrong one.

const MANIFESTS = [
  'https://api.24klabs.ai/.well-known/x402.json',
  'https://time.24klabs.ai/.well-known/x402.json',
];

async function countResources(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.resources) ? json.resources.length : null;
  } catch {
    return null;
  }
}

/**
 * Counts every resource the live manifests advertise.
 *
 * Returns { total, perHost, hosts }. `total` is null unless EVERY host answered —
 * a partial sum is a wrong number wearing a right number's clothes, and it would
 * read as a quiet shrinkage of the shelf rather than as a failed probe.
 */
export async function countShelf() {
  const perHost = await Promise.all(MANIFESTS.map(countResources));
  const complete = perHost.every((c) => c !== null);
  return {
    total: complete ? perHost.reduce((a, c) => a + c, 0) : null,
    perHost,
    hosts: MANIFESTS,
  };
}

// Small-number words, for prose where a numeral reads wrong ("The eleven services
// below"). Only covers what a card grid plausibly holds; anything larger falls
// back to the numeral rather than inventing a word.
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
               'eight', 'nine', 'ten', 'eleven', 'twelve'];

export function inWords(n) {
  return WORDS[n] ?? String(n);
}
