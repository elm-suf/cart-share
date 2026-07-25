# 04 — WebSocket Server & Real-time Room Sync

**What to build:** WebSocket server integration and list channel connection. When an Editor opens a list view, the client establishes a persistent WebSocket connection, joins a room associated with the list's `shareToken`, and receives a subscription acknowledgement with the initial list state.

**Blocked by:** 03 — Client List Registry, Nickname Prompt & Dashboard

**Status:** completed

- [x] Express server starts a WebSocket server (using the `ws` package) alongside the HTTP server.
- [x] Client connects to the WebSocket server on mounting `/list/:shareToken`.
- [x] Server handles list room partitioning: when a client connects, they send a `join` event with the `shareToken`, and the server assigns their connection to that list room.
- [x] Server responds to the `join` event by fetching and sending the list's current items from SQLite to the client.
- [x] Clients maintain reconnection logic, attempting to re-establish the WebSocket connection automatically if dropped.
