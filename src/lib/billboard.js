// Billboard pay-rail helpers — shared by the billboard Pages Functions (status/pay/submit/
// moderate/expire). Runs in the Cloudflare Workers runtime; D1 binds to the Pages project as
// `DB` (Pages > Settings > Functions > D1 database bindings -> 24k-intel). Schema lives in
// specs/phase2/billboard.sql.
//
// Parking-meter model: a slot is paid up front for N months, NO auto-rebill. Read-time is the
// source of truth for "is this live" — a slot is live only while now < paid_until, so expiry is
// correct even if the housekeeping cron never runs (it just tidies the row + status).

import { PRICING, BANNER } from '../data/phase2.config.js';
import { bySlug } from './listings.js';

// A "month" for the meter = 30 days. Documented so pricing math is unambiguous.
export const MONTH_SECONDS = 30 * 24 * 60 * 60;

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// Resolve + validate a tier key against the editable config. Returns the tier object (with .key)
// or null.
export function resolveTier(key) {
  const tiers = PRICING.billboard.tiers;
  const k = String(key || 'billboard').toLowerCase();
  return tiers[k] ? { key: k, ...tiers[k] } : null;
}

// Clamp a requested month count to [minMonths, maxMonths]; null if not a positive integer.
export function clampMonths(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  const { minMonths, maxMonths } = PRICING.billboard;
  if (n < minMonths || n > maxMonths) return null;
  return n;
}

// Price (USD) for a tier x months.
export function priceUsd(tier, months) {
  return Math.round(tier.usdPerMonth * months * 1000) / 1000;
}

// Is the DB binding present? Functions fail soft (status) or closed (pay) when it isn't.
export function hasDb(env) {
  return !!(env && env.DB && typeof env.DB.prepare === 'function');
}

// Fetch the billboard row for a slug, or null. Never throws on a missing table/binding.
export async function getRow(env, slug) {
  if (!hasDb(env)) return null;
  try {
    return await env.DB.prepare('SELECT * FROM billboard WHERE slug = ?').bind(slug).first();
  } catch {
    return null;
  }
}

// A slug must correspond to a real verified listing before it can take money or a banner.
export function isRealListing(slug) {
  return !!bySlug(slug);
}

// Validate a proposed banner (bot pre-screen, BEFORE Sean's human review). Returns { ok, reason }.
// Checks: mime allow-list, decoded byte size, link is a plain http(s) url within length, alt length.
export function screenBanner({ b64, mime, link, alt }) {
  if (!b64 || typeof b64 !== 'string') return { ok: false, reason: 'image is required' };
  const clean = b64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return { ok: false, reason: 'image must be base64' };
  if (!BANNER.allowedTypes.includes(String(mime || '').toLowerCase())) {
    return { ok: false, reason: `image type must be one of ${BANNER.allowedTypes.join(', ')}` };
  }
  // base64 length -> decoded byte count.
  const pad = (clean.match(/=+$/) || [''])[0].length;
  const bytes = Math.floor((clean.length * 3) / 4) - pad;
  if (bytes > BANNER.maxBytes) {
    return { ok: false, reason: `image is ${bytes} bytes; max ${BANNER.maxBytes}` };
  }
  if (link) {
    const s = String(link);
    if (s.length > BANNER.maxLinkLength) return { ok: false, reason: 'link too long' };
    if (!/^https?:\/\/[^\s]+$/i.test(s)) return { ok: false, reason: 'link must be a plain http(s) url' };
    if (/^javascript:|^data:|^vbscript:/i.test(s)) return { ok: false, reason: 'unsafe link scheme' };
  }
  if (alt && String(alt).length > BANNER.maxAltLength) return { ok: false, reason: 'alt text too long' };
  return { ok: true };
}

// Turn a stored banner into a data URL the browser can render directly.
export function bannerImageUrl(mime, b64) {
  return mime && b64 ? `data:${mime};base64,${b64}` : null;
}

// --- admin / moderation / expiry ops (shared by moderate.js, expire.js, admin view) ---------
// Admin surface is fail-closed: if BILLBOARD_ADMIN_TOKEN is not configured on the Pages project,
// NOTHING is admissible (no moderation, no expiry sweep). A supplied token must match exactly.
export function adminConfigured(env) {
  return !!(env && env.BILLBOARD_ADMIN_TOKEN && String(env.BILLBOARD_ADMIN_TOKEN).length >= 8);
}
export function checkAdmin(env, token) {
  if (!adminConfigured(env)) return false;
  const a = String(env.BILLBOARD_ADMIN_TOKEN);
  const b = String(token || '');
  if (a.length !== b.length) return false;   // length-safe constant-ish compare
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Rows with a banner awaiting Sean's review (pending_b64 set). Newest first.
export async function listPending(env) {
  if (!hasDb(env)) return [];
  try {
    const res = await env.DB.prepare(
      `SELECT slug, resource, tier, paid_until, change_count, status, pending_at,
              pending_mime, pending_link, pending_alt, pending_b64,
              (banner_b64 IS NOT NULL) AS has_live
         FROM billboard
        WHERE pending_b64 IS NOT NULL
        ORDER BY pending_at DESC`
    ).all();
    return (res && res.results) || [];
  } catch {
    return [];
  }
}

// Approve the pending banner for a slug: promote pending_* -> live banner_*, clear pending, and
// count the swap against the one-change cap only when a live banner was already showing.
export async function approveBanner(env, slug) {
  if (!hasDb(env)) return { ok: false, reason: 'store unavailable' };
  const row = await getRow(env, slug);
  if (!row || !row.pending_b64) return { ok: false, reason: 'nothing pending for this slug' };
  const wasSwap = row.banner_b64 != null;
  await env.DB.prepare(
    `UPDATE billboard SET
       banner_b64 = pending_b64, banner_mime = pending_mime,
       banner_link = pending_link, banner_alt = pending_alt,
       pending_b64 = NULL, pending_mime = NULL, pending_link = NULL, pending_alt = NULL, pending_at = NULL,
       change_count = change_count + ?,
       status = 'approved', reject_reason = NULL, updated_at = ?
     WHERE slug = ?`
  ).bind(wasSwap ? 1 : 0, nowSec(), slug).run();
  return { ok: true, slug, swap: wasSwap };
}

// Reject the pending banner: clear pending_*, record the reason, fall back to whatever was live.
export async function rejectBanner(env, slug, reason) {
  if (!hasDb(env)) return { ok: false, reason: 'store unavailable' };
  const row = await getRow(env, slug);
  if (!row || !row.pending_b64) return { ok: false, reason: 'nothing pending for this slug' };
  const fallback = row.banner_b64 != null ? 'approved' : 'paid';
  await env.DB.prepare(
    `UPDATE billboard SET
       pending_b64 = NULL, pending_mime = NULL, pending_link = NULL, pending_alt = NULL, pending_at = NULL,
       reject_reason = ?, status = ?, updated_at = ?
     WHERE slug = ?`
  ).bind(String(reason || 'rejected by review').slice(0, 240), fallback, nowSec(), slug).run();
  return { ok: true, slug };
}

// Housekeeping: demote every slot whose meter has lapsed. Read-time (status.js) already hides a
// lapsed banner, so this only tidies the row + status. Returns how many were demoted.
export async function expireLapsed(env) {
  if (!hasDb(env)) return { ok: false, reason: 'store unavailable', demoted: 0 };
  try {
    const res = await env.DB.prepare(
      `UPDATE billboard SET status = 'expired', updated_at = ?
         WHERE paid_until > 0 AND paid_until < ? AND status != 'expired'`
    ).bind(nowSec(), nowSec()).run();
    return { ok: true, demoted: (res.meta && res.meta.changes) || 0 };
  } catch (err) {
    return { ok: false, reason: String(err && err.message), demoted: 0 };
  }
}

// Best-effort: open a GitHub issue so Sean sees a new banner needs review (the deploy-alarm
// pattern). Fire-and-forget; never blocks or fails the submit. No-op unless notify env is set.
export async function notifyNewBanner(env, { slug, tier, link, alt }) {
  const token = env && env.GITHUB_NOTIFY_TOKEN;
  const repo = env && env.GITHUB_NOTIFY_REPO;   // e.g. "Haustorium12/messageboard"
  if (!token || !repo) return;
  try {
    await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': '24klabs-billboard',
      },
      body: JSON.stringify({
        title: `Billboard review: ${slug}`,
        body: `A new billboard banner is pending review on **/listing/${slug}**.\n\n`
          + `- tier: \`${tier || 'billboard'}\`\n- link: ${link || '(none)'}\n- alt: ${alt || '(none)'}\n\n`
          + `Approve/reject via the admin view (\`/admin/billboard?token=...\`) or the moderate endpoint.`,
        labels: ['billboard'],
      }),
    });
  } catch { /* notification is best-effort */ }
}

// Uniform JSON response with permissive CORS (agents call these cross-origin).
export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}
