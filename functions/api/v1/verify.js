// Piece 3 — on-demand aggregation endpoint. The agent verdict line.
// GET /api/v1/verify?resource=<url-encoded> -> JSON verdict + aggregated rater grades.
//
// This is the truth-layer LOOKUP nobody else offers: our verdict PLUS independent rater
// grades in one call. AGGREGATION ONLY — it reads the live curated list; it does NOT probe
// the endpoint (that is a deliberate lane we stay out of). "Always current" = it reflects
// whatever is on the list at request time, and grades are fetched live from the rater.
//
// x402-gated; the price is PRICING.verifyApi.usd in src/data/phase2.config.js — $2.00 as of
// 2026-08-21 (was $0.001; reasoning recorded at the constant). FAIL-CLOSED: if the
// facilitator/keys are not configured, or verify/settle does not succeed, it returns 402 and
// never serves the paid JSON. A caller with no PAYMENT-SIGNATURE always gets the 402 challenge.

import { byResource } from '../../../src/lib/listings.js';
import { ratersFor, fetchFuchssGrade } from '../../../src/lib/raters.js';
import { PRICING } from '../../../src/data/phase2.config.js';
import {
  paymentRequired,
  paymentRequirements,
  challenge402,
  readPaymentPayload,
  verifyAndSettle,
  paymentResponseHeader,
} from '../../../src/lib/x402.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'PAYMENT-SIGNATURE, X-PAYMENT, content-type',
  'access-control-expose-headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// Resolve a resource param to a listing. The param arrives already once-decoded by
// searchParams; try that form first, then one lenient extra decode for legacy
// double-encoded callers (throw-safe — malformed escapes resolve to no match).
function resolveResource(resource) {
  let entry = byResource(resource);
  if (!entry) {
    try {
      const extra = decodeURIComponent(resource);
      if (extra !== resource) entry = byResource(extra);
    } catch {
      /* no match */
    }
  }
  return entry;
}

// Build the verdict payload for a resource. Pure lookup + best-effort live rater grades.
async function buildVerdict(resource) {
  const entry = resolveResource(resource);
  if (!entry) {
    return {
      resource,
      verdict: 'not-listed',
      verified: false,
      summary: 'Not on the 24K Labs curated list.',
      raters: [],
      source: '24K Labs — the truth layer for the x402 ecosystem',
    };
  }
  const raters = ratersFor(entry);
  const grades = await Promise.all(
    raters.map(async (r) => {
      const parsed = await fetchFuchssGrade(r.badgeUrl);
      return {
        rater: r.label,
        grade: (parsed && parsed.grade) || null,
        score: (parsed && parsed.score) != null ? parsed.score : null,
        badge: r.badgeUrl,
      };
    })
  );
  return {
    resource,
    verdict: 'verified',
    verified: true,
    name: entry.name,
    endpoint: entry.badge_resource || entry.url || null,
    category: entry.category || null,
    type: entry.type || null,
    summary: entry.desc || `${entry.name} is Gold402 Verified.`,
    listingUrl: `https://24klabs.ai/listing/${entry.slug}`,
    raters: grades,
    source: '24K Labs — the truth layer for the x402 ecosystem',
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const resource = (url.searchParams.get('resource') || '').trim();

  if (!resource) {
    return new Response(JSON.stringify({ error: 'resource query parameter is required' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
    });
  }

  const usd = PRICING.verifyApi.usd;
  const pr = paymentRequired({
    usd,
    resourceUrl: url.toString(),
    description: '24K Labs verify — verdict + aggregated rater grades for an x402 resource',
    mimeType: 'application/json',
    payToOverride: env.X402_PAY_TO,
  });

  // No signed payment -> 402 challenge (agents read PAYMENT-REQUIRED; humans see the JSON body).
  const payload = readPaymentPayload(request);
  if (!payload) {
    return challenge402(pr, CORS);
  }

  // Verify + settle at the facilitator. Fail-closed on any error / non-success.
  const requirements = paymentRequirements({ usd, payToOverride: env.X402_PAY_TO });
  const result = await verifyAndSettle(env, payload, requirements);
  if (!result.ok) {
    return challenge402(pr, { ...CORS, 'x-402-reason': String(result.reason || 'payment_not_verified') });
  }

  // Paid -> serve the verdict, echo the settlement in PAYMENT-RESPONSE.
  const body = await buildVerdict(resource);
  return new Response(JSON.stringify(body, null, 2), {
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
