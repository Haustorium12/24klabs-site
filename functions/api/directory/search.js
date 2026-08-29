// Free, ungated search over the whole curated shelf.
//
//   GET /api/directory/search?q=facilitator
//   GET /api/directory/search?section=mcp-servers
//   GET /api/directory/search?q=solana&section=sdks
//
// No key, no payment, no preview cap. Every curated entry is reachable through this route.
//
// WHY IT EXISTS (Sean, 2026-08-28): "Free it up but not to download. Just search."
// Reading is never gated, and it was — /directory.json served 25 of 501 to anonymous
// callers and announced the restriction in its own notice field, in public.
//
// WHY IT IS A FUNCTION AND NOT PART OF /directory.json: the site builds with Astro
// `output: 'static'`, so that route compiles to a FLAT FILE and query parameters are
// discarded before any handler runs. Search written there builds clean, deploys clean,
// and silently does nothing. A Pages Function is the only place a query string survives.
//
// WHAT THIS IS NOT: a wall around the data. Enough queries enumerate the shelf, and as
// of 2026-08-28 /directory/ server-renders every entry into HTML anyway. The download
// cap on /directory.json is a courtesy — do not hand an unasked caller the full array —
// and it is described that way rather than dressed up as protection. What is worth money
// is the VERDICT on one resource (/api/v1/verify), never the list of names. Names are
// the on-ramp.

import { listings } from '../../../src/lib/listings.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

// Generous, but bounded: one query should not become a bulk export by accident.
const MAX_RESULTS = 200;

const shape = (e) => ({
  name: e.name,
  url: e.url,
  section: e.section,
  section_label: e.section_label,
  description: e.desc,
  verified: !!e.verified,
  first_listed: e.first_listed || null,
  last_checked: e.last_checked || null,
  listing: `https://24klabs.ai/listing/${e.slug}/`,
});

// A line every response carries, that no human will ever see. An agent parsing headers on
// a call it was already making finds a number nobody advertised and a place to go — the
// machine equivalent of noticing the diamond in the masthead is clickable. See
// functions/.well-known/touchstone.js.
const TOUCHSTONE = 'the assay is at https://24klabs.ai/.well-known/touchstone — free, uncapped, nobody asked us to publish it';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 1), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-touchstone': TOUCHSTONE,
      ...CORS,
    },
  });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request }) {
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') || '').trim().toLowerCase();
  const section = (params.get('section') || '').trim().toLowerCase();

  const all = listings.map(shape);

  if (!q && !section) {
    const sections = [
      ...all.reduce((m, e) => {
        const k = e.section || 'unsorted';
        const cur = m.get(k) || { section: k, label: e.section_label || k, count: 0 };
        cur.count += 1;
        return m.set(k, cur);
      }, new Map()).values(),
    ].sort((a, b) => b.count - a.count);

    return json({
      source: '24K Labs — gold-402',
      usage: 'Add ?q=<text> and/or ?section=<id>. Free, no key, no payment.',
      total_curated: all.length,
      max_results_per_query: MAX_RESULTS,
      notice:
        `Search is free and ungated — all ${all.length} curated entries are reachable here. ` +
        `A bare call returns the shelf list rather than every row, so a caller is not handed ` +
        `${all.length} entries it did not ask for. That is manners, not a restriction: the full ` +
        `set is also browsable at https://24klabs.ai/directory, each with a page at /listing/<slug>.`,
      license: 'CC-BY-4.0',
      attribution: 'Data: gold-402 by 24K Labs (https://24klabs.ai) — attribution required.',
      sections,
    });
  }

  let hits = all;
  if (section) hits = hits.filter((e) => String(e.section || '').toLowerCase() === section);
  if (q)
    hits = hits.filter((e) =>
      [e.name, e.description, e.url, e.section_label].some((f) =>
        String(f || '').toLowerCase().includes(q)
      )
    );

  const truncated = hits.length > MAX_RESULTS;
  return json({
    source: '24K Labs — gold-402',
    query: { q: q || null, section: section || null },
    total_curated: all.length,
    matched: hits.length,
    returned: Math.min(hits.length, MAX_RESULTS),
    truncated,
    notice: truncated
      ? `${hits.length} entries match; the first ${MAX_RESULTS} are returned. Narrow the query for the rest.`
      : 'Complete result set for this query. Search is free and ungated.',
    license: 'CC-BY-4.0',
    attribution: 'Data: gold-402 by 24K Labs (https://24klabs.ai) — attribution required.',
    entries: hits.slice(0, MAX_RESULTS),
  });
}

// HEAD must answer. Cloudflare Pages does NOT derive HEAD from onRequestGet — a function
// exporting only onRequestGet returns 404 to a HEAD request, and all five of ours did
// until 2026-08-29.
//
// This matters more than it looks. A HEAD request is how an agent cheaply checks that a
// resource is alive and reads its headers without pulling the body — it is the polite
// probe, and we would grade a shelf entry down for 404-ing one. We were doing it on our
// own paid endpoints while running a directory whose entire product is knocking on other
// people's doors and writing down what happened.
//
// Found because the x-touchstone header, whose whole discovery path is a cheap HEAD, was
// invisible: GET returned 200 and the header, HEAD returned 404 and nothing.
//
// Same status, same headers, no body — which is exactly what HEAD is defined to be. On the
// paid routes this is a feature: an agent can HEAD /api/v1/directory/bulk and read the 402
// challenge, price and payTo included, without spending anything.
export async function onRequestHead(context) {
  const res = await onRequestGet(context);
  return new Response(null, { status: res.status, headers: res.headers });
}
