# Client-Side Routing and Local List Registry

We will use client-side routing and a local registry in browser `localStorage` to manage multiple lists per user without requiring server-side user accounts.

## Context & Motivation

A user of this app may want to manage multiple lists (e.g., "Weekly Groceries," "Hardware Store," "BBQ Party"). Since we have decided to avoid user accounts (emails, passwords, login ceremonies) for the MVP, the backend does not associate list ownership with a user account. 
We need a way for users to:
1. Access all lists they have created.
2. Access all lists they have joined via a share link.
3. Switch easily between these lists without having to bookmark every single URL.

## Decision

1. **Local List Registry:** Each client device will maintain a `listRegistry` array in `localStorage` containing metadata about the lists they have access to:
   ```ts
   interface RegisteredList {
     shareToken: string;
     name: string;
     isCreator: boolean;
     joinedAt: string;
     lastAccessedAt: string;
   }
   ```
2. **Dashboard at `/`:** The landing page at the root route `/` will dynamically render based on this registry:
   - If the registry is empty: Display a simple, modern landing page with a single "Create a Grocery List" call-to-action.
   - If the registry has one or more lists: Display a dashboard listing the user's active lists, showing list names, creation status, and last accessed timestamps, along with a "Create a New List" button.
3. **Auto-Registration of Shared Links:** When a user visits a shared URL `/list/:shareToken`, the client-side code will automatically add that list's metadata to the local `listRegistry` (if not already present).
4. **List Name Syncing:** List names (defaulting to a timestamp/date or placeholder) can be edited by any Editor. Changes are synchronized in real-time via WebSockets and updated in the server SQLite database, and the new name is propagated to all connected clients to update their local dashboards.

## Consequences

- **Pros:**
  - Zero friction: users can manage and access multiple lists instantly without logging in.
  - Low server complexity: no need to manage user profiles, email verification, or session tokens.
- **Cons:**
  - Registry is device-scoped: if a user switches from their phone to a laptop, their registry of lists will not sync automatically (unless they send the share links to their laptop and click them there). This is an acceptable trade-off for MVP.
  - Data loss on clearing browser cache: if a user clears their browser's local storage, they lose their registry. They will need to re-click the share links to add them back.
