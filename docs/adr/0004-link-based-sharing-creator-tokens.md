# Link-Based Sharing and Creator Token Authorization

We will use high-entropy share tokens for list access and client-side creator tokens for administrative authorization.

## Context & Motivation

To avoid user authentication (logins, passwords, emails) for the MVP, access to lists must be granted via a simple "Share link." However, we still need basic security:
1. Prevent malicious actors from guessing list URLs and accessing other people's lists.
2. Allow the person who created the list (the Creator) to revoke or rotate the share link if it gets leaked, without allowing other Editors to do so.

## Decision

1. **Unpredictable URLs:** Share links will follow the format `/list/:shareToken`, where `shareToken` is a high-entropy cryptographically secure string (e.g., generated using a secure random byte generator or UUIDv4).
2. **Creator Identification:** Upon list creation, the server will generate a random `creatorToken` and return it to the client. The client will store it locally (e.g., in `localStorage`).
3. **Database Storage:** The SQLite database will store:
   - The active `share_token` (as a unique string).
   - A cryptographic hash of the `creator_token` (e.g., SHA-256) to prevent token leaks in case of database access.
4. **Link Rotation/Revocation:** To rotate the share link, the client sends a request to the server with the original `creatorToken`. The server hashes it, matches it against the database, and if successful, generates a new random `share_token`.

## Consequences

- **Pros:**
  - Login-free experience: users can access lists with a simple click.
  - Zero password management or email verification implementation required.
  - Basic access control: only the creator device (holding the token in local storage) can rotate the link.
- **Cons:**
  - If the creator clears their browser storage or loses their device, they lose administrative control over the list. They can still access it using the active share link as an Editor, but cannot rotate it anymore. This is an acceptable trade-off for the MVP's simplicity.
  - Rotating the link invalidates access for all other Editors immediately, requiring the Creator to reshare the new link.
