// Shared x402 helpers for the site's Pages Functions (Cloudflare Workers runtime).
//
// Implements the V2 protocol handshake from the x402 skill:
//   1. no PAYMENT-SIGNATURE  -> 402 + PAYMENT-REQUIRED header (base64 PaymentRequired)
//   2. PAYMENT-SIGNATURE     -> facilitator /verify, then /settle -> 200 + PAYMENT-RESPONSE
//
// FAIL-CLOSED by design: if the facilitator cannot be reached, or verify/settle does not
// return success, the caller returns 402 and never serves the paid resource. A missing
// facilitator config therefore never leaks paid data — it just declines payment.
//
// CDP production facilitator needs a JWT Bearer built from the Secret API Key (Ed25519).
// That signer lives here (cdpAuthHeader). It is correct-by-construction against the CDP
// auth spec but has NOT been exercised against a live key from a Worker — verify attended
// once CDP_API_KEY_NAME / CDP_API_KEY_PRIVATE_KEY are set on the Pages project. Without
// those vars the endpoints fail closed rather than settling.

import { X402, usdToAtomic } from '../data/phase2.config.js';

// --- base64 (JSON <-> header value) ---------------------------------------------------------
function b64encodeJson(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function b64decodeJson(str) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch {
    return null;
  }
}

// Build a single PaymentRequirements entry (one item of the `accepts` array).
export function paymentRequirements({ usd, payToOverride }) {
  return {
    scheme: X402.scheme,
    network: X402.network,
    amount: usdToAtomic(usd),
    asset: X402.asset,
    payTo: payToOverride || X402.payTo,
    maxTimeoutSeconds: X402.maxTimeoutSeconds,
    extra: { name: X402.assetName, version: X402.assetVersion },
  };
}

// Build the PaymentRequired object served on the 402.
export function paymentRequired({ usd, resourceUrl, description, mimeType = 'application/json', payToOverride }) {
  return {
    x402Version: X402.version,
    error: 'PAYMENT-SIGNATURE header is required',
    resource: { url: resourceUrl, description, mimeType },
    accepts: [paymentRequirements({ usd, payToOverride })],
  };
}

// Return a 402 Response carrying the PAYMENT-REQUIRED header + JSON body (human/agent both work).
export function challenge402(pr, extraHeaders = {}) {
  return new Response(JSON.stringify(pr), {
    status: 402,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'PAYMENT-REQUIRED': b64encodeJson(pr),
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
      ...extraHeaders,
    },
  });
}

// Pull + decode the client's PaymentPayload from the PAYMENT-SIGNATURE header. null if absent.
export function readPaymentPayload(request) {
  const raw = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('X-PAYMENT');
  if (!raw) return null;
  return b64decodeJson(raw);
}

// --- CDP Ed25519 JWT (Bearer for the CDP x402 facilitator) ----------------------------------
// PKCS8 DER prefix for an Ed25519 private key (RFC 8410). The 32-byte seed follows.
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function b64urlFromBytes(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromJson(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function bytesFromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Build a CDP JWT for one request. Returns the token string, or null if no key is configured.
// method/host/path scope the token to the exact facilitator call (CDP `uri` claim).
export async function cdpJwt(env, method, host, path) {
  // Accept the SAME env-var names Pillar 2 (24klabs-api) already uses, so the existing CDP key
  // is reused with no new key and one naming convention. Falls back to the older *_NAME/*_PRIVATE_KEY.
  const keyId = env.CDP_API_KEY_ID || env.CDP_API_KEY_NAME;
  const secret = env.CDP_API_KEY_SECRET || env.CDP_API_KEY_PRIVATE_KEY;
  if (!keyId || !secret) return null;

  // CDP Ed25519 secret is base64 of 64 bytes (32-byte seed || 32-byte public key). Take the seed.
  const secretBytes = bytesFromB64(secret.trim());
  const seed = secretBytes.slice(0, 32);
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed, ED25519_PKCS8_PREFIX.length);

  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);

  const now = Math.floor(Date.now() / 1000);

  // Built to match the PROVEN CDP SDK byte-for-byte — verified against the installed
  // cdp.auth.utils.jwt.generate_jwt (v1.39.1) that Pillar 2's cdp_auth.py uses in production:
  //   - header carries the nonce (16 random DIGITS), alg EdDSA, kid, typ
  //   - request scope is the `uris` claim: an ARRAY holding "METHOD host/path" (NOT a singular
  //     "uri" string — the public docs mislead here; the SDK is ground truth)
  //   - aud is null (the SDK emits null when no audience is passed, which cdp_auth.py doesn't)
  //   - nonce is header-only, not in the claims
  // Any of these wrong -> CDP rejects the token -> verify/settle fail closed (402). This is the
  // one seam that was never exercised against a live key; now it mirrors the working signer exactly.
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => String(b % 10)).join('');
  const header = { alg: 'EdDSA', kid: keyId, typ: 'JWT', nonce };
  const claims = {
    sub: keyId,
    iss: 'cdp',
    aud: null,
    nbf: now,
    exp: now + 120,
    uris: [`${method} ${host}${path}`],
  };
  const signingInput = `${b64urlFromJson(header)}.${b64urlFromJson(claims)}`;
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

// Resolve the facilitator base URL from env (default CDP production).
function facilitatorBase(env) {
  return (env.FACILITATOR_URL || env.CDP_FACILITATOR_URL || X402.facilitatorUrlDefault).replace(/\/+$/, '');
}

async function facilitatorPost(env, path, body) {
  const base = facilitatorBase(env);
  const target = new URL(base + path);
  const headers = { 'content-type': 'application/json' };
  // Attach auth: explicit bearer wins; otherwise mint a CDP JWT if keys are present.
  if (env.FACILITATOR_AUTH) {
    headers['authorization'] = `Bearer ${env.FACILITATOR_AUTH}`;
  } else {
    const jwt = await cdpJwt(env, 'POST', target.host, target.pathname);
    if (jwt) headers['authorization'] = `Bearer ${jwt}`;
  }
  const res = await fetch(target.toString(), { method: 'POST', headers, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

// Verify + settle a payment against the facilitator. Returns { ok, settlement, reason }.
// FAIL-CLOSED: any error, non-2xx, or falsy validity => ok:false.
export async function verifyAndSettle(env, payload, requirements) {
  try {
    const verify = await facilitatorPost(env, '/verify', { payload, paymentRequirements: requirements });
    if (verify.status !== 200 || !verify.json || verify.json.isValid !== true) {
      return { ok: false, reason: (verify.json && verify.json.invalidReason) || `verify_failed_${verify.status}` };
    }
    const settle = await facilitatorPost(env, '/settle', { payload, paymentRequirements: requirements });
    if (settle.status !== 200 || !settle.json || settle.json.success !== true) {
      return { ok: false, reason: (settle.json && settle.json.error) || `settle_failed_${settle.status}` };
    }
    return { ok: true, settlement: settle.json };
  } catch (err) {
    return { ok: false, reason: `facilitator_unreachable: ${err && err.message}` };
  }
}

// Serialize a SettlementResponse into the PAYMENT-RESPONSE header value.
export function paymentResponseHeader(settlement) {
  return b64encodeJson(settlement || { success: true });
}
