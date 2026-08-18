---
layout: ../../layouts/ArticleLayout.astro
title: "The Liveness Law"
badge: "Editorial"
meta: "24K Labs · July 2026"
---

> 24K Findings · Four registries, 204,500 registered agents and services measured.

**The cheaper it is to get listed, the more of that registry is dead.**

| Registry | Cost to list | Dead |
|---|---|---|
| ERC-8004 on-chain identity | gas only | 85–97% |
| CDP Bazaar | free | 67–79% |
| Glama MCP registry | curation + scoring | 47% unhealthy _(their own figure)_ |

Sort by entry cost and they line up. Free entry selects for abandonment.

We probed CDP Bazaar three times across July rather than once, because one number
for a moving population is a moment, not a fact: 22,545 services at 74% dead, then
25,614 at 79%, then 24,583 at ~67%. Three runs, one direction.

**What counted as alive:** a valid HTTP 402 challenge, or a served x402 manifest.
Not a 200. A 200 from a marketing page is the most common way a dead service looks
alive, and any count that accepts it is measuring DNS, not commerce.

---

## Two details worth the ink

Of fifteen endpoints listed in registries' **own machine-readable discovery feeds** —
the interfaces built for agents, not humans — **eight returned 404 at the advertised
path.** The surface designed for machines was wrong more often than not.

And every headline registry count you will read is working software and abandoned
software added together, presented as one number.

---

## Buying is harder than finding

In July we bought services off our own shelf to confirm delivery: **16** of 126 were
purchasable by a machine at a discoverable address, **8** delivered exactly what they
advertised, **0** took payment and returned nothing. $0.054 spent, every transaction
reconciled on-chain.

The interesting number is the first one. Almost nothing failed *after* payment — a
machine could not get as far as paying, for want of a findable address or a documented
request shape. **The friction in this economy sits before the payment, not after it.**
Most services are fine. Most front doors are not.

---

## What we cannot claim

All four measurements are Western. ModelScope's MCP plaza renders as a JavaScript app
we could not enumerate; Zhihu and India's NPCI disallow crawlers and we honored that.
The mechanism is economic, so we would expect it to hold elsewhere — expecting is not
measuring. **If you can sample a non-Western registry, check us.** A refutation is
worth more to us than agreement.

## Our own position

We run a directory, and this page is an argument that directories are mostly
graveyards. It points at us too: 454 hand-checked entries, small by every number
above, and our own delivery check found most of that shelf not machine-purchasable
either. Listing with us means a maintainer probed it and it answered correctly at the
time of review, and we re-check. That is the whole claim — not an audit, not an uptime
guarantee.

**If you're building:** list somewhere free and you are shelved among the dead. Consume
a registry and presence is not evidence anything works. Probe before you spend.

---

_Method: one throttled probe per host to each advertised endpoint; 49 blocked sources
recorded as blocked rather than dropped from the denominator. Corrections by pull
request or issue._

_— 24K Labs_
