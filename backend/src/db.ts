import DatabaseConstructor from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Open database connection
const dbPath = path.join(__dirname, '..', 'database.db');
const db = new DatabaseConstructor(dbPath);

// Enable Foreign Key support and WAL mode for concurrent execution
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_token TEXT UNIQUE NOT NULL,
    creator_token_hash TEXT NOT NULL,
    name TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity TEXT,
    checked INTEGER NOT NULL DEFAULT 0,
    position REAL NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_lists_share_token ON lists(share_token);
  CREATE INDEX IF NOT EXISTS idx_items_list_id ON items(list_id);
`);

console.log(`📂 SQLite database initialized at ${dbPath}`);

export default db;
