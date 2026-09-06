// 24K Labs aggregation card — the "truth-layer card" nobody else can offer: OUR verdict PLUS
// independent rater grades in one image. Bigger sibling of /badge.svg.
// GET /card.svg?resource=<url-encoded> -> image/svg+xml
//
// Resource-aware by design (same as badge.svg): it resolves the resource against the curated
// list, so it can never light green on a service we haven't vetted. Rater grades are fetched
// best-effort at the edge and cached; on any upstream hiccup the card still renders (verdict +
// "grade pending"), it never fails the image.

import { byResource } from '../src/lib/listings.js';
import { ratersFor, fetchFuchssGrade } from '../src/lib/raters.js';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function renderCard({ listed, name, verdict, grades }) {
  const W = 380;
  const H = 128;
  const accent = listed ? '#D4AF37' : '#555566';
  const verdictColor = listed ? '#D4AF37' : '#8a8a99';
  const gradeLine = grades.length
    ? grades.map((g) => `${g.label}: ${g.grade || '—'}${g.score != null ? ` (${g.score})` : ''}`).join('   ')
    : 'Independent grade pending';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="24K Labs verdict card">
  <rect width="${W}" height="${H}" rx="10" fill="#111118" stroke="#2a2a3a"/>
  <rect x="0" y="0" width="4" height="${H}" rx="2" fill="${accent}"/>
  <g font-family="Inter,Segoe UI,Verdana,sans-serif">
    <text x="22" y="30" fill="#D4AF37" font-size="12" font-weight="700" letter-spacing="1.5">24K LABS</text>
    <text x="${W - 22}" y="30" fill="#555566" font-size="10" text-anchor="end" letter-spacing="0.5">THE x402 TRUTH LAYER</text>
    <text x="22" y="62" fill="#e8e8ed" font-size="18" font-weight="800">${esc(truncate(name, 30))}</text>
    <text x="22" y="88" fill="${verdictColor}" font-size="13" font-weight="700">${esc(verdict)}</text>
    <text x="22" y="112" fill="#8888a0" font-size="11" font-family="JetBrains Mono,monospace">${esc(truncate(gradeLine, 52))}</text>
  </g>
</svg>`;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  // searchParams.get() already decodes once; a second decode corrupts resource URLs
  // that contain their own percent-escapes. Try the once-decoded form first, then one
  // lenient extra decode for legacy double-encoded embeds (throw-safe).
  const resource = url.searchParams.get('resource') || '';
  let entry = byResource(resource);
  if (!entry) {
    try {
      const extra = decodeURIComponent(resource);
      if (extra !== resource) entry = byResource(extra);
    } catch {
      /* malformed escapes: no match */
    }
  }

  let grades = [];
  if (entry) {
    // Best-effort, bounded: fetch each rater's live grade; failures degrade to "pending".
    const raters = ratersFor(entry);
    grades = await Promise.all(
      raters.map(async (r) => {
        const parsed = await fetchFuchssGrade(r.badgeUrl);
        return { label: r.label, grade: parsed && parsed.grade, score: parsed && parsed.score };
      })
    );
  }

  const svg = renderCard({
    listed: !!entry,
    name: entry ? entry.name : 'Not listed',
    // A date where we have one, plain membership where we do not, and never a tick.
    verdict: entry
      ? (entry.last_checked ? `Endpoint answered a 402 on ${entry.last_checked}` : 'On the curated list — no knock receipt yet')
      : 'Not on the curated list',
    grades,
  });

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // Longer cache than badge: the card fans out to upstream raters, so amortize the fetch.
      'cache-control': 'public, max-age=900',
      'access-control-allow-origin': '*',
    },
  });
}
