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
// is the same one: which of these can prove they answered, and when. So the machine
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
// including every one we cannot vouch for, handed over without being asked. An easter egg
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


// WHAT KIND OF ADDRESS DID WE PUBLISH?  (2026-09-05)
//
// A knock on 2026-09-05 across all 522 published URLs found 33 answering HTTP 402 and
// 160 sitting at an address that cannot ever answer one — a GitHub repo, an npm or PyPI
// package page, a Discord invite, a private Tailscale host. Those 160 were carrying the
// same `held: true` receipt as a live paid endpoint, because a knock on github.com does
// get a response. The receipt was never lying. The single word "held" was doing the work
// of two different facts, and this splits them.
//
// Derived from the URL alone, deterministically, with no probe: what shape of thing did
// we write down. `can_answer_402` is a TRI-STATE on purpose — false where the address
// makes a 402 impossible, null everywhere else. Never true, because nothing in this file
// has paid or knocked, and we do not hand a machine a positive we have not earned.
const NOT_A_DOOR = [
  [/(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)bitbucket\.org$/, 'repo'],
  [/(^|\.)npmjs\.com$|(^|\.)pypi\.org$|(^|\.)crates\.io$|(^|\.)rubygems\.org$|(^|\.)packagist\.org$|(^|\.)hub\.docker\.com$/, 'package'],
  [/(^|\.)discord\.gg$|(^|\.)discord\.com$|(^|\.)t\.me$|(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)reddit\.com$|(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)warpcast\.com$|(^|\.)substack\.com$|(^|\.)dev\.to$|(^|\.)medium\.com$|(^|\.)linkedin\.com$/, 'channel'],
  [/(^|\.)ts\.net$|(^|\.)local$|(^|\.)internal$/, 'private'],
];

function addressKind(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return 'unparseable'; }
  if (url.includes('/.well-known/x402')) return 'manifest';
  for (const [re, kind] of NOT_A_DOOR) if (re.test(host)) return kind;
  return 'web';
}

// The two acceptance rules in CONTRIBUTING.md. Same list the submission gate uses: a
// library, framework, guide or community resource has no payable endpoint and is never
// asked for a 402.
const RESOURCE_SHELVES = new Set(['learning', 'community', 'sdks', 'frameworks']);

function assay() {
  const rows = listings.map((e) => {
    const address = addressKind(e.url);
    const rule = RESOURCE_SHELVES.has(e.section) ? 'resource' : 'service';
    return {
      url: e.url,
      listing: `https://24klabs.ai/listing/${e.slug}/`,
      // "held" is the whole vocabulary of this endpoint: can this entry PROVE, with a
      // receipt on file, when it last got a response? Not "is it good". Not "is it up
      // right now". Only: is there evidence, and how old is it.
      held: !!e.last_checked,
      last_answered: e.last_checked || null,
      // Which of the two acceptance rules admitted it, and what shape of address we
      // published. Read `held` THROUGH these two: a held receipt on a `repo` address
      // means a repo page answered, and nothing more than that.
      rule,
      address,
      can_answer_402: address === 'repo' || address === 'package' || address === 'channel' || address === 'private' ? false : null,
      status: e.status || 'live',
      first_failed: e.first_failed || null,
    };
  });

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
      'held=true means we hold a dated receipt for a knock that GOT A RESPONSE on that date. ' +
      'That is all it means. It is not a delivery test — we have not paid these services and ' +
      'graded what came back — and, corrected 2026-09-05, it is NOT evidence that the thing ' +
      'speaks x402. Read it as "something was at this address on that date", never as ' +
      '"speaks the protocol" and never as "worth the money".',

    what_held_does_not_mean:
      'A knock on github.com gets a response, so a package page and a live paid endpoint earn ' +
      'the same held=true. Read `held` through `address` and `rule`. Where can_answer_402 is ' +
      'false the published URL is a repo, a package page, a chat channel or a private host, and ' +
      'no receipt on it can ever be evidence of a 402. Where it is null we simply have not ' +
      'proven it either way, and we will not claim otherwise.',

    what_held_false_means:
      'Not stale, and not dead. UNPROVEN. We will not backfill a date we cannot show a receipt ' +
      'for, so an entry with no receipt reads as no receipt. That is the honest state and we ' +
      'publish it rather than hide it.',

    total: rows.length,
    held,
    unproven: rows.length - held,
    by_rule: {
      service: rows.filter((r) => r.rule === 'service').length,
      resource: rows.filter((r) => r.rule === 'resource').length,
    },
    by_address: rows.reduce((a, r) => { a[r.address] = (a[r.address] || 0) + 1; return a; }, {}),
    address_cannot_answer_402: rows.filter((r) => r.can_answer_402 === false).length,
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
