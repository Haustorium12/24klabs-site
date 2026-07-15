// Billboard piece #4 — banner submission. POST /api/v1/billboard/submit
// Self-serve upload -> bot pre-screen -> stored to the PENDING slot (status='pending'), awaiting
// Sean's review. NEVER shows until moderate.js approves it; the live banner (if any) keeps
// showing while the pending one waits. A swap inherits the REMAINING time (paid_until untouched).
//
// Requires an ACTIVE PAID slot first (pay.js). The one-change cap is enforced here on submit for
// a swap and counted on approval, so a rejected swap doesn't burn the single allowed change.
//
// Body (JSON): { slug, image (base64, no data: prefix), mime, link?, alt? }

import { PRICING } from '../../../../src/data/phase2.config.js';
import {
  getRow,
  hasDb,
  isRealListing,
  nowSec,
  screenBanner,
  notifyNewBanner,
  json,
} from '../../../../src/lib/billboard.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'body must be JSON: { slug, image, mime, link?, alt? }' }, 400, CORS);
  }

  const slug = String(body.slug || '').trim();
  if (!slug || !isRealListing(slug)) return json({ error: 'unknown listing slug' }, 404, CORS);
  if (!hasDb(env)) return json({ error: 'billboard store unavailable' }, 503, CORS);

  // Must have paid for a live slot before a banner can be submitted.
  const row = await getRow(env, slug);
  const now = nowSec();
  const paidActive = !!(row && row.paid_until && now < row.paid_until);
  if (!paidActive) {
    return json(
      { error: 'no active paid slot — pay first', pay: `/api/v1/billboard/pay?slug=${slug}&tier=billboard&months=1` },
      403,
      CORS
    );
  }

  // Bot pre-screen (mime allow-list, size, safe link, alt length).
  const screen = screenBanner({ b64: body.image, mime: body.mime, link: body.link, alt: body.alt });
  if (!screen.ok) return json({ error: screen.reason }, 400, CORS);

  // One-change cap: a SWAP (a live banner already exists) may only happen once.
  const isSwap = row.banner_b64 != null;
  if (isSwap && (row.change_count || 0) >= PRICING.billboard.allowedChanges) {
    return json({ error: `only ${PRICING.billboard.allowedChanges} banner change allowed per paid slot` }, 409, CORS);
  }

  // Store into the PENDING slot only — the live banner (if any) keeps showing until this clears.
  const clean = String(body.image).replace(/\s+/g, '');
  await env.DB.prepare(
    `UPDATE billboard SET
       pending_b64 = ?, pending_mime = ?, pending_link = ?, pending_alt = ?, pending_at = ?,
       status = CASE WHEN banner_b64 IS NOT NULL THEN status ELSE 'pending' END,
       updated_at = ?
     WHERE slug = ?`
  )
    .bind(
      clean,
      String(body.mime).toLowerCase(),
      body.link ? String(body.link) : null,
      body.alt ? String(body.alt) : null,
      now,
      now,
      slug
    )
    .run();

  // Alert Sean a banner needs review (best-effort; never blocks the response).
  context.waitUntil(
    notifyNewBanner(env, { slug, tier: row.tier, link: body.link, alt: body.alt })
  );

  return json(
    {
      ok: true,
      slug,
      status: 'pending',
      swap: isSwap,
      message: isSwap
        ? 'Banner submitted for review. Your current banner keeps showing until this one is approved; the new one inherits your remaining time.'
        : 'Banner submitted for review. It will show on your listing once approved.',
    },
    202,
    CORS
  );
}
