// Phase 2 config — FOUNDING DEFAULTS, editable. Prices and copy live here so Sean can tune
// them later without touching logic. Nothing secret belongs in this file: it is bundled into
// both the static site and the Pages Functions. Secrets (facilitator/CDP creds, admin token,
// GitHub notify token) come from environment bindings only — see the *_ENV notes below.

// --- x402 payment rail (Base L2 mainnet, USDC, exact scheme) --------------------------------
// payTo is the 24K Labs receiver (public, does not need to be funded). Verified in the x402
// skill. Override at the edge with the X402_PAY_TO binding if the treasury address changes.
export const X402 = {
  version: 2,
  scheme: 'exact',
  network: 'eip155:8453',                                   // Base mainnet
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',      // USDC, 6 decimals
  assetName: 'USD Coin',
  assetVersion: '2',
  usdcDecimals: 6,
  payTo: '0xe73D86f185bE79a33b0318d881B71f2a24371114',
  maxTimeoutSeconds: 120,
  // Facilitator is required to VERIFY + SETTLE a payment. Without it the gated endpoints fail
  // closed (402), never serving paid data unverified. Set via env: FACILITATOR_URL (+ CDP
  // creds CDP_API_KEY_ID / CDP_API_KEY_SECRET for the production CDP facilitator).
  facilitatorUrlDefault: 'https://api.cdp.coinbase.com/platform/v2/x402',
};

// Convert a USD price to atomic USDC units (string), e.g. 0.001 -> "1000".
export function usdToAtomic(usd) {
  return String(Math.round(usd * 10 ** X402.usdcDecimals));
}

// --- Pricing (editable founding defaults) ---------------------------------------------------
export const PRICING = {
  // On-demand aggregation line — the $0.001 agent lookup (used by functions/api/v1/verify.js).
  verifyApi: { usd: 0.001 },
};
// (The billboard pay-rail config + banner-moderation constraints were removed with the billboard.)
