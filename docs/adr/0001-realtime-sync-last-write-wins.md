# Real-time sync with last-write-wins conflict resolution

Lists sync in real time while Editors are online (WebSocket or SSE), with optimistic local updates so check-offs and adds feel instant. Offline changes queue locally and replay on reconnect. When two Editors edit the same Item concurrently, last-write-wins per field — no merge UI, no CRDTs. Chosen because the core job is seeing partner's additions instantly at the store; polling or manual refresh breaks that. Last-write-wins is acceptable because editors are trusted and grocery list conflicts are rare and low-stakes.

**Considered options:** Polling (rejected — too slow for in-store use), CRDTs (rejected — over-engineered for trusted small groups), manual refresh (rejected — defeats the product).
