# Conflict Resolution via Delta-Patching and LWW Timestamps

We will implement last-write-wins (LWW) conflict resolution in SQLite using client-side modification timestamps and dynamic column-level delta updates.

## Context & Motivation

In a collaborative and offline-first grocery list application, concurrent edits on the same item are possible:
1. **Unrelated fields:** Editor A marks "Milk" as checked while Editor B (offline) edits the quantity of "Milk" to "x 2". If the server overwrites the entire row, one update is lost.
2. **Conflicting fields:** Editor A sets the item name to "Oat Milk" at 10:00:00, while Editor B sets it to "Almond Milk" at 10:00:02. The update from 10:00:02 must win.

We need a conflict resolution mechanism that merges cross-field changes and resolves value-level conflicts chronologically without complex CRDT implementations.

## Decision

1. **SQLite Schema:** The `items` table will contain an `updated_at` column representing the last modification timestamp in epoch milliseconds.
2. **Dynamic Column-Level Updates:** The server will not perform full-row overwrites. Instead, when it receives a delta update (e.g. `{ id, checked, updatedAt }`), it will construct and execute a SQL statement that updates only the `checked` and `updated_at` columns:
   ```sql
   UPDATE items 
   SET checked = ?, updated_at = ? 
   WHERE id = ? AND ? >= updated_at
   ```
3. **Timestamp Verification:** The update SQL will always include a condition: `WHERE id = ? AND ? >= updated_at`.
   - If the client's update timestamp is newer than or equal to the server's record timestamp, the SQL executes successfully, updates the row, and the change is broadcasted.
   - If the client's update timestamp is older, the SQL execution modifies 0 rows. The server detects this, rejects the change, fetches the newer DB record, and sends a correction event back to the updating client to sync its state.

## Consequences

- **Pros:**
  - Standard relational SQL constructs: resolves conflict checks inside a single SQLite atomic statement.
  - Correct merge behavior: column isolation ensures different fields (e.g., checking an item vs updating its quantity) do not clobber each other.
  - Zero performance overhead: doesn't require loaded library dependencies.
- **Cons:**
  - Relies on client device clocks for ordering. While device clocks can drift, grocery lists are low-stakes and minor deviations are negligible.
