# Incremental Delta Sync Model for WebSockets

We will synchronize list state changes in real-time by broadcasting small incremental updates (deltas) instead of full list states.

## Context & Motivation

When multiple Editors collaborate on a list, actions (checking items, adding items, drag-to-reorder) happen frequently.
If the client or server broadcasts the entire list state after every action:
1. **High Data Usage:** A list containing 50 items would require transmitting the full JSON array on every single keypress or checkbox toggle, draining mobile data inside stores.
2. **Race Conditions:** If Editor A adds "Apples" and Editor B checks "Milk" at the same time, their clients would send full lists containing different states. Whichever write arrives last at the server would completely overwrite the other's state, resulting in a lost update.

To support high performance and prevent data clobbering, we must transmit only the specific change that occurred.

## Decision

1. **Delta Event Payloads:** WebSocket communication will use a structured message format consisting of an action `type` and an action `payload` detailing only the affected properties:
   - `ITEM_ADDED`: Send the newly created item record.
   - `ITEM_UPDATED`: Send the item `id` and only the fields that changed (e.g. `checked`, `position`, `name`, `quantity`).
   - `ITEM_DELETED`: Send only the item `id`.
   - `LIST_RENAMED`: Send the updated list `name`.
2. **Server Broadcast:** The WebSocket server receives the delta from one client, commits it to the SQLite database, and broadcasts the same delta event to all other clients subscribed to that list's room.
3. **Local State Integration:** Clients receive these delta events and merge them into their local memory and `localStorage` cache.

## Consequences

- **Pros:**
  - Extremely lightweight: payload sizes are minimal (typically $< 200$ bytes per event).
  - Out-of-the-box merge compatibility: unrelated concurrent updates merge seamlessly because they affect different items or properties.
- **Cons:**
  - Clients must maintain an active local list state and be capable of applying fine-grained mutations (reducers) rather than simply replacing the entire list array. This is standard practice in React development.
