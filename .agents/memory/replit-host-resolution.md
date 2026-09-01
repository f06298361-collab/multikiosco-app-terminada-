---
name: Replit host resolution
description: Environment-specific rule for distinguishing Replit preview hosts from real multikiosk subdomains.
---

Replit preview and deployment hosts such as `*.replit.dev` and `*.replit.app` are platform hosts, not kiosk subdomains.

**Why:** The first label of a generated Replit host can look like an arbitrary kiosk identifier and cause the client and resolver to report a false “business not found” error.

**How to apply:** Only infer a kiosk from the hostname when it is not a known Replit platform host; keep explicit `kiosk`, `kioskId`, and slug parameters authoritative.