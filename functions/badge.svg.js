// 24K Labs reciprocal trust badge — the mirror of fuchss's x402.fuchss.app/badge.svg.
// GET /badge.svg?resource=<url-encoded> -> image/svg+xml
//
// THE WORD "Verified" IS GONE FROM THIS BADGE (2026-09-06, Sean). It used to read
// "Gold402 | ✓ Verified" for anything on the list, which meant it said the same thing
// about a paid API we had knocked and about a community wiki with no endpoint to knock.
// A mark that everything wears certifies nothing.
//
// The endpoint stays live on purpose. Third parties have embedded this image on pages we
// do not control, and 404-ing it would break their sites to make a point. So it keeps
// serving — it just stops making a claim it cannot support, and now reports a FACT:
//
//   matched + we hold a dated knock receipt -> gold   "Gold402 | knocked <YYYY-MM-DD>"
//   matched, no receipt                     -> muted  "Gold402 | listed"
//   not matched                             -> neutral "Gold402 | not listed"
//
// A date is checkable. A tick is not. If the sweep stops knocking an entry, this badge
// stops showing a fresh date on its own — which is the only kind of badge worth embedding.

import editorial from "../src/data/editorial.json";

// Build the match set once per isolate: normalized url + badge_resource for every entry.
function normalize(u) {
  if (!u) return "";
  let s = String(u).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return s;
}

// Map, not Set: we need the knock date, not just membership.
const MATCH = new Map();
for (const e of editorial) {
  const when = e.last_checked || null;
  if (e.url) MATCH.set(normalize(e.url), when);
  if (e.badge_resource) MATCH.set(normalize(e.badge_resource), when);
}

function svg(listed, knockedOn) {
  // Three states, and the strongest one is a date rather than a word.
  const right = !listed ? "not listed" : (knockedOn ? `knocked ${knockedOn}` : "listed");
  const rightW = !listed ? 74 : (knockedOn ? 118 : 48);
  const total = 60 + rightW;
  const rightBg = !listed ? "#26262e" : (knockedOn ? "#D4AF37" : "#3a3a44");
  const rightFg = !listed ? "#8a8a99" : (knockedOn ? "#1a1a24" : "#d8d8e0");
  const weight = knockedOn ? "bold" : "normal";
  const label = !listed ? "Gold402: not listed"
              : (knockedOn ? `Gold402: endpoint answered a 402 on ${knockedOn}` : "Gold402: listed, no knock receipt");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${label}">
  <clipPath id="r"><rect width="${total}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <rect width="60" height="20" fill="#1a1a24"/>
    <rect x="60" width="${rightW}" height="20" fill="${rightBg}"/>
    <text x="30" y="14" fill="#D4AF37" text-anchor="middle">Gold402</text>
    <text x="${60 + rightW / 2}" y="14" fill="${rightFg}" text-anchor="middle" font-weight="${weight}">${right}</text>
  </g>
</svg>`;
}

export function onRequestGet(context) {
  const url = new URL(context.request.url);
  // searchParams.get() has ALREADY percent-decoded once — decoding again corrupts any
  // resource URL that legitimately contains percent-escapes in its own query string
  // (first hit: Viridis, whose URL carries manifest=%7B%7D). Match the once-decoded
  // form first; fall back to one extra decode for legacy double-encoded embeds.
  const resource = url.searchParams.get("resource") || "";
  let key = normalize(resource);
  let listed = MATCH.has(key);
  if (!listed) {
    try {
      const extra = decodeURIComponent(resource);
      if (extra !== resource && MATCH.has(normalize(extra))) {
        listed = true;
        key = normalize(extra);
      }
    } catch {
      /* malformed escapes: treat as not listed rather than 500 */
    }
  }
  // null when we hold no dated receipt -- the badge then says "listed" and nothing more,
  // which is the truth for the entries the sweep has not reached.
  const knockedOn = listed ? MATCH.get(key) : null;
  return new Response(svg(listed, knockedOn), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
