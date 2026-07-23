# Database Pruning and Time-To-Live (TTL)

We will implement an activity-based Time-To-Live (TTL) pruning policy to automatically clean up abandoned lists and keep the SQLite database size bounded.

## Context & Motivation

Because list creation is anonymous and login-free, users can create an unlimited number of lists. Many lists will be used for a single shopping trip and then abandoned. 
If we retain all lists indefinitely:
1. The single-file SQLite database will grow unbounded.
2. Server disk space will eventually run out, leading to crashes.
3. Query performance could degrade as the number of rows scales.

We need a simple, zero-maintenance database pruning routine to discard old, inactive data.

## Decision

1. **Activity Timestamp:** The `lists` table will include a `last_active_at` column (epoch milliseconds). The server will update this column to the current time whenever:
   - The list is fetched via `GET /api/lists/:shareToken`.
   - Any database mutation (write/update/delete) occurs on the list or its child items.
   - A client establishes a WebSocket connection to the list.
2. **Cascading Deletes:** The SQLite foreign key configuration on the `items` table will be set to `ON DELETE CASCADE` referencing `lists(id)`. Deleting a list will automatically clean up all of its items.
3. **Daily Cleanup Job:** The server will run a background pruning task every 24 hours. The task will execute:
   ```sql
   DELETE FROM lists WHERE last_active_at < ?
   ```
   where the parameter is the timestamp of 90 days ago.
4. **Client Cleanup:** If a client requests a list that was pruned, the server will return an HTTP `410 Gone`. Upon receiving a 410, the client will immediately delete the list from its browser local registry.

## Consequences

- **Pros:**
  - Automatic size capping: keeps database size small and manageable.
  - Zero-maintenance: cleanups run silently in the background.
  - Cost-efficient: fits easily within free or low-cost hosting plans.
- **Cons:**
  - Data loss: if a household doesn't use their list for 90 days, it is permanently deleted. This is acceptable since a grocery list is short-term collaborative data, and the benefits of a lightweight database outweigh long-term storage of lists.
