# 02 — SQLite Schema & List Creation API

**What to build:** Server-side persistence and API endpoints to create lists. An SQLite database is initialized when the server starts, and an Express endpoint is provided to create a list. Clicking the landing page's "Create a Grocery List" button fires a request, stores the new list in SQLite, and redirects the client to the newly created list view at `/list/:shareToken`.

**Blocked by:** 01 — Project Setup & Landing Page Skeleton

**Status:** completed

- [x] SQLite database file is initialized on server startup using `better-sqlite3` (or equivalent).
- [x] Database schema is created containing a `lists` table with fields: `id` (INTEGER PRIMARY KEY), `share_token` (VARCHAR, unique, high-entropy), `creator_token_hash` (VARCHAR), `name` (VARCHAR, optional), and timestamps.
- [x] Backend provides an HTTP API endpoint `POST /api/lists` which generates a high-entropy `shareToken` (e.g., UUIDv4) and a `creatorToken`. The server hashes the `creatorToken` and stores both records in SQLite.
- [x] Clicking the "Create a Grocery List" button on the landing page calls `POST /api/lists`, stores the returned `creatorToken` in browser `localStorage`, and client-side redirects the browser path to `/list/:shareToken`.
- [x] A fallback route `/list/:shareToken` displays a placeholder "List View" showing the active `shareToken` in the header.
