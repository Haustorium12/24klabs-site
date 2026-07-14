// 24K Labs reciprocal trust badge — the mirror of fuchss's x402.fuchss.app/badge.svg.
// GET /badge.svg?resource=<url-encoded> -> image/svg+xml
//
// Resource-aware BY DESIGN: it checks the actual curated list, so it can never light
// green on a service we haven't vetted. A static always-"verified" image would destroy
// the meaning of the stamp.
//
// Semantic (aligned to Phase 1 doctrine, 2026-07-13): being ON the curated list IS being
// verified — single tier, curation is the bar. So there are two states, not three:
//   matched (by entry url OR badge_resource endpoint) -> gold "24K Labs | Verified"
//   not matched                                       -> neutral "24K Labs | not listed"
// (The earlier order's middle "Listed-but-unverified" state is collapsed because Phase 1
// removed the unverified tier. Flagged to Claude in the done-letter.)

import editorial from "../src/data/editorial.json";

// Build the match set once per isolate: normalized url + badge_resource for every entry.
function normalize(u) {
  if (!u) return "";
  let s = String(u).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return s;
}

const MATCH = new Set();
for (const e of editorial) {
  if (e.url) MATCH.add(normalize(e.url));
  if (e.badge_resource) MATCH.add(normalize(e.badge_resource));
}

function svg(listed) {
  const right = listed ? "✓ Verified" : "not listed";
  const rightW = listed ? 72 : 74;
  const total = 60 + rightW;
  const rightBg = listed ? "#D4AF37" : "#26262e";
  const rightFg = listed ? "#1a1a24" : "#8a8a99";
  const weight = listed ? "bold" : "normal";
  const label = listed ? "24K Labs: Verified" : "24K Labs: not listed";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${label}">
  <clipPath id="r"><rect width="${total}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <rect width="60" height="20" fill="#1a1a24"/>
    <rect x="60" width="${rightW}" height="20" fill="${rightBg}"/>
    <text x="30" y="14" fill="#D4AF37" text-anchor="middle">24K Labs</text>
    <text x="${60 + rightW / 2}" y="14" fill="${rightFg}" text-anchor="middle" font-weight="${weight}">${right}</text>
  </g>
</svg>`;
}

export function onRequestGet(context) {
  const url = new URL(context.request.url);
  const resource = url.searchParams.get("resource") || "";
  const listed = MATCH.has(normalize(decodeURIComponent(resource)));
  return new Response(svg(listed), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
