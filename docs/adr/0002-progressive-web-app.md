# Progressive Web App (PWA) for Mobile-First Delivery

The MVP will be built as a Progressive Web App (PWA) using Vite, React, and TypeScript.

## Context & Motivation

To meet the core job of allowing quick and instant list sharing ("whoever has the link can open and edit it"), we need an entry path with zero friction. Requiring a partner or roommate to download a native app from an App Store to view a list defeats the immediate, trust-based sharing model. A web app allows instant viewing.

Furthermore, a PWA allows the app to feel native (e.g., fullscreen mode, launcher icon, offline caching) when "Added to Home Screen," which fits the in-store shopping context.

## Decision

We will build a single-page application using React, TypeScript, and Vite, styled with vanilla CSS. We will configure it as a PWA with a service worker to cache assets and allow the app to launch offline.

## Consequences

- **Pros:**
  - Zero-friction sharing: opening the link instantly launches the editor.
  - Cross-platform: single codebase runs on iOS, Android, and desktop.
  - Quick deployment: updates are served instantly over the web.
- **Cons:**
  - No native push notifications on iOS without extra setup/permissions (deferred to v2 anyway).
  - Slightly less robust offline-first sync compared to native local DBs, but sufficient with service worker caching and localStorage sync queues.

## Considered Options

- **Native App (Swift/Kotlin):** Rejected due to high development overhead and app store friction.
- **React Native / Expo:** Rejected because sharing a list would still require app installation or loading via Expo.
- **Standard Web App (non-PWA):** Rejected because it doesn't support offline launch, which is critical in grocery stores with poor cellular signal.
