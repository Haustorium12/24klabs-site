-- Phase 2 billboard pay rail — schema for D1 `24k-intel` (live, id 5528e3dc-...).
-- Apply with:  wrangler d1 execute 24k-intel --remote --file=specs/phase2/billboard.sql
-- Then bind the DB to the Pages project as `DB` (Pages > Settings > Functions > D1 bindings).
--
-- Parking-meter model: a slot is paid up front for N months (NO auto-rebill). The live banner
-- and a pending (proposed) banner are stored SEPARATELY so the approved one keeps showing while
-- a swap waits for moderation. Exactly one swap is allowed (change_count vs allowedChanges).

CREATE TABLE IF NOT EXISTS billboard (
  slug            TEXT PRIMARY KEY,             -- listing slug (from src/lib/listings.js)
  resource        TEXT,                         -- canonical resource url, for reference
  tier            TEXT NOT NULL DEFAULT 'billboard',   -- 'billboard' | 'featured'
  paid_until      INTEGER NOT NULL DEFAULT 0,   -- unix seconds; slot is live while now < paid_until
  change_count    INTEGER NOT NULL DEFAULT 0,   -- approved banner swaps used (cap = allowedChanges)

  -- LIVE (approved) banner — what renders on the snapshot page while now < paid_until.
  banner_b64      TEXT,                         -- base64 image bytes (<=512KB source)
  banner_mime     TEXT,
  banner_link     TEXT,
  banner_alt      TEXT,

  -- PENDING (proposed) banner — awaiting Sean's review. Live banner keeps showing until this clears.
  pending_b64     TEXT,
  pending_mime    TEXT,
  pending_link    TEXT,
  pending_alt     TEXT,
  pending_at      INTEGER,                      -- unix seconds submitted

  status          TEXT NOT NULL DEFAULT 'paid', -- paid | pending | approved | rejected | expired
  reject_reason   TEXT,
  created_at      INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL DEFAULT 0
);

-- Immutable audit of settled payments (parking-meter feeds). One row per settlement.
CREATE TABLE IF NOT EXISTS billboard_payments (
  id          TEXT PRIMARY KEY,                 -- tx hash or settlement id (idempotency key)
  slug        TEXT NOT NULL,
  tier        TEXT NOT NULL,
  months      INTEGER NOT NULL,
  amount_usd  REAL NOT NULL,
  tx_hash     TEXT,
  paid_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billboard_status ON billboard(status);
CREATE INDEX IF NOT EXISTS idx_billboard_paid_until ON billboard(paid_until);
CREATE INDEX IF NOT EXISTS idx_billboard_payments_slug ON billboard_payments(slug);
