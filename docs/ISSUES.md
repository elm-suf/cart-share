# Known Issues & Tech Debt

## [TODO] Render Ephemeral Database 

**Context:** 
The application backend is configured for deployment on Render.com's free tier. The database uses `better-sqlite3`, which writes directly to the local filesystem (`/var/data/database.db` or similar).

**The Problem:**
Render's free tier uses an ephemeral filesystem. When the backend spins down due to inactivity (after 15 minutes) or is redeployed, the local filesystem is wiped clean. This means all user grocery lists and data will be permanently deleted.

**Potential Solutions to Explore Later:**
1. **Upgrade Render Plan:** Upgrade to the Render Starter plan ($7/mo) to get a persistent "Render Disk". This requires no code changes.
2. **Migrate to Cloud Database:** Refactor the backend to replace `better-sqlite3` with a free serverless cloud database like [Turso](https://turso.tech) (LibSQL) or [Neon](https://neon.tech) (Postgres). This keeps hosting completely free but requires a moderate code rewrite in `backend/src/db.ts` and `backend/src/server.ts`.
