# 06 — Drag-and-Drop Reordering via Fractional Indexing

**What to build:** Drag-and-drop manual list reordering for active items. Ordering is powered by fractional indexing (floating-point positions), updating only the single dragged item's position on the server and broadcasting it to other room editors to re-sort their local views.

**Blocked by:** 05 — Real-time Item CRUD & Optimistic UI

**Status:** completed

- [x] Active items list in the frontend supports manual drag-and-drop sorting (e.g., using a touch-friendly list sorting library or native drag events).
- [x] On drag end, the client calculates the dragged item's new position:
  - If dropped between item A and item B: $\frac{\text{position\_A} + \text{position\_B}}{2}$.
  - If dropped at the top: $\text{position\_first} - 1.0$.
  - If dropped at the bottom: $\text{position\_last} + 1.0$.
- [x] Client applies the new position locally and emits an update message over the WebSocket.
- [x] Server updates the single item's `position` in the SQLite database and broadcasts the change to the room.
- [x] Receiving clients apply the updated item position and re-sort their active item lists instantly.
