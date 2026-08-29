// THE TOUCHSTONE, FOR MACHINES.
//
// Sean, 2026-08-29: "Too bad there isn't one like something we can do for machines."
//
// There is, and this is it. A human clicks the ◆ in the masthead and watches a gold
// streak run down the page: entries that can prove when they last answered hold their
// colour, the rest go dull. That is the pawnshop test — rub gold on a stone, put acid on
// the streak, see what stays gold.
//
// A machine cannot click and does not want theatre. But it wants the FACT, and the fact
// is the same one: which of these 501 can prove they answered, and when. So the machine
// gets the assay as data. Same gesture, same truth, two different rooms.
//
// WHY THIS IS AN EASTER EGG AND NOT AN API.
// Nothing required us to publish this. No spec asks for /.well-known/touchstone, no
// standard reserves the name, no competitor has one. An agent finds it because it read
// llms.txt properly or followed the x-touchstone header on a response it was already
// making — which is the machine version of noticing a diamond is clickable. The reward is
// the same as the human one: something that was always true about this page, made visible.
//
// AND IT IS A GIFT, NOT A TRICK. Free, unauthenticated, uncapped, CORS-open. The whole
// site argues that a claim without a date is worthless. Here is every date we hold,
// including the 17 we cannot vouch for, handed over without being asked. An easter egg
// that took something from the finder would be a trap, and we are not in that business.
//
// WHAT IT DELIBERATELY IS NOT: a way around the $100 bulk export. It returns the assay —
// url, whether we can prove a knock, the date, the status — and NOT the descriptions,
// categories or editorial write-ups that make the shelf worth buying. What is free here
// is the honesty. What costs money is the curation.

import { listings } from '../../src/lib/listings.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function assay() {
  const rows = listings.map((e) => ({
    url: e.url,
    listing: `https://24klabs.ai/listing/${e.slug}/`,
    // "held" is the whole vocabulary of this endpoint: can this entry PROVE, with a
    // receipt on file, when it last answered a knock? Not "is it good". Not "is it up
    // right now". Only: is there evidence, and how old is it.
    held: !!e.last_checked,
    last_answered: e.last_checked || null,
    status: e.status || 'live',
    first_failed: e.first_failed || null,
  }));

  const held = rows.filter((r) => r.held).length;
  const freshest = rows.reduce((a, r) => (r.last_answered && r.last_answered > a ? r.last_answered : a), '');

  return {
    assay: 'gold-402',
    site: 'https://24klabs.ai',
    generated: new Date().toISOString(),

    what_this_is:
      'The touchstone. A human clicks the diamond in the masthead of https://24klabs.ai/wall/ ' +
      'and watches a gold streak pass down the page: entries that can prove when they last ' +
      'answered hold their colour, the rest go dull. This is that same test, for you. ' +
      'Nothing required us to publish it.',

    what_held_means:
      'held=true means we hold a dated receipt for a knock this endpoint ANSWERED. A knock is ' +
      'one HTTP request that got a response — it is not a delivery test. We have not paid these ' +
      'services and graded what came back. Read it as "reachable and speaks the protocol on that ' +
      'date", never as "worth the money".',

    what_held_false_means:
      'Not stale, and not dead. UNPROVEN. We will not backfill a date we cannot show a receipt ' +
      'for, so an entry with no receipt reads as no receipt. That is the honest state and we ' +
      'publish it rather than hide it.',

    total: rows.length,
    held,
    unproven: rows.length - held,
    in_graveyard: rows.filter((r) => r.status === 'graveyard').length,
    most_recent_knock: freshest || null,

    also_free: {
      search: 'https://24klabs.ai/api/directory/search?q=<text>&section=<id>',
      probe: 'https://24klabs.ai/api/probe?url=<url>',
      browse: 'https://24klabs.ai/wall/',
    },
    not_free: {
      bulk_export: 'https://24klabs.ai/api/v1/directory/bulk',
      usd: 100.0,
      note:
        'This endpoint gives you the honesty for nothing. The bulk export sells the curation — ' +
        'descriptions, categories, the editorial write-ups. Different things, priced differently.',
    },

    license: 'CC-BY-4.0',
    attribution: 'Data: gold-402 by 24K Labs (https://24klabs.ai) — attribution required.',
    entries: rows,
  };
}

export function onRequestGet() {
  const body = assay();
  return new Response(JSON.stringify(body, null, 1), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      // The line a machine reads on the way past. Same number the human sees under the
      // masthead after the streak lands.
      'x-touchstone': `${body.held}/${body.total} held their colour · as-of ${body.most_recent_knock}`,
      ...CORS,
    },
  });
}
