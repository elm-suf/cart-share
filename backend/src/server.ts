import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import db from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'cart-share-backend',
  });
});

// Create a new list
app.post('/api/lists', (req: Request, res: Response) => {
  try {
    const shareToken = crypto.randomBytes(16).toString('hex');
    const creatorToken = crypto.randomBytes(16).toString('hex');
    const creatorTokenHash = crypto.createHash('sha256').update(creatorToken).digest('hex');
    const now = Date.now();
    const listName = req.body.name || `Grocery List — ${new Date().toLocaleDateString()}`;

    const stmt = db.prepare(`
      INSERT INTO lists (share_token, creator_token_hash, name, created_at, updated_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(shareToken, creatorTokenHash, listName, now, now, now);

    res.status(201).json({
      shareToken,
      creatorToken,
      name: listName
    });
  } catch (error) {
    console.error('Failed to create list:', error);
    res.status(500).json({ error: 'Failed to create list' });
  }
});

// Fetch list metadata
app.get('/api/lists/:shareToken', (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;
    const now = Date.now();

    // Fetch list details and update activity timestamp
    const list = db.prepare('SELECT * FROM lists WHERE share_token = ?').get(shareToken) as any;

    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Update last_active_at asynchronously
    db.prepare('UPDATE lists SET last_active_at = ? WHERE id = ?').run(now, list.id);

    res.json({
      shareToken: list.share_token,
      name: list.name,
      createdAt: list.created_at,
      updatedAt: list.updated_at
    });
  } catch (error) {
    console.error('Failed to fetch list:', error);
    res.status(500).json({ error: 'Failed to fetch list' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}/api/health`);
});
