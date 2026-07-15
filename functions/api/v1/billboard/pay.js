// Billboard piece #4 — THE MONEY. GET /api/v1/billboard/pay?slug=<slug>&tier=<billboard|featured>&months=<1-12>
// x402-gated. No PAYMENT-SIGNATURE -> 402 challenge priced tier x months. With a signed payment ->
// facilitator verify+settle (fail-closed), then EXTEND the parking meter: paid_until = max(now,
// current paid_until) + months*30d. NO auto-rebill. Idempotent on the settlement tx hash so a
// client retry of an already-settled payment can't double-extend.
//
// This only takes money for a REAL verified listing. The banner itself is submitted separately
// (submit.js) and shows nothing until Sean approves it (moderate.js).

import {
  paymentRequired,
  paymentRequirements,
  challenge402,
  readPaymentPayload,
  verifyAndSettle,
  paymentResponseHeader,
} from '../../../../src/lib/x402.js';
import {
  resolveTier,
  clampMonths,
  priceUsd,
  hasDb,
  isRealListing,
  MONTH_SECONDS,
  nowSec,
  json,
} from '../../../../src/lib/billboard.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'PAYMENT-SIGNATURE, X-PAYMENT, content-type',
  'access-control-expose-headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function handle(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  const tier = resolveTier(url.searchParams.get('tier'));
  const months = clampMonths(url.searchParams.get('months') || '1');

  if (!slug || !isRealListing(slug)) return json({ error: 'unknown listing slug' }, 404, CORS);
  if (!tier) return json({ error: 'unknown tier' }, 400, CORS);
  if (!months) return json({ error: 'months must be 1-12' }, 400, CORS);
  // Fail closed: no store = we can't record the purchase, so we must not take payment.
  if (!hasDb(env)) return json({ error: 'billboard store unavailable' }, 503, CORS);

  const usd = priceUsd(tier, months);
  const description = `24K Labs billboard — ${tier.label} slot on /listing/${slug}, ${months} month(s)`;
  const pr = paymentRequired({
    usd,
    resourceUrl: url.toString(),
    description,
    mimeType: 'application/json',
    payToOverride: env.X402_PAY_TO,
  });

  const payload = readPaymentPayload(request);
  if (!payload) return challenge402(pr, CORS);

  const requirements = paymentRequirements({ usd, payToOverride: env.X402_PAY_TO });
  const result = await verifyAndSettle(env, payload, requirements);
  if (!result.ok) {
    return challenge402(pr, { ...CORS, 'x-402-reason': String(result.reason || 'payment_not_verified') });
  }

  // Settled. Record idempotently, then extend the meter only if this is a NEW payment.
  const s = result.settlement || {};
  const txId = s.txHash || s.transaction || (payload.payload && payload.payload.authorization && payload.payload.authorization.nonce) || `${slug}:${nowSec()}`;
  const now = nowSec();

  const ins = await env.DB.prepare(
    `INSERT OR IGNORE INTO billboard_payments (id, slug, tier, months, amount_usd, tx_hash, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(txId, slug, tier.key, months, usd, s.txHash || null, now).run();

  const isNewPayment = ins.meta && ins.meta.changes > 0;

  if (isNewPayment) {
    // Upsert the slot: extend from the later of now / existing paid_until (stacking, never resets).
    await env.DB.prepare(
      `INSERT INTO billboard (slug, resource, tier, paid_until, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'paid', ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         tier = excluded.tier,
         paid_until = MAX(billboard.paid_until, ?) + ?,
         status = CASE WHEN billboard.banner_b64 IS NOT NULL THEN 'approved' ELSE 'paid' END,
         updated_at = excluded.updated_at`
    )
      .bind(slug, url.searchParams.get('resource') || null, tier.key, now + months * MONTH_SECONDS, now, now, now, months * MONTH_SECONDS)
      .run();
  }

  const row = await env.DB.prepare('SELECT paid_until FROM billboard WHERE slug = ?').bind(slug).first();

  return json(
    {
      ok: true,
      slug,
      tier: tier.key,
      months,
      amount_usd: usd,
      paid_until: row ? row.paid_until : now + months * MONTH_SECONDS,
      idempotent_replay: !isNewPayment,
      next: `POST /api/v1/billboard/submit to upload your banner (goes to review before it shows).`,
    },
    200,
    { ...CORS, 'PAYMENT-RESPONSE': paymentResponseHeader(result.settlement) }
  );
}

export const onRequestGet = handle;
export const onRequestPost = handle;
