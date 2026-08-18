// The curated directory, machine-readable.
//
// ANONYMOUS CALLERS GET A PREVIEW, NOT THE FULL SHELF.
//
// The full list is 400+ entries probed by hand, one at a time, over months. It is the
// product, not a marketing asset, and a single unauthenticated GET should not hand a
// competitor the whole thing. Bulk access is being priced; until that exists this route
// serves shelf structure, counts and a recent sample — enough for an agent to discover
// what is here and decide whether to look something up.
//
// Nothing is hidden: every entry stays browsable at /directory with a permanent page at
// /listing/<slug>. Per-resource verdicts are available now via the Verify API. This caps
// bulk extraction, not access.

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
    preview: true,
    preview_count: sample.length,
    notice:
      `This is a preview. ${all.length} entries are curated; the ${sample.length} most recently ` +
      `listed are included here. Every entry is browsable at https://24klabs.ai/directory and has ` +
      `a permanent page at /listing/<slug>. Bulk access to the full set is being priced — ` +
      `ask at https://24klabs.ai/support.`,
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
