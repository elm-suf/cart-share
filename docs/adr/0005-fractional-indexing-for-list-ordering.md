# Fractional Indexing for List Ordering

We will use fractional indexing (floating-point numbers) to represent and synchronize manual item ordering.

## Context & Motivation

In a collaborative real-time list application, multiple editors can drag-and-drop items to reorder them. If we represent positions using sequential integers (e.g., index `0, 1, 2, 3...`), moving an item from the bottom to the top requires shifting the position of every item in between.
In a real-time system, this creates two major problems:
1. **Network Overhead:** A single drag-and-drop action requires updating and broadcasting $N$ items instead of just one.
2. **Conflict Storms:** If two clients make changes concurrently, updating overlapping ranges of sequential indexes leads to merge conflicts, lost items, or scrambled lists.

We need a way to move a single item to any spot in the list by updating only that single item's position.

## Decision

Each Item in the database will have a `position` field stored as a floating-point number (double precision in SQLite).

1. **Insertion Between Two Items:** When an item is moved between two items with positions $X$ and $Y$, its new position is set to:
   $$\text{new\_position} = \frac{X + Y}{2}$$
2. **Insertion at the Top:** When an item is moved to the very top of the list (above the first item with position $X$), its new position is set to:
   $$\text{new\_position} = X - 1.0$$
3. **Insertion at the Bottom:** When an item is moved to the very bottom of the list (below the last item with position $Y$), its new position is set to:
   $$\text{new\_position} = Y + 1.0$$
4. **Synchronization:** The client only updates the moved item's position and sends this single change to the server. The server stores it and broadcasts it to other editors.

## Consequences

- **Pros:**
  - O(1) database writes: dragging an item updates exactly one row.
  - Conflict-free: two concurrent drags on different items do not conflict or cause validation failures. Under last-write-wins, both items end up in their new positions.
  - Offline-friendly: replayed reorders are simple single-item updates.
- **Cons:**
  - Precision limits: theoretically, if users repeatedly insert items at the same spot without ever dragging other items, the floating-point precision limit (underflow) could eventually be reached. To prevent this, we can implement a periodic "re-spacing" routine on the server if the distance between two positions becomes extremely small (e.g., $< 10^{-9}$). This is highly unlikely to happen in normal usage for a grocery list.
