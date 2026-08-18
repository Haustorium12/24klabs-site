// Free public probe — the door check, made callable by anyone.
// GET /api/probe?url=<url-encoded> -> JSON
//
// This is the LIVENESS + PROTOCOL check the gold-402 maintainers run before listing
// anything: one unpaid request to the endpoint, plus a look at the origin's
// /.well-known/x402 manifest. It reports what it saw and cross-references the curated
// list. It NEVER spends money and it does NOT verify delivery — a valid 402 proves the
// door works, not that the service is any good. That distinction is the whole product.
//
// Deliberately free and unauthenticated: it is useful to a stranger who has never heard
// of 24K Labs, which is the point. The paid aggregation lookup lives at /api/v1/verify.
//
// Sibling of the gold402_check_endpoint MCP tool — same checks, human-facing surface.

import { byResource } from '../../src/lib/listings.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const TIMEOUT_MS = 12000;
const MAX_BODY = 64 * 1024;
const UA = '24klabs-probe/1.0 (+https://24klabs.ai/verify)';

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
}

// This endpoint makes outbound requests on behalf of anonymous callers, so it is an
// SSRF surface. Refuse anything that could reach infrastructure rather than the
// public internet: non-https schemes, credentials in the URL, non-standard ports,
// and hostnames that resolve to private/loopback/link-local space by literal form.
const BLOCKED_HOST = [
  /^localhost$/i,
  /\.localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /\.internal$/i,
  /\.local$/i,
  /^metadata\./i,
];

function guard(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { error: 'That is not a valid URL. Include the scheme, e.g. https://api.example.com/quote' };
  }
  if (u.protocol !== 'https:') {
    return {
      error:
        u.protocol === 'http:'
          ? 'Only https is probed here. Payment headers over plaintext http are not safe to exercise.'
          : `Unsupported scheme "${u.protocol}". Use https.`,
    };
  }
  if (u.username || u.password) return { error: 'URLs with embedded credentials are not probed.' };
  if (u.port && u.port !== '443') return { error: 'Only the standard https port is probed.' };
  const host = u.hostname;
  if (BLOCKED_HOST.some((re) => re.test(host))) {
    return { error: 'That host is not on the public internet, so there is nothing here to verify.' };
  }
  return { url: u };
}

async function fetchCapped(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: '*/*', ...(init.headers || {}) },
    });
    const buf = await resp.arrayBuffer();
    const text = new TextDecoder().decode(buf.slice(0, MAX_BODY));
    return { ok: true, status: resp.status, headers: resp.headers, text };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? `No response within ${TIMEOUT_MS / 1000}s` : String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

// x402 v2 allows an empty body with the challenge base64-encoded in PAYMENT-REQUIRED.
// A checker that only reads the body grades those endpoints as broken. They are not.
function decodeChallenge(text, headers) {
  try {
    const body = JSON.parse(text);
    if (body && typeof body === 'object' && (body.accepts || body.x402Version)) {
      return { challenge: body, where: 'body' };
    }
  } catch {
    /* not json */
  }
  const hdr = headers.get('payment-required') || headers.get('www-authenticate');
  if (hdr) {
    try {
      const pad = hdr + '='.repeat((4 - (hdr.length % 4)) % 4);
      const decoded = JSON.parse(atob(pad));
      if (decoded && decoded.accepts) return { challenge: decoded, where: 'header' };
    } catch {
      /* opaque header */
    }
    return { challenge: null, where: 'header-opaque' };
  }
  return { challenge: null, where: null };
}

export async function onRequestGet(context) {
  const raw = new URL(context.request.url).searchParams.get('url') || '';
  if (!raw.trim()) return json({ error: 'Pass ?url= the endpoint you want probed.' }, 400);

  const g = guard(raw.trim());
  if (g.error) return json({ error: g.error }, 400);
  const target = g.url;

  const out = {
    url: target.href,
    checked_at: new Date().toISOString(),
    reachable: false,
    status: null,
    is_402: false,
    challenge_location: null,
    payment_terms: null,
    manifest: null,
    notes: [],
    gold402_listed: null,
  };

  const r = await fetchCapped(target.href);
  if (!r.ok) {
    out.notes.push(r.error);
  } else {
    out.reachable = true;
    out.status = r.status;
    out.is_402 = r.status === 402;
    const { challenge, where } = decodeChallenge(r.text, r.headers);
    out.challenge_location = where;
    if (challenge) {
      const a = (challenge.accepts && challenge.accepts[0]) || {};
      out.payment_terms = {
        x402Version: challenge.x402Version ?? null,
        scheme: a.scheme ?? null,
        network: a.network ?? null,
        price: a.price ?? a.maxAmountRequired ?? a.amount ?? null,
        payTo: a.payTo ?? null,
        asset: a.asset ?? null,
      };
      if (where === 'header') {
        out.notes.push(
          'Challenge carried in the PAYMENT-REQUIRED header with an empty body — spec-valid for x402 v2, decoded here.'
        );
      }
      if (!a.payTo) out.notes.push('402 returned but no payTo in the challenge — an agent cannot pay this.');
    } else if (out.is_402 && where === 'header-opaque') {
      out.notes.push('402 with a PAYMENT-REQUIRED header this probe could not decode.');
    } else if (out.is_402) {
      out.notes.push('402 returned but no challenge found in body or headers — an agent has no way to pay this.');
    }
  }

  const m = await fetchCapped(`${target.origin}/.well-known/x402`);
  if (m.ok && m.status === 200) {
    let resources = null;
    try {
      const doc = JSON.parse(m.text);
      resources = (doc.resources || doc.endpoints || []).length;
    } catch {
      /* 200 but not json */
    }
    out.manifest = { url: `${target.origin}/.well-known/x402`, status: 200, resources };
  } else {
    out.manifest = { url: `${target.origin}/.well-known/x402`, status: m.ok ? m.status : null };
  }

  if (!out.reachable) {
    out.verdict = 'NO ANSWER';
    out.verdict_detail = 'The endpoint did not respond.';
  } else if (out.status >= 500) {
    out.verdict = 'ORIGIN DOWN';
    out.verdict_detail = `HTTP ${out.status}. The host answered but the service behind it did not — usually a deploy window or a dead origin.`;
  } else if (out.is_402 && out.payment_terms && out.payment_terms.payTo) {
    out.verdict = 'LIVE 402';
    out.verdict_detail = 'Real payment challenge with usable terms. The door works.';
  } else if (out.is_402) {
    out.verdict = '402 WITHOUT USABLE TERMS';
    out.verdict_detail = 'It asks for payment but does not say how to pay it.';
  } else if (out.manifest && out.manifest.status === 200) {
    out.verdict = 'NO 402 ON THIS ROUTE';
    out.verdict_detail = `HTTP ${out.status}, but the origin publishes an x402 manifest — the paid route is probably elsewhere.`;
  } else {
    out.verdict = 'NOT AN x402 ENDPOINT';
    out.verdict_detail = `Answered HTTP ${out.status}, with no payment challenge and no manifest found.`;
  }

  try {
    const entry = byResource(target.href) || byResource(target.origin);
    out.gold402_listed = entry
      ? { listed: true, name: entry.name, section: entry.section_label || entry.section || null }
      : { listed: false };
  } catch {
    out.gold402_listed = null;
  }

  out.disclaimer =
    'A valid 402 proves the door works. It does not prove the service delivers what it advertises. Absence from the gold-402 list is not a verdict against a service — it is a curated list, not a census.';

  return json(out, 200, { 'cache-control': 'public, max-age=30' });
}
