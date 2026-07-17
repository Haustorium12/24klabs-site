# generate_editorial.py -- the directory wire.
#
# Reads gold-402 directory/*.md (the source of truth contributors merge into) and
# regenerates src/data/editorial.json (what 24klabs.ai renders). A merged PR that
# never reaches the product was the failure this replaces: the original 375-entry
# JSON was generated once in July 2026 and the producing was mistaken for a system.
#
# DESIGN RULES (work-order thread directory-wire-2026-07-16):
#   - MERGE keyed on (url, section), never a from-scratch rebuild. badge_resource
#     exists on ~28 entries ONLY in the JSON (fuchss endpoint grades); a rebuild
#     silently deletes them and the build still goes green. Structurally impossible
#     here: gate G2 fails closed if any badge_resource is dropped or changed.
#   - markdown wins:  name, desc, category, section, section_label, type
#   - derived:        verified = entry carries the 24K_Verified badge in markdown.
#     (Proven equivalence on 2026-07-17: all 40 verified=true rows were exactly the
#     badge-carrying rows once url migrations were mapped. Flips are logged loudly.)
#   - JSON wins:      badge_resource, first_listed
#   - new entries:    no badge_resource; first_listed = merge date from git history
#     (git log -S in the gold-402 checkout; Sean's rule: an entry's date is the day
#     it was merged/verified, not its PR-open date).
#   - ordering:       existing rows keep their current JSON order, new rows append
#     in markdown order. listings.js derives slugs with order-based dedup, so
#     reordering existing rows would silently change live URLs.
#   - type/section_label come from the FIXED table below. The original generator
#     singularized labels programmatically and shipped "SDKs & Librarie" /
#     "Tools & Utilitie" on 79 live listings. Never compute what you can look up.
#
# BACKPRESSURE -- the generator fails closed (exit 1, writes nothing) if:
#   G1  output entry count < current entry count
#   G2  any existing badge_resource would be dropped or changed
#   G3  any entry in the current JSON has no match in the markdown
#       (deletions are a human decision, recorded in a transition file, not a
#       script side effect)
#   G4  any entry lacks first_listed, or is dated in the future or before 2026-04-27
#   G5  any section has no row in the lookup table
#   G6  duplicate (url, section) key in the markdown (same project listed twice in
#       one file -- happened once: agent.market, fixed 2026-07-17)
#
# Usage:
#   python scripts/generate_editorial.py --gold <path-to-gold-402-checkout>
#       [--transition scripts/transition-YYYY-MM-DD.json]  (one-time migrations)
#       [--dry-run]                                        (report, write nothing)
#
# Exit codes: 0 = wrote (or no change needed), 1 = gate failure, 2 = usage error.

import argparse
import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

EM_DASH = "\u2014"  # em-dash escape: .py files stay CP1252/ASCII-safe

# Fixed lookup: filename stem -> (section_label, type). Do NOT derive these.
SECTION_TABLE = {
    "apis":         ("APIs & Services",         "API / Service"),
    "community":    ("Community",               "Community"),
    "ecosystem":    ("Ecosystem",               "Ecosystem"),
    "facilitators": ("Facilitators",            "Facilitator"),
    "frameworks":   ("Frameworks & Middleware", "Frameworks & Middleware"),
    "learning":     ("Learning Resources",      "Learning Resource"),
    "market-data":  ("Market Data",             "Market Data"),
    "mcp-servers":  ("MCP Servers",             "MCP Server"),
    "sdks":         ("SDKs & Libraries",        "SDK / Library"),
    "security":     ("Security",                "Security"),
    "tools":        ("Tools & Utilities",       "Tool / Utility"),
}

FIRST_LISTED_FLOOR = "2026-04-27"  # earliest commit touching directory/*.md

ENTRY_RE = re.compile(r"^\s*-\s+\[([^\]]+)\]\((\S+?)\)\s*(.*)$")
BADGE_RE = re.compile(r"\s*\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)")
HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
VERIFIED_BADGE = "24K_Verified"
# A list line that mentions a link but does not parse as an entry is data debt
# (e.g. an entry missing its leading [name](url) link). Warn, do not gate: the
# submission gate on gold-402 PRs is where malformed NEW entries get rejected.
SUSPICIOUS_RE = re.compile(r"^\s*-\s+.*\]\(")


def log(msg):
    # Console-safe on Windows (cp1252): never let a fancy character kill a run.
    sys.stdout.write(msg.encode("ascii", "replace").decode("ascii") + "\n")


def parse_markdown(gold_dir):
    """Parse directory/*.md into ordered entries. Returns (entries, warnings)."""
    entries = []
    warnings = []
    md_files = sorted((gold_dir / "directory").glob("*.md"))
    if not md_files:
        raise SystemExit("FATAL: no markdown files under %s/directory" % gold_dir)
    for md in md_files:
        section = md.stem
        category = None
        for lineno, line in enumerate(md.read_text(encoding="utf-8").splitlines(), 1):
            h = HEADING_RE.match(line)
            if h:
                category = h.group(1)
                continue
            m = ENTRY_RE.match(line)
            if not m:
                if SUSPICIOUS_RE.match(line):
                    warnings.append("%s:%d does not parse as an entry: %s"
                                    % (md.name, lineno, line.strip()[:80]))
                continue
            name, url, rest = m.group(1), m.group(2), m.group(3)
            verified = VERIFIED_BADGE in rest
            rest = BADGE_RE.sub("", rest).strip()
            if not rest.startswith(EM_DASH):
                warnings.append("%s:%d entry '%s' has no em-dash description"
                                % (md.name, lineno, name))
                continue
            desc = rest[len(EM_DASH):].strip()
            entries.append({
                "name": name,
                "url": url,
                "section": section,
                "category": category or "",
                "desc": desc,
                "verified": verified,
            })
    return entries, warnings


def git_first_listed(gold_dir, url):
    """Merge date = first commit whose diff adds the url to directory/*.md."""
    out = subprocess.run(
        ["git", "-C", str(gold_dir), "log", "-S", "(%s)" % url, "--reverse",
         "--format=%ad", "--date=short", "--", "directory/*.md"],
        capture_output=True, text=True, check=True,
    ).stdout.strip().splitlines()
    return out[0] if out else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gold", required=True, help="path to gold-402 checkout")
    ap.add_argument("--transition", help="one-time migration file (rebind/drop)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    gold_dir = Path(args.gold).resolve()
    site_dir = Path(__file__).resolve().parent.parent
    out_path = site_dir / "src" / "data" / "editorial.json"

    md_entries, warnings = parse_markdown(gold_dir)
    for w in warnings:
        log("WARN (data debt, not gated): " + w)

    current = json.loads(out_path.read_text(encoding="utf-8"))
    log("markdown entries: %d   current json: %d" % (len(md_entries), len(current)))

    failures = []

    # G5: every section must have a lookup row.
    for e in md_entries:
        if e["section"] not in SECTION_TABLE:
            failures.append("G5: section '%s' has no lookup-table row (%s)"
                            % (e["section"], e["url"]))

    # G6: (url, section) must be unique in the markdown.
    md_by_key = {}
    for e in md_entries:
        key = (e["url"], e["section"])
        if key in md_by_key:
            failures.append("G6: duplicate markdown entry %s in %s.md"
                            % (e["url"], e["section"]))
        md_by_key[key] = e

    # One-time transition: url/section migrations and human-decided drops.
    # Each rebind/drop cites the gold-402 commit that made the editorial change.
    # seed_first_listed covers entries whose PR merged into the repo before the
    # entry reached directory/*.md (the README strays of PRs #25/#29): their
    # date is the ORIGINAL merge, not the promotion commit.
    dropped = []
    seeds = {}
    if args.transition:
        tr = json.loads(Path(args.transition).read_text(encoding="utf-8"))
        seeds = {(s["url"], s["section"]): s["date"]
                 for s in tr.get("seed_first_listed", [])}
        rebinds = {(r["from_url"], r["from_section"]):
                   (r["to_url"], r["to_section"]) for r in tr.get("rebind", [])}
        drops = {(d["url"], d["section"]): d["reason"] for d in tr.get("drop", [])}
        kept = []
        for row in current:
            key = (row["url"], row["section"])
            if key in drops:
                dropped.append("%s [%s] -- %s" % (row["url"], row["section"], drops[key]))
                continue
            if key in rebinds:
                row = dict(row)
                row["url"], row["section"] = rebinds[key]
                # Date from the ORIGINAL merge (old url), not the url-fix commit:
                # an entry listed in April keeps its April date across a rename.
                if not row.get("first_listed"):
                    row["first_listed"] = git_first_listed(gold_dir, key[0])
            kept.append(row)
        current = kept
        for line in dropped:
            log("TRANSITION DROP: " + line)

    # G3: every current JSON row must still exist in the markdown.
    cur_by_key = {}
    for row in current:
        key = (row["url"], row["section"])
        cur_by_key[key] = row
        if key not in md_by_key:
            failures.append("G3: JSON entry not in markdown: %s [%s] '%s'"
                            % (row["url"], row["section"], row["name"]))

    if failures:
        for f in failures:
            log("GATE FAIL " + f)
        log("FAILED CLOSED: %d gate failure(s), nothing written." % len(failures))
        return 1

    # Merge. Existing rows keep JSON order (slug stability), new rows append in
    # markdown order.
    today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    merged = []
    verified_flips = []
    for row in current:
        md = md_by_key[(row["url"], row["section"])]
        label, typ = SECTION_TABLE[md["section"]]
        new_row = {
            "name": md["name"],
            "url": md["url"],
            "section": md["section"],
            "section_label": label,
            "type": typ,
            "category": md["category"],
            "desc": md["desc"],
            "verified": md["verified"],
        }
        if row.get("badge_resource"):
            new_row["badge_resource"] = row["badge_resource"]
        if row.get("first_listed"):
            new_row["first_listed"] = row["first_listed"]
        else:
            new_row["first_listed"] = git_first_listed(gold_dir, md["url"])
        if bool(row.get("verified")) != md["verified"]:
            verified_flips.append("%s [%s]: %s -> %s" % (
                md["name"], md["section"], bool(row.get("verified")), md["verified"]))
        merged.append(new_row)

    known = set((r["url"], r["section"]) for r in merged)
    added = []
    for e in md_entries:
        key = (e["url"], e["section"])
        if key in known:
            continue
        label, typ = SECTION_TABLE[e["section"]]
        first = seeds.get(key) or git_first_listed(gold_dir, e["url"])
        merged.append({
            "name": e["name"],
            "url": e["url"],
            "section": e["section"],
            "section_label": label,
            "type": typ,
            "category": e["category"],
            "desc": e["desc"],
            "verified": e["verified"],
            "first_listed": first,
        })
        added.append("%s [%s] first_listed=%s" % (e["name"], e["section"], first))

    # ---- Gates on the merged result ----
    if len(merged) < len(current):
        failures.append("G1: output %d < current %d" % (len(merged), len(current)))

    old_badges = {(r["url"], r["section"]): r["badge_resource"]
                  for r in cur_by_key.values() if r.get("badge_resource")}
    new_badges = {(r["url"], r["section"]): r.get("badge_resource") for r in merged}
    for key, val in old_badges.items():
        if new_badges.get(key) != val:
            failures.append("G2: badge_resource dropped/changed for %s [%s]" % key)

    for r in merged:
        fl = r.get("first_listed")
        if not fl or fl > today or fl < FIRST_LISTED_FLOOR:
            failures.append("G4: bad first_listed %r for %s [%s]"
                            % (fl, r["url"], r["section"]))

    if failures:
        for f in failures:
            log("GATE FAIL " + f)
        log("FAILED CLOSED: %d gate failure(s), nothing written." % len(failures))
        return 1

    # ---- Report ----
    for a in added:
        log("ADD " + a)
    for v in verified_flips:
        log("VERIFIED FLIP " + v)
    log("result: %d entries (%d kept, %d added, %d dropped by transition), "
        "%d badge_resource carried"
        % (len(merged), len(current), len(added), len(dropped), len(old_badges)))

    payload = json.dumps(merged, indent=2, ensure_ascii=False) + "\n"
    if json.loads(out_path.read_text(encoding="utf-8")) == merged:
        log("no change: editorial.json already current")
        return 0
    if args.dry_run:
        log("DRY RUN: would write %d bytes to %s" % (len(payload), out_path))
        return 0
    out_path.write_text(payload, encoding="utf-8", newline="\n")
    log("wrote %s" % out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
