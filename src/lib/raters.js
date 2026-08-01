// Aggregated rater grades — the truth-layer nobody else offers: OUR verdict PLUS independent
// rater grades gathered in one place. Currently one rater (fuchss); built as a list so adding
// raters later is a one-line push with no caller changes ("+N raters" room).
//
// fuchss publishes a per-endpoint badge as a LIVE SVG keyed to `badge_resource`. We never bake
// its letter/score into editorial.json (that would go stale) — the browser renders the live
// image, and server-side callers (card.svg, /api/v1/verify) best-effort fetch + parse it, with
// a clean fallback to just the badge URL when the parse is unavailable.

// The set of raters that apply to a listing, in display order (fuchss first).
export function ratersFor(entry) {
  const out = [];
  if (entry && entry.badge_resource) {
    out.push({
      key: 'fuchss',
      label: 'fuchss',
      resource: entry.badge_resource,
      badgeUrl: `https://x402.fuchss.app/badge.svg?resource=${encodeURIComponent(entry.badge_resource)}`,
      // Where the badge CLICKS THROUGH to: fuchss's live reliability report for this endpoint.
      href: `https://x402.fuchss.app/endpoint?resource=${encodeURIComponent(entry.badge_resource)}`,
    });
  }
  return out;
}

// Best-effort: fetch a fuchss badge SVG and pull out a letter grade + optional numeric score.
// Returns { grade, score } or null. Never throws; short-circuits on any failure so a slow or
// changed upstream can't break our endpoint. Server-side only (card.svg / verify).
export async function fetchFuchssGrade(badgeUrl) {
  try {
    const res = await fetch(badgeUrl, { cf: { cacheTtl: 300 } });
    if (!res.ok) return null;
    const svg = await res.text();
    // fuchss's SVG carries the truth in its aria-label ("x402 trust: grade A, score 84") —
    // parse that first; fall back to the old render-text heuristic if the label ever changes.
    const label = svg.match(/aria-label="x402 trust: grade ([A-F][+-]?), score (\d{1,3})"/);
    const gradeMatch = label ? [null, label[1]] : svg.match(/>\s*([A-F][+-]?)(?:\s*·\s*\d{1,3})?\s*</);
    const scoreMatch = label ? [null, label[2]] : svg.match(/>\s*(?:[A-F][+-]?\s*·\s*)?(\d{1,3})\s*</);
    const grade = gradeMatch ? gradeMatch[1] : null;
    let score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
    if (score != null && (score < 0 || score > 100)) score = null;
    if (!grade && score == null) return null;
    return { grade, score };
  } catch {
    return null;
  }
}
