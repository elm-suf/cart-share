# 03 — Client List Registry, Nickname Prompt & Dashboard

**What to build:** Client-side tracking of multiple lists and editor names. The client browser maintains a registry of lists in `localStorage`. Visiting `/` displays the user's dashboard listing all their active lists. Opening a shared list link automatically joins that list, registers it, and prompts the editor for a nickname if they don't have one set.

**Blocked by:** 02 — SQLite Schema & List Creation API

**Status:** completed

- [x] Browser maintains a `listRegistry` array in `localStorage` containing metadata about lists the user has created or joined (`shareToken`, `name`, `isCreator`, `joinedAt`, `lastAccessedAt`).
- [x] If the user visits `/` and has lists in the registry, they are shown a dashboard of active lists with clickable links and a "Create a New List" button, instead of the empty landing page.
- [x] Visiting `/list/:shareToken` automatically registers the list in the browser's local `listRegistry`.
- [x] If a user visits `/list/:shareToken` and has no nickname stored in `localStorage`, they are shown an overlay prompt to type their name (optional, with a "Skip" button that defaults their name to "Someone").
- [x] A list name endpoint `GET /api/lists/:shareToken` returns list details (name, etc.) to allow updating the list name on the client dashboard.
