// The curated directory, machine-readable. Structure + recent listings.
//
// SEARCH IS FREE AND UNGATED, AND IT LIVES AT /api/directory/search — not here.
// This route cannot host it: the site builds `output: 'static'`, so this file compiles
// to a flat asset and query parameters are discarded before any handler runs. Search
// written here would build clean, deploy clean, and silently do nothing.
//
// WHAT CHANGED (Sean, 2026-08-28): "Free it up but not to download. Just search."
// This route used to serve 25 of 501 and call itself a preview whose full set was
// "being priced". Reading is never gated, so that copy was describing a restriction we
// should not have had — and by then did not really have either: as of 2026-08-28 the
// /directory/ hub server-renders all 501 entries into HTML, so the whole shelf was
// already one unauthenticated GET away. The cap only inconvenienced polite callers
// using the clean interface. That is a tax on good manners, not a moat.
//
// So: this stays a summary because handing an unasked caller 501 rows is bad manners,
// and it now says exactly that instead of implying the rest is behind a price.

import { listings } from '../lib/listings.js';

const PREVIEW_LIMIT = 25;

export async function GET() {
  const all = (listings as any[]).map((e) => ({
    name: e.name,
    url: e.url,
    section: e.section,
    section_label: e.section_label,
    description: e.desc,
    verified: !!e.verified,
    first_listed: e.first_listed || null,
    listing: `https://24klabs.ai/listing/${e.slug}/`,
  }));

  const sections = Object.values(
    all.reduce((acc: any, e) => {
      const k = e.section || 'unsorted';
      acc[k] = acc[k] || { section: k, label: e.section_label || k, count: 0 };
      acc[k].count += 1;
      return acc;
    }, {})
  ).sort((a: any, b: any) => (b as any).count - (a as any).count);

  const sample = [...all]
    .sort((a, b) => String(b.first_listed || '').localeCompare(String(a.first_listed || '')))
    .slice(0, PREVIEW_LIMIT);

  const payload = {
    source: '24K Labs — gold-402',
    site: 'https://24klabs.ai',
    generated: new Date().toISOString(),
    count: all.length,
    preview: false,
    recent_count: sample.length,
    notice:
      `Summary view. All ${all.length} curated entries are reachable free and unauthenticated: ` +
      `search at https://24klabs.ai/api/directory/search?q=<text> (or ?section=<id>), or browse ` +
      `https://24klabs.ai/directory where every entry has a permanent page at /listing/<slug>. ` +
      `This route returns shelf structure and the ${sample.length} most recently listed rather ` +
      `than the full array — that is so a caller is not handed ${all.length} rows it did not ask ` +
      `for, not a restriction on access.`,
    search: {
      endpoint: 'https://24klabs.ai/api/directory/search?q=<text>&section=<id>',
      description: 'Free search over every curated entry. No key, no payment, no cap on access.',
    },
    per_resource_lookup: {
      endpoint: 'https://24klabs.ai/api/v1/verify?resource=<url>',
      description:
        'The 24K Labs verdict for a single resource, plus independent rater grades where published. x402-gated, no API key.',
    },
    free_probe: {
      endpoint: 'https://24klabs.ai/api/probe?url=<url>',
      description:
        'Free live check of any x402 endpoint, listed or not: reachability, whether it returns a real 402, decoded payment terms, origin manifest. Never spends money.',
    },
    license: 'CC-BY-4.0',
    attribution: 'Data: gold-402 by 24K Labs (https://24klabs.ai) — attribution required.',
    sections,
    entries: sample,
  };

  return new Response(JSON.stringify(payload, null, 1), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
