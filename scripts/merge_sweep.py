#!/usr/bin/env python3
"""Merge knock-sweep receipts into editorial.json: `last_checked` + the graveyard clock.

WHY THIS EXISTS
---------------
The directory card says "Gold402 Verified" and gives no date, so a reader has no
way to tell a service we knocked this morning from one we knocked in April.
`last_checked` is the date of the most recent knock we can actually produce a
receipt for. It is the honest half of the badge.

WHAT IT IS NOT
--------------
It is NOT a delivery verification and it must never be labelled as one. A knock
is an HTTP request that got an answer. Whether the service delivers something
worth the money after payment is a different test, and we do not run it at
population scale yet.

INPUT
-----
One or more sweep JSONL files. Each line needs at minimum:
    {"checked_at": "<ISO8601>", "url": "<the url knocked>"}
Extra fields (status, class, latency_ms, name, shelf) are ignored here — they
live in the sweep receipt, which stays the source of truth.

RULE: newest wins. A URL knocked twice keeps the later `checked_at`. An existing
`last_checked` in editorial.json is never moved BACKWARDS by an older sweep.

THE GRAVEYARD CLOCK (added 2026-08-28, implements specs/GRAVEYARD_v0.1.md step 1:
"add the three fields, gate first_failed against overwrite, instrument before page")
-------------------------------------------------------------------------------
`last_checked` NOW ONLY MOVES ON A KNOCK THAT ANSWERED. That is a correction, not a
feature: before this, ANY receipt stamped the date, so a service that timed out three
nights running would read "Checked today" on its card while being unreachable. The
card copy says every entry answered a live probe. It has to be true of the field the
card renders.

We do not guess which classes count. `knock.py` already decides, per
specs/KNOCK_PROTOCOL_v0.1.md, and every receipt row carries `strike`:

    strike=false  answered   alive, payable, unpayable, challenge, moved,
                             rate_limited, unchanged   -> stamps last_checked
    strike=true   failed     dead, timeout, refused, tunnel_down, server_error,
                             error, other               -> starts/keeps first_failed

Note what is deliberately NOT a strike: a Cloudflare bot wall is a stranger saying no,
a 429 is our fault for knocking too fast, and a 405 is a POST-only surface answering
correctly -- that last one struck four healthy MCP servers on the first full run before
the classifier was fixed. Re-deriving this table here would be a second opinion that
drifts from the first. One knock is evidence, never a verdict.

Fields written:
    first_failed  ISO date of the FIRST failure in the current run of failures.
                  THE BADGE CLOCK -- "No answer for N days" counts from here, not
                  from the day we moved the entry. Cleared by any answer.
    status        "live" | "graveyard"
    returned      ISO date a graveyard entry answered again

Promotion to the graveyard is the existing two-strike rule, unchanged: a failure on a
LATER DATE than an already-recorded first_failed, or `class == "dead"` (no DNS), which
the protocol allows as the single-knock verdict. Two failures inside one sweep file are
one day, not two, and are guarded against.

Resurrection is automatic and unconditional. Any answer returns an entry to the live
shelf, stamps `returned`, and clears the clock. Per the spec that clause is
load-bearing: without it the line in the sand reads as a grudge.

USAGE
-----
    python3 scripts/merge_sweep.py ../bus/audits/sweep/2026-08-21_full.jsonl [more.jsonl ...]
    python3 scripts/merge_sweep.py --dry-run <files>
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EDITORIAL = os.path.join(HERE, "..", "src", "data", "editorial.json")


def norm(u):
    """Mirror listings.js normalizeUrl so the site and this script agree."""
    if not u:
        return ""
    return str(u).strip().lower().replace("https://", "").replace("http://", "").rstrip("/")


def load_sweeps(paths):
    newest = {}
    bad = 0
    for p in paths:
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    bad += 1
                    continue
                url, when = row.get("url"), row.get("checked_at")
                if not url or not when:
                    bad += 1
                    continue
                key = norm(url)
                # Carry the verdict fields with the timestamp. `strike` is decided by
                # knock.py's classifier and is NEVER re-derived here -- a second opinion
                # would drift from the first, and this one has already been corrected
                # once (405 struck four healthy MCP servers on 2026-08-21).
                # A row missing `strike` is treated as a FAILURE, not an answer: the
                # pre-2026-08-28 receipts predate the field, and defaulting the unknown
                # to "it answered" is how a dead entry keeps a fresh-looking stamp.
                rec = {
                    "checked_at": when,
                    "strike": bool(row.get("strike", True)),
                    "class": row.get("class") or "unknown",
                }
                if key not in newest or when > newest[key]["checked_at"]:
                    newest[key] = rec
    return newest, bad


def main(argv):
    dry = "--dry-run" in argv
    paths = [a for a in argv[1:] if not a.startswith("--")]
    if not paths:
        print(__doc__)
        return 2

    newest, bad = load_sweeps(paths)
    print("sweep receipts: %d unique URLs (%d unparseable lines skipped)" % (len(newest), bad))

    entries = json.load(open(EDITORIAL, encoding="utf-8"))
    set_new = moved = kept = unmatched = 0
    buried = resurrected = clock_started = clock_cleared = 0

    for e in entries:
        # Every entry carries a status. Backfilled to "live" -- nothing enters the
        # graveyard retroactively, because we have no dated failure history for the
        # existing shelf and a backfilled date would be a fabricated one.
        e.setdefault("status", "live")
        e.setdefault("first_failed", None)
        e.setdefault("returned", None)

        # An entry can be reached by its listed url or by its baked badge_resource.
        rec = newest.get(norm(e.get("url"))) or newest.get(norm(e.get("badge_resource")))
        if not rec:
            unmatched += 1
            continue
        when, struck, klass = rec["checked_at"], rec["strike"], rec["class"]
        stamp = when[:10]

        if not struck:
            # ---- IT ANSWERED -------------------------------------------------
            prior = e.get("last_checked")
            if prior is None:
                e["last_checked"] = stamp
                set_new += 1
            elif stamp > prior:
                e["last_checked"] = stamp
                moved += 1
            else:
                kept += 1  # older sweep, never walk the date backwards

            if e.get("first_failed"):
                e["first_failed"] = None
                clock_cleared += 1
            if e["status"] == "graveyard":
                e["status"] = "live"
                e["returned"] = stamp
                resurrected += 1
            continue

        # ---- IT DID NOT ANSWER -----------------------------------------------
        # last_checked is NOT touched. It means "last answered" and a failure is
        # not an answer. This is the whole correction.
        if e["first_failed"] is None:
            e["first_failed"] = stamp        # the badge clock starts here
            clock_started += 1
        elif stamp <= e["first_failed"]:
            pass                              # same day or older: one day, not two
        elif e["status"] != "graveyard":
            e["status"] = "graveyard"         # second strike on a later date
            buried += 1

        # No DNS is the one single-knock verdict the protocol allows.
        if klass == "dead" and e["status"] != "graveyard":
            e["status"] = "graveyard"
            buried += 1

    print("entries %d | newly stamped %d | refreshed %d | left alone %d | no receipt %d"
          % (len(entries), set_new, moved, kept, unmatched))
    print("graveyard clock | started %d | cleared %d | buried %d | resurrected %d"
          % (clock_started, clock_cleared, buried, resurrected))
    if buried:
        print("NOTE: %d entries crossed the line in the sand. The badge reads "
              "\"No answer for N days\" from first_failed -- never an adjective." % buried)

    if unmatched:
        print("NOTE: %d entries carry no knock receipt and will render "
              "\"not yet re-checked\" on the site. That is correct — do not "
              "backfill a date we cannot prove." % unmatched)

    if dry:
        print("--dry-run: nothing written.")
        return 0

    with open(EDITORIAL, "w", encoding="utf-8") as fh:
        json.dump(entries, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("wrote %s" % os.path.normpath(EDITORIAL))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
