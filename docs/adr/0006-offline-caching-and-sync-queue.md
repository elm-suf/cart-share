# Offline Caching and Sync Queue

We will cache list state locally and queue offline mutations to replay them upon reconnection.

## Context & Motivation

Grocery stores often have poor cellular connectivity. To ensure a seamless user experience, the app must remain functional offline:
1. The user must be able to view their existing list immediately upon opening the app, even with zero network connection.
2. The user must be able to add, check off, and reorder items while offline.
3. Offline changes must not be lost if the user closes the app or locks their phone before network connection is restored.
4. When the connection is restored, the changes must sync back to the server in the correct order.

## Decision

1. **Immediate Rendering via LocalStorage Cache:** The client will cache list items and metadata in `localStorage`. On launch, the app immediately reads from `localStorage` and displays the cached items before attempting to establish a WebSocket connection.
2. **Offline Mutation Queue:** If a client action (add, delete, update, reorder) is performed while the WebSocket is disconnected:
   - The action is applied optimistically to the local memory state and saved to `localStorage` (so the UI updates instantly).
   - The mutation details (action type, item ID, parameters, timestamp) are appended to a `syncQueue` array in `localStorage`.
3. **Replaying on Reconnect:**
   - The client will monitor connection state. When the WebSocket connection is successfully re-established:
     - The client sends the queued mutations to the server sequentially, in the order they were created.
     - The server processes each mutation, updating the SQLite database and broadcasting changes to other connected clients.
     - Once the queue is fully drained, the client requests the latest state of the list from the server to reconcile any changes made by other editors.

## Consequences

- **Pros:**
  - Fast, resilient UX: the app remains interactive in poor-signal areas.
  - Durability: offline changes are persisted in `localStorage`, protecting them from tab closures or crashes.
  - Event order preservation: replaying mutations in chronological order preserves the user's intent.
- **Cons:**
  - Simple last-write-wins resolution can overwrite concurrent changes if an offline editor reconnects after a long time. For a grocery list, this is a minor issue and acceptable for the MVP.
