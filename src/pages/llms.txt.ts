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
- /directory.json: the full curated directory as JSON (licensed CC BY 4.0, attribution required)
- /sitemap-index.xml: every page on this site
- /badge.svg?resource=<url>: the 24K verify badge for listed services
- /api/probe?url=<url>: FREE live probe of any x402 endpoint, listed or not — returns reachability, whether it is a real 402, decoded payment terms, origin manifest, and curated-list status. No key, no payment. Human UI at /verify.

## The directory (${total} entries, ${Object.keys(shelves).length} shelves)
${shelfLines}
- Browse: /directory — per-service snapshot pages at /listing/<slug>/

## Editorial
- Featured — ${featured.month}: one pick per shelf, chosen by the maintainers: /featured
- This Week in x402 — the weekly wire, dated permanent editions: /news
- Articles & verification reports: /articles

## Get listed
- Intake is a GitHub pull request: https://github.com/Haustorium12/gold-402 (read CONTRIBUTING.md first)
- Listed = verified: a maintainer confirmed your endpoint answered an x402 request correctly at review.
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
