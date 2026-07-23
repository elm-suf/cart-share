# HTTP Initial Load and WebSocket Synchronization

We will use standard HTTP GET requests for initial list retrieval, and WebSockets solely for real-time incremental update propagation.

## Context & Motivation

When a user opens a list share link, they expect to see the list load as fast as possible. If we perform the initial fetch over a WebSocket connection:
1. The client must first execute a WebSocket handshake, which is slower than a simple HTTP request.
2. If the list does not exist (404) or the link has been revoked (410), handling these routing/error states over WebSocket connection protocol is cumbersome compared to standard HTTP status codes.
3. Rendering static cached content or implementing HTTP-level caching proxies becomes harder.

We need a clear separation of concerns: query initial state via standard REST endpoints, and use WebSockets for active real-time updates.

## Decision

1. **HTTP GET for Initial State:** The PWA client will retrieve the initial list details and items by firing a `GET /api/lists/:shareToken` request.
2. **WebSocket for Deltas:** Upon a successful HTTP response, the client will connect to the WebSocket server at `/ws` and subscribe to real-time events.
3. **Graceful Connection Failure:** If the WebSocket connection fails or drops, the client continues to display the list state (and queues offline edits locally) without throwing a fatal crash screen, while attempting to reconnect in the background.

## Consequences

- **Pros:**
  - Faster initial loading speed (HTTP response is quicker than WS handshake + query).
  - Trivial error handling: expired or invalid lists immediately yield standard HTTP status codes (e.g., 404, 410) which the router handles gracefully.
  - Clear architectural separation between static query APIs and active real-time events.
- **Cons:**
  - The client must implement two distinct network client classes (Fetch API for HTTP and WebSocket for streaming). This is minimal overhead and standard in modern web applications.
