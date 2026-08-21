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
  // The agent lookup — our verdict + aggregated independent rater grades for one
  // x402 resource. Used by functions/api/v1/verify.js and read live by the
  // gold402-mcp `gold402_verdict` tool (which re-reads the 402 challenge, so a
  // change here propagates with no client edit).
  //
  // 2026-08-21: $0.001 -> $2.00 (Sean's call, explicit).
  //
  // HIS REASONING, RECORDED HONESTLY BECAUSE IT IS HALF RIGHT: "I want them to
  // pay for the cost of the call itself as well and then the extra is our cost."
  // The COGS half does not apply to a lookup — measured cost to us is ~$0.00,
  // because the buyer signs EIP-3009 gasless, the CDP facilitator relays and eats
  // the gas, and the full USDC lands unskimmed (Nox, from two real Base
  // settlements: verify 0x7a72…c17d2d and M1 replay 0x4796…a7f4c0, both ~86,300
  // gas @ 0.01 gwei, facilitator-paid). So this price stands on VALUE — a human
  // editorial verdict — not on cost recovery.
  //
  // Where his reasoning is exactly right is the tier that does not exist yet:
  // a DELIVERY-VERIFIED verdict, where we pay the endpoint, receive the response
  // and grade it. That carries real COGS and $2.00 covering it plus margin is the
  // correct shape. Blocked on a dedicated spend wallet.
  //
  // CONTEXT, so nobody changes this blind: the 459-entry shelf runs $0.001–$0.05.
  // apix402 charges $0.002, Forge attestation $0.02. This is deliberately far
  // above the ecosystem. Chosen revenue at $0.001 was $0.00, so price was never
  // the binding constraint — demand was. Revert is this one line.
  verifyApi: { usd: 2.00 },
};
// (The billboard pay-rail config + banner-moderation constraints were removed with the billboard.)
