// The curated directory as machine-readable JSON. CC BY 4.0, attribution required.
import { listings } from '../lib/listings.js';

export async function GET() {
  const entries = (listings as any[]).map((e) => ({
    name: e.name,
    url: e.url,
    section: e.section,
    section_label: e.section_label,
    description: e.desc,
    verified: !!e.verified,
    first_listed: e.first_listed || null,
    listing: `https://24klabs.ai/listing/${e.slug}/`,
  }));
  const payload = {
    source: '24K Labs — gold-402',
    site: 'https://24klabs.ai',
    license: 'CC-BY-4.0',
    attribution: 'Data: gold-402 by 24K Labs (https://24klabs.ai) — attribution required.',
    generated: new Date().toISOString(),
    count: entries.length,
    entries,
  };
  return new Response(JSON.stringify(payload, null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
