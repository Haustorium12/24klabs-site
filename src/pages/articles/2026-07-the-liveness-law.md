---
layout: ../../layouts/ArticleLayout.astro
title: "The Liveness Law"
badge: "Editorial"
meta: "24K Labs · July 2026"
---


> 24K Findings — July 2026 · Four registries, 204,500 agents and services measured.

**The cheaper it is to get listed, the more of that registry is dead.**

| Registry | Cost to list | Dead |
|---|---|---|
| ERC-8004 on-chain identity | gas only | 85–97% |
| CDP Bazaar | free | 67–79% |
| Glama MCP registry | curation + scoring | 47% unhealthy _(their own figure)_ |

Sort by entry cost and they line up. Free entry selects for abandonment.

Two details worth the ink. Of fifteen endpoints listed in registries' own machine-readable discovery feeds — the interfaces built for agents, not humans — **eight returned 404 at the advertised path.** And every headline registry count you'll read is working software and abandoned software added together.

**What we can't claim.** All four measurements are Western. ModelScope's MCP plaza renders as a JavaScript app we couldn't enumerate; Zhihu and India's NPCI disallow crawlers and we honored that. The mechanism is economic, so we'd expect it to hold elsewhere — expecting isn't measuring. **If you can sample a non-Western registry, check us.** A refutation is worth more to us than agreement.

**If you're building:** list somewhere free and you're shelved among the dead. Consume a registry and presence is not evidence anything works.

**Our own position.** We run a directory of 458 hand-checked entries — small by every number on this page, deliberately. In July we started buying services to confirm delivery: 16 purchasable, 8 delivered as advertised, 0 took money and returned nothing, $0.054 spent, every transaction reconciled on-chain. Most of our list hasn't been through that yet.

_Method: one throttled probe per host to each advertised endpoint. 49 blocked sources recorded rather than dropped. Corrections by PR or issue._

_— 24K Labs_
