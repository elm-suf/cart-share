# PWA Service Worker Update Strategy

We will use a "Prompt for Update" strategy to manage service worker lifecycle updates and ensure client-server version alignment.

## Context & Motivation

Progressive Web Apps (PWAs) rely on a Service Worker to intercept network requests and serve static assets (`index.html`, scripts, styles) from a local Cache Storage. This enables the app to launch instantly and work offline.
However, when a new version of the app is deployed to the server:
1. If the service worker updates silently in the background, the user won't get the new version until they close all active tabs and reopen the app.
2. If a user keeps the app open while shopping, they may run a stale frontend bundle while communicating with a newer backend server. If the WebSocket payload schema or API contracts changed in the backend, this can lead to silent errors, connection drops, or sync failure.

We need a way to immediately detect and safely apply updates while the user is active, ensuring all clients run code compatible with the backend.

## Decision

1. **Prompt for Update UI:** The frontend client will monitor the service worker lifecycle. When a new service worker script is detected and successfully installed, it will enter the `waiting` state. Upon entering `waiting`, the React application will display a toast notification: "An update is available. [Reload to update]".
2. **Immediate Activation:** Clicking the "Reload to update" button will:
   - Send a `{ type: 'SKIP_WAITING' }` message to the waiting service worker, forcing it to activate immediately and take control.
   - Execute `window.location.reload()` to refresh the page and load the updated assets from cache.
3. **No Silent Upgrades:** We will disable automatic/silent service worker activation on page load if active tabs exist, ensuring the user is in control of when the state changes.

## Consequences

- **Pros:**
  - Version alignment: guarantees that clients actively communicating with the backend are running the latest code.
  - Transparent user experience: users are aware of updates and can choose to apply them when convenient.
  - Prevention of runtime bugs caused by stale client-side WebSocket parsing code.
- **Cons:**
  - Mild friction: requires the user to click a button to refresh the app when an update is deployed. However, since grocery lists are short-lived, deployments will rarely interrupt a live shopping trip.
