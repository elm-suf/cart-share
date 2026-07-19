# 07 — Offline Caching & Reconnection Replay Queue

**What to build:** Offline resilience and automatic reconnect synchronization. The app caches list items to `localStorage` for offline loading, queues offline changes to a buffer, and replays them sequentially upon reconnecting to the server.

**Blocked by:** 06 — Drag-and-Drop Reordering via Fractional Indexing

**Status:** ready-for-agent

- [ ] PWA asset caching is configured using service workers so that the app opens and renders instantly without network access.
- [ ] Active and Checked items are stored in `localStorage`. If the app is launched offline, it renders cached data immediately.
- [ ] Offline status detection is implemented (listening for browser network changes and WebSocket connection drops).
- [ ] Offline edits (adding, checking, reordering) update the UI immediately and are appended to a sequential `syncQueue` in `localStorage`.
- [ ] When the WebSocket connection is restored, the client pops and sends the queued mutations to the server in chronological order.
- [ ] Once the queue is fully drained, the client requests the latest state from the server to merge other editors' updates.
