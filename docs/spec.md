# Shared Grocery List Specification (PRD)

## Problem Statement

Cohabiting couples and multi-adult households struggle to coordinate who buys what in real-time. Often, one person is at the grocery store while another is at home thinking of items. Without instant, reliable synchronization, this leads to duplicate purchases, missed items, or the friction of constant text messaging. General-purpose checklist apps are either too generic or slow, and dedicated grocery apps are often bloated, requiring logins and accounts which adds friction to list sharing.

## Solution

A mobile-first, login-free Progressive Web App (PWA) that allows users to instantly create and share collaborative lists via secret links. When editors are online, list updates (adds, checks, reorders) sync in real-time using WebSockets. When editors are offline (e.g., inside a grocery store with poor cellular signal), changes are cached locally, queued, and replayed chronologically on reconnecting. The app supports managing multiple lists via a local registry stored in `localStorage`, serving as a personal dashboard.

## User Stories

1. As a new visitor on `/`, I want to see a landing page with a single prominent option to create a list, so that I can get started with zero friction.
2. As a Creator, I want to automatically receive a `creatorToken` stored in my browser's `localStorage` when I create a list, so that I have administrative rights to rotate the link without needing a password.
3. As a Creator, I want to copy a unique share link to my clipboard, so that I can send it to my household members.
4. As an Editor (household member), I want to open a share link `/list/:shareToken` in my mobile browser and access the list instantly, so that I don't have to go through a login or sign-up wall.
5. As an Editor opening a shared link for the first time, I want to be prompted for an optional nickname (defaulting to "Someone"), so that my name is associated with items I add or check off.
6. As an Editor, I want to add an active item with a name and optional quantity (e.g. "milk × 2"), so that the shopper knows exactly what is needed.
7. As an Editor, I want to see new active items added by other editors appear on my screen in real-time, so that I don't buy duplicate items.
8. As an Editor, I want to check off an item I have placed in the cart, so that it moves to the checked section and lets other editors know it is bought.
9. As an Editor, I want to see items checked off by others in real-time, so that I don't spend time searching for them.
10. As an Editor, I want to drag and drop items to manually reorder the list, so that I can group items by aisle or my shopping path in the store.
11. As an Editor, I want list reordering to sync in real-time to other editors' screens, so that we see the same structured list order.
12. As an Editor, I want to rename a list (e.g., from a date placeholder to "Costco Run"), so that I can easily distinguish it from other lists.
13. As an Editor, I want to visit the root route `/` and see a dashboard of all lists I have created or joined, so that I can easily switch between them.
14. As an Editor shopping in a store with poor cell reception, I want the list to load and render instantly from local cache, so that I can see the items without network errors.
15. As an Editor offline, I want my changes (adding, checking, reordering) to update the UI instantly and queue locally, so that I can continue shopping uninterrupted.
16. As an Editor, I want my queued offline changes to sync to the server in chronological order when I reconnect, so that my partner's view is updated.
17. As a Creator, I want to rotate/revoke the share link, so that if the link leaks, I can disable access to unauthorized users.
18. As an Editor, I want to be notified when a new app update is deployed, so that I can click to reload it and ensure my client version remains compatible with the server.

## Implementation Decisions

*   **Platform & Tech Stack:**
    *   **Frontend:** Vite + React + TypeScript + Vanilla CSS, packaged as a Progressive Web App (PWA) with service workers for offline launch capabilities.
    *   **Backend:** Node.js + Express.
    *   **Database:** SQLite on the server (using `better-sqlite3`) to store list state.
*   **Real-time Sync & Conflicts:**
    *   **HTTP Initial Load:** The client queries the API `GET /api/lists/:shareToken` to load the initial list state before opening the WebSocket.
    *   **WebSocket Deltas:** Real-time updates (adds, checks, reorders) are synchronized via WebSocket messages containing incremental changes (deltas: `ITEM_ADDED`, `ITEM_UPDATED`, `ITEM_DELETED`, `LIST_RENAMED`) instead of full list broadcasts.
    *   **Conflict Resolution:** SQLite writes are parameterized to update only modified columns. Each client sends its local modification timestamp (`updatedAt`), and writes are committed using a conditional check `WHERE id = ? AND ? >= updated_at`.
*   **Item Ordering:**
    *   **Fractional Indexing** (floating-point positions) is used to store and sync item order.
    *   Moving an item only requires updating a single item's position to the midpoint of its new neighbors, preventing list-wide re-indexing conflicts.
*   **Offline Support:**
    *   Full list state cached in browser `localStorage`.
    *   Offline changes are stored sequentially in a `syncQueue` array in `localStorage` and flushed chronologically upon reconnection.
*   **Database Management (TTL):**
    *   Lists maintain a `last_active_at` timestamp.
    *   A background pruning task runs daily on the server to delete lists and items that have been inactive for more than 90 days.
    *   If a client tries to open a pruned list, the server returns a `410 Gone` and the client removes it from its registry.
*   **Version Updates:**
    *   The PWA listens for new service worker scripts and prompts the user with a banner to reload. Clicking reload skips waiting, updates the service worker, and reloads the page.
*   **Authentication & Security:**
    *   No logins, passwords, or emails.
    *   Share links use high-entropy random strings `/list/:shareToken`.
    *   Creator-only actions (link rotation) authorized by matching a locally stored `creatorToken` against a hashed value on the server.
    *   Multiple lists tracked via a local list registry in the browser's `localStorage`.

## Testing Decisions

*   **Primary Testing Seam: End-to-End (E2E) Browser Level (Playwright)**
    *   We will test the system end-to-end at the browser interface layer. Playwright allows spawning multiple browser contexts to test real-time collaboration (e.g., Editor A typing, Editor B seeing the item instantly) and simulating offline/online transitions.
*   **Secondary Testing Seam: Integration Layer (Vitest & Supertest)**
    *   We will test backend HTTP endpoints and WebSocket message handlers in isolation using Vitest and `supertest` against an in-memory SQLite database, verifying correct schema states, link validation, and sync message propagation.
*   **Good Test Principles:**
    *   Tests will assert external behaviors (e.g., items updating, sorting order rendering correctly, offline queueing syncing) rather than internals like database connection details or WebSocket frame formats.

## Out of Scope

*   User accounts, profiles, registration, or password recovery.
*   Push notifications (APNs / FCM) for the MVP.
*   Item categorization databases (USDA, Open Food Facts lookup, or LLM classification) for the MVP (slated for v2).
*   Detailed list history, purchase analysis, or audit logs beyond moving active items to the checked section.

## Further Notes

*   **Service Worker:** A service worker will cache static assets (`index.html`, JavaScript, CSS) to ensure the web app launches instantly even with zero connection.
*   **Re-spacing Positions:** A periodic SQLite maintenance task can run to re-space item positions if the gap between fractional positions gets extremely narrow (e.g., $< 10^{-9}$), though this is highly unlikely to happen in normal MVP usage.
