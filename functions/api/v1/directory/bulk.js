// The whole shelf, in one licensed call. x402-gated at PRICING.bulkExport.usd ($100.00).
//
// SEAN, 2026-08-28, verbatim: "If they want to download our entire list then let's charge
// them 100.00 dollars for the entire list. I don't care if nobody buys it. That's the
// point. Search the site. Not a snatch and grab."
//
// THE PRICE IS A POSTURE, NOT A FORECAST. It is not set to clear and it is not expected
// to sell. It says the shelf is somewhere you look things up, not a table you sweep into
// a bag. Reading is never gated: /api/directory/search returns every matching entry free,
// no key, no payment, and /directory lists all of them in HTML.
//
// WHAT IS HONESTLY BEING SOLD, because the sentence has to survive being checked:
// convenience and a licence, NOT exclusivity. Every entry has a permanent page at
// /listing/<slug>, all of them are in the sitemap, and the hub links to each one — a
// determined person can assemble the names by hand for nothing. What they cannot
// assemble is this: one dated artifact carrying the knock stamps, generated at a known
// moment, under a licence that says they may use it. Nothing in this file or its
// response claims the list is otherwise unavailable, and nothing ever should.
//
// Fail-closed like every paid route here: no signature, unconfigured facilitator, or a
// settlement that does not succeed all return 402 and never the payload.

import { listings } from '../../../../src/lib/listings.js';
import { PRICING } from '../../../../src/data/phase2.config.js';
import {
  paymentRequired,
  paymentRequirements,
  challenge402,
  readPaymentPayload,
  verifyAndSettle,
  paymentResponseHeader,
} from '../../../../src/lib/x402.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type, payment-signature, x-payment',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function buildExport() {
  const entries = listings.map((e) => ({
    name: e.name,
    url: e.url,
    section: e.section,
    section_label: e.section_label,
    description: e.desc,
    // `verified` retired 2026-09-06 -- it was true of every row and told a caller
    // nothing. `last_knock` is the date the endpoint answered a 402, or null when
    // we hold no receipt. Null means we have not looked, never that it failed.
    last_knock: e.last_checked || null,
    first_listed: e.first_listed || null,
    last_checked: e.last_checked || null,
    listing: `https://24klabs.ai/listing/${e.slug}/`,
  }));

  const stamped = entries.filter((e) => e.last_checked).length;

  return {
    source: '24K Labs — gold-402',
    site: 'https://24klabs.ai',
    generated: new Date().toISOString(),
    count: entries.length,
    license: 'CC-BY-4.0',
    attribution: 'Data: gold-402 by 24K Labs (https://24klabs.ai) — attribution required.',

    // Say what the stamp means and what it does not. This is the whole product.
    what_this_is:
      'Every curated entry, as of the generated timestamp. `last_checked` is the date of ' +
      'the most recent knock we can produce a receipt for. A knock is an HTTP request that ' +
      'got an answer — it is NOT a delivery test. We have not paid these services and graded ' +
      'what came back. Read a stamp as "reachable and speaks the protocol on that date", ' +
      'never as "worth the money".',
    knock_coverage: {
      entries_with_a_dated_knock: stamped,
      entries_without: entries.length - stamped,
      note:
        'Entries without a date are not stale — they are unproven. We do not backfill a ' +
        'date we cannot show a receipt for.',
    },
    also_free: {
      search: 'https://24klabs.ai/api/directory/search?q=<text>&section=<id>',
      browse: 'https://24klabs.ai/directory',
      per_entry: 'https://24klabs.ai/listing/<slug>/',
      live_probe: 'https://24klabs.ai/api/probe?url=<url>',
      note:
        'Search and browsing are free and ungated. This route sells one licensed, dated ' +
        'artifact in a single call — convenience, not access.',
    },
    entries,
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const usd = PRICING.bulkExport.usd;

  const pr = paymentRequired({
    usd,
    resourceUrl: url.toString(),
    description: '24K Labs gold-402 — full curated shelf export, dated, licensed CC-BY-4.0',
    mimeType: 'application/json',
    payToOverride: env.X402_PAY_TO,
  });

  const payload = readPaymentPayload(request);
  if (!payload) return challenge402(pr, CORS);

  const requirements = paymentRequirements({ usd, payToOverride: env.X402_PAY_TO });
  const result = await verifyAndSettle(env, payload, requirements);
  if (!result.ok) {
    return challenge402(pr, {
      ...CORS,
      'x-402-reason': String(result.reason || 'payment_not_verified'),
    });
  }

  return new Response(JSON.stringify(buildExport(), null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'PAYMENT-RESPONSE': paymentResponseHeader(result.settlement),
      'cache-control': 'no-store',
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
