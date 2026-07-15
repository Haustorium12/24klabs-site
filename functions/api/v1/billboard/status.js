// Billboard piece #4 — PUBLIC read. GET /api/v1/billboard/status?slug=<slug>
// Called client-side by the snapshot page to hydrate the billboard slot. Returns the LIVE
// (approved + still-paid) banner, or an "available" state. Never serves a pending/unapproved
// banner. Fails soft: no DB binding / no row / expired -> { active:false } (the page keeps its
// "advertise here" placeholder). Read-time paid_until check IS the expiry authority.

import { getRow, nowSec, bannerImageUrl, json } from '../../../../src/lib/billboard.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const slug = (new URL(request.url).searchParams.get('slug') || '').trim();
  if (!slug) return json({ error: 'slug is required' }, 400, CORS);

  const row = await getRow(env, slug);
  const now = nowSec();

  // Live = an approved banner exists AND the meter has not lapsed.
  const active = !!(row && row.banner_b64 && row.paid_until && now < row.paid_until);
  if (!active) {
    return json({ active: false, slug }, 200, { ...CORS, 'cache-control': 'public, max-age=60' });
  }

  return json(
    {
      active: true,
      slug,
      tier: row.tier,
      paid_until: row.paid_until,
      banner: {
        image: bannerImageUrl(row.banner_mime, row.banner_b64),
        link: row.banner_link || null,
        alt: row.banner_alt || null,
      },
    },
    200,
    { ...CORS, 'cache-control': 'public, max-age=60' }
  );
}
