---
layout: ../../layouts/ArticleLayout.astro
title: "Three-Quarters of the x402 Bazaar Is Dead"
badge: "Verification Report"
meta: "24K Labs · July 2026 · 22,545 endpoints probed"
---


> 24K Labs Verification Report — July 2026 · Run date July 1 · 22,545 endpoints probed

**74% of the services listed in the CDP Bazaar do not answer.**

| Status | Count | Share |
|---|---|---|
| Verified live | 5,792 | 25.7% |
| Failed | 16,686 | 74.0% |
| Timeout | 67 | 0.3% |
| **Probed** | **22,545** | |

**Method.** One HTTP GET per endpoint, 10-second timeout. Pass = HTTP 402 with a well-formed payment header. Fail = anything else, including DNS failure and connection refused. Two consecutive failures delists. **We did not pay** — this is a liveness probe, not a purchase. Reproducible from that description.

**This is not a criticism of x402.** It's what any open listing ecosystem looks like at speed. Developers ship, pivot, and take things down; the Bazaar records everything ever listed and cannot tell you what runs today. That gap is what gold-402 exists to close.

**What's alive.** The 5,792 verified services average $0.51 per call, with most clustered between $0.001 and $0.05. Developer tooling dominates — 2,170 of the live set — which skews toward production infrastructure that stays up.

**Later measurements moved.** A 2026-07-10 catalog snapshot put the dead share at 79% of 25,614 services; a later crawl of 24,583 put it near 67%. Different days, different methods, same direction. Anyone quoting a single figure for this — including us — is quoting a moment. See [The Liveness Law](2026-07-the-liveness-law.md) for what the spread across registries actually predicts.

**In one sentence:** a listing is not a service, and the only way to know the difference is to check.

_— 24K Labs_
