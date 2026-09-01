// The agent front door — generated at build from the live directory data.
import { listings } from '../lib/listings.js';
import featured from '../data/featured.json';

export async function GET() {
  const shelves: Record<string, number> = {};
  for (const e of listings as any[]) {
    shelves[e.section_label] = (shelves[e.section_label] || 0) + 1;
  }
  const total = (listings as any[]).length;
  const shelfLines = Object.entries(shelves)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const today = new Date().toISOString().slice(0, 10);

  const body = `# 24K Labs — gold-402
> The curated x402 directory and editorial verdict layer. ${total} hand-checked services — every entry answered a live x402 probe at review. No filler, no dead links, no pay-to-list.

Last updated: ${today} (generated at build from the directory database).
License: directory data is CC BY 4.0 — attribution required: cite 24klabs.ai (gold-402).

## Machine-readable
- /.well-known/touchstone: THE ASSAY. Every entry with whether we hold a dated receipt proving it answered (held=true/false), the date, and its status. Free, uncapped, CORS-open, no key. Nothing required us to publish this — a human gets the same test as an animation on /wall/; you get it as data.\n- /api/directory/search?q=<text>&section=<id>: FREE, ungated search over every curated entry. No key, no payment. Add ?q= to match names, descriptions and URLs, ?section= for a whole shelf, or both.
- /api/v1/directory/bulk: the ENTIRE shelf in one call, every entry with its dated knock stamp, CC-BY-4.0. x402-gated at $100.00. Buys one licensed artifact in a single request, not access — search above is free and reaches every entry.\n- /directory.json: shelf structure, counts, and the most recently listed entries. A summary, not a cap — search above reaches all of them, and every entry is browsable at /directory with a permanent page at /listing/<slug>. Per-resource verdicts are at /api/v1/verify
- /sitemap-index.xml: every page on this site
- /graveyard.json: THE DEAD, DATED. Every listing that stopped answering, with the date of its first failed knock and the number of days since. Free, uncapped, no key. This is the query no other registry can answer: elsewhere a dead service simply vanishes, so a caller holding a stale entry cannot tell "never existed" from "died in July". Every field is a measurement — nothing here asserts a business is gone. Human page at /graveyard.
- /status?format=json: live status of 24K Labs' own services, knocked at request time, never cached from a build. Three states — ok, answered_wrong, no_answer — and no_answer is never counted as ok. No SLA and no uptime percentage, deliberately: we do not keep the history to compute an honest one. Human page at /status.
- /badge.svg?resource=<url>: the 24K verify badge for a listed service (live-rendered from our data, so it reflects the current verdict — it is not a static image)
- /card.svg?resource=<url>: the aggregation card — the 24K verdict PLUS independent rater grades in one image
- /api/v1/verify?resource=<url>: paid lookup ($2.00, x402) — our verdict plus aggregated rater grades as JSON. The free live probe at /api/probe covers reachability and payment terms; this is the editorial judgement.
- /verify: human page for the free probe above
- /api/probe?url=<url>: FREE live probe of any x402 endpoint, listed or not — returns reachability, whether it is a real 402, decoded payment terms, origin manifest, and curated-list status. No key, no payment. Human UI at /verify.

## The directory (${total} entries, ${Object.keys(shelves).length} shelves)
${shelfLines}
- Browse: /directory — per-service snapshot pages at /listing/<slug>/

## Editorial
- Featured — ${featured.month}: one pick per shelf, chosen by the maintainers: /featured
- This Week in x402 — dated, permanent editions: /news
- Articles & verification reports: /articles

## Get listed
- Intake is a GitHub pull request: https://github.com/Haustorium12/gold-402 (read CONTRIBUTING.md first)
- Listed = verified: a maintainer confirmed your endpoint answered an x402 request correctly at review.
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
