# 05 — Real-time Item CRUD & Optimistic UI

**What to build:** Item manipulation capabilities (add, check/uncheck, delete) synchronized in real-time. Changes are applied optimistically on the client, saved to SQLite on the server, and broadcast to all connected room members in real-time. Checked items automatically animate or transition to a separate "Checked Items" section.

**Blocked by:** 04 — WebSocket Server & Real-time Room Sync

**Status:** ready-for-agent

- [ ] SQLite database schema includes an `items` table with columns: `id` (VARCHAR/INTEGER PRIMARY KEY), `list_id` (INTEGER REFERENCES lists), `name` (VARCHAR), `quantity` (VARCHAR, optional), `checked` (INTEGER/BOOLEAN), `position` (REAL), `updated_at` (TIMESTAMP).
- [ ] Client interface allows typing a name (e.g. "milk"), selecting/typing an optional quantity (e.g., "x 2"), and pressing Enter to add it.
- [ ] When an item is added, checked/unchecked, or deleted, the client applies the change optimistically to the local state immediately, and sends the action over the WebSocket.
- [ ] Server receives the update, writes to SQLite (using last-write-wins per-field conflict resolution comparing modification timestamps if needed), and broadcasts the update event to other clients in the room.
- [ ] Active items and Checked items are rendered in two distinct lists in the UI, with checked items transitioning smoothly between the lists.
- [ ] List items display the nickname of the Editor who added them or last checked them, providing clear shopping context.
