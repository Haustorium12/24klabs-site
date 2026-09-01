// The graveyard, machine-readable. GRAVEYARD_v0.1 build item 5.
//
// This route exists because of the one query the page was born to answer: an agent
// holding a stale entry from somebody else's registry wants to know whether the thing
// is dead and since when. Every other directory answers "not found" — the dead vanish
// from x402scan, from CDP Bazaar, from every telemetry-badge player, leaving the caller
// unable to tell "never existed" from "died in July". We kept the dates, so we can
// answer it. Full set, no cap: unlike /directory.json this is small, and the whole
// point of the record is being able to look one up.
//
// SAME RULE AS THE PAGE: every field here is a measurement. `down_days` and the two
// dates are things we knocked on and recorded. There is no status adjective in this
// payload and there must never be one — "abandoned" is a characterization of somebody's
// business, it is unfalsifiable, and a JSON field is exactly where a reader would treat
// it as fact.
//
// Static build: no query parameters, no filtering. A caller wanting one entry reads the
// array; it is four rows today and will not be thousands.

import { listings } from '../lib/listings.js';

function days(from: string | null, to: string): number | null {
  if (!from) return null;
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export async function GET() {
  const built = new Date().toISOString().slice(0, 10);
  const all = listings as any[];

  const buried = all
    .filter((e) => e.status === 'graveyard')
    .map((e) => ({
      name: e.name,
      url: e.url,
      section: e.section,
      section_label: e.section_label,
      description: e.desc,
      // The clock runs from the FIRST failed knock, not from the day the entry moved.
      first_failed: e.first_failed || null,
      down_days: days(e.first_failed || null, built),
      // Only emitted when the record can actually distinguish an answer from a failure:
      // `last_checked` moves only on a knock that answered, but that was a correction,
      // and rows stamped before it may carry a failure date. Strictly-earlier is the one
      // unambiguous case. null means "we do not know", never "never answered".
      last_answered:
        e.last_checked && e.first_failed && e.last_checked < e.first_failed ? e.last_checked : null,
      first_listed: e.first_listed || null,
      returned: e.returned || null,
      listing: `https://24klabs.ai/listing/${e.slug}/`,
    }))
    .sort((a, b) => (b.down_days ?? -1) - (a.down_days ?? -1) || a.name.localeCompare(b.name));

  const body = {
    source: 'https://24klabs.ai/graveyard',
    site: 'https://24klabs.ai',
    generated: built,
    count: buried.length,
    still_listed: all.filter((e) => e.status !== 'graveyard').length,
    returned_to_shelf: all.filter((e) => e.returned).length,
    method:
      'Every listing is knocked on a nightly sweep. Two consecutive failures, or one hard DNS failure, moves an entry here. The clock starts at the first failed knock. An entry that answers again returns to the live shelf automatically and keeps its history.',
    reads: {
      measurement:
        'down_days is the number of days between the first failed knock and the generated date. It says an endpoint did not answer us. It does not say a business is gone, and no field here asserts that.',
      null_last_answered:
        'last_answered is null when the record cannot separate an answer from a failure for that row. Null means unknown, not never.',
    },
    entries: buried,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300',
    },
  });
}
