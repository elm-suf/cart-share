# 08 — Creator Admin (Link Rotation & Revocation)

**What to build:** Share link administrative controls for the List Creator. The Creator can revoke/rotate the share link from a settings panel, generating a new `shareToken` and redirecting the creator's client while invalidating access for old links.

**Blocked by:** 03 — Client List Registry, Nickname Prompt & Dashboard

**Status:** completed

- [x] UI displays an admin settings panel/button visible **only** to the Creator (by checking if the client has the matching `creatorToken` in `localStorage` for that list).
- [x] Clicking "Rotate Share Link" sends a `POST /api/lists/:shareToken/rotate` request with the `creatorToken` in the payload or headers.
- [x] Server hashes the incoming `creatorToken`, verifies it matches the stored `creator_token_hash` in SQLite, generates a new random `shareToken`, and updates the list's record.
- [x] If successful, the Creator is redirected to the new URL `/list/:newShareToken` and the client registry is updated.
- [x] Old link `/list/:oldShareToken` is invalidated on the server; other editors visiting the old link receive an "Unauthorized / Link Expired" screen.
