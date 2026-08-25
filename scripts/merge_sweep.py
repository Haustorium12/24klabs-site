#!/usr/bin/env python3
"""Merge knock-sweep receipts into editorial.json as `last_checked`.

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
                if key not in newest or when > newest[key]:
                    newest[key] = when
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

    for e in entries:
        # An entry can be reached by its listed url or by its baked badge_resource.
        when = newest.get(norm(e.get("url"))) or newest.get(norm(e.get("badge_resource")))
        if not when:
            unmatched += 1
            continue
        stamp = when[:10]
        prior = e.get("last_checked")
        if prior is None:
            e["last_checked"] = stamp
            set_new += 1
        elif stamp > prior:
            e["last_checked"] = stamp
            moved += 1
        else:
            kept += 1  # older sweep, never walk the date backwards

    print("entries %d | newly stamped %d | refreshed %d | left alone %d | no receipt %d"
          % (len(entries), set_new, moved, kept, unmatched))

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
