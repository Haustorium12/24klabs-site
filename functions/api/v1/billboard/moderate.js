// Billboard piece #4 — moderation API. Sean's ONE human touchpoint.
// Token-gated (BILLBOARD_ADMIN_TOKEN on the Pages project). FAIL-CLOSED: no token configured or
// a wrong token -> 401, nothing readable or actionable.
//
//   GET  /api/v1/billboard/moderate?token=...            -> list banners pending review
//   POST /api/v1/billboard/moderate?token=...            body { slug, action:'approve'|'reject', reason? }
//
// Approve promotes pending_* -> live banner_* and counts a swap against the one-change cap.
// Reject clears the pending banner and falls back to whatever was already live.

import {
  checkAdmin,
  adminConfigured,
  listPending,
  approveBanner,
  rejectBanner,
  bannerImageUrl,
  json,
} from '../../../../src/lib/billboard.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// Token may arrive as ?token= or Authorization: Bearer <token>.
function readToken(request, url) {
  const q = url.searchParams.get('token');
  if (q) return q;
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!adminConfigured(env)) return json({ error: 'moderation not configured' }, 503, CORS);
  if (!checkAdmin(env, readToken(request, url))) return json({ error: 'unauthorized' }, 401, CORS);

  const pending = await listPending(env);
  return json(
    {
      ok: true,
      count: pending.length,
      pending: pending.map((r) => ({
        slug: r.slug,
        tier: r.tier,
        pending_at: r.pending_at,
        has_live: !!r.has_live,
        change_count: r.change_count,
        link: r.pending_link,
        alt: r.pending_alt,
        image: bannerImageUrl(r.pending_mime, r.pending_b64),
      })),
    },
    200,
    CORS
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!adminConfigured(env)) return json({ error: 'moderation not configured' }, 503, CORS);
  if (!checkAdmin(env, readToken(request, url))) return json({ error: 'unauthorized' }, 401, CORS);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'body must be JSON: { slug, action, reason? }' }, 400, CORS);
  }
  const slug = String(body.slug || '').trim();
  const action = String(body.action || '').toLowerCase();
  if (!slug) return json({ error: 'slug is required' }, 400, CORS);

  let result;
  if (action === 'approve') result = await approveBanner(env, slug);
  else if (action === 'reject') result = await rejectBanner(env, slug, body.reason);
  else return json({ error: "action must be 'approve' or 'reject'" }, 400, CORS);

  return json(result, result.ok ? 200 : 404, CORS);
}
