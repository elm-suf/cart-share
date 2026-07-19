# SQLite for Server Persistence

The backend will persist lists, items, and metadata using SQLite.

## Context & Motivation

We need a database to store:
- Lists (id, share_token, creator_token_hash, created_at, updated_at)
- Items (id, list_id, name, quantity, checked, position, updated_at)

To keep local development and deployment friction as low as possible, we want to avoid requiring an external database process (such as PostgreSQL or MySQL). At the same time, we need a relational model to represent items within lists, drag-and-drop order, and fast sync queries. 

SQLite is serverless, zero-configuration, and stores the entire database in a single disk file. It offers high performance, transactions, and robust data integrity.

## Decision

We will use SQLite (via the Node.js library `better-sqlite3` or `sqlite3`) on the Express backend server to persist data. The database file will be saved in the backend's workspace directory.

## Consequences

- **Pros:**
  - Zero external dependencies: no Docker, Postgres installation, or cloud hosting config required to run the app.
  - Relational queries make managing parent-child (List-Item) relations and order updates very simple.
  - Data survives server crashes and restarts.
  - Trivial to backup or inspect.
- **Cons:**
  - Standard SQLite does not scale horizontally across multiple servers easily. However, this is not a concern for the MVP. If scale becomes an issue in the future, we can migrate the schema and queries to PostgreSQL with minimal code changes.

## Considered Options

- **In-Memory Store:** Rejected because all data is lost when the server restarts or crashes.
- **PostgreSQL / MySQL:** Rejected because it introduces external setup/hosting requirements for local development and initial MVP deployment.
- **JSON File Storage:** Rejected because concurrent updates (multiple Editors syncing) can cause race conditions and file corruption.
