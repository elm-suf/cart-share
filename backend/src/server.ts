import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import db from './db.js';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WsMessageClient, Item } from './shared/websocket.js';

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

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws: WebSocket) => {
  let currentRoom: string | null = null;

  ws.on('message', (message: string) => {
    try {
      const parsed: WsMessageClient = JSON.parse(message.toString());

      if (parsed.type === 'join') {
        const { shareToken } = parsed;
        
        // Verify list exists
        const list = db.prepare('SELECT id FROM lists WHERE share_token = ?').get(shareToken) as any;
        if (!list) {
          ws.send(JSON.stringify({ type: 'error', message: 'List not found' }));
          return;
        }

        // Leave previous room if any
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom)!.delete(ws);
        }

        // Join new room
        currentRoom = shareToken;
        if (!rooms.has(shareToken)) {
          rooms.set(shareToken, new Set());
        }
        rooms.get(shareToken)!.add(ws);

        // Fetch items
        const items = db.prepare('SELECT * FROM items WHERE list_id = ? ORDER BY position').all(list.id) as any[];
        
        const formattedItems = items.map(item => ({
          ...item,
          checked: !!item.checked
        }));

        ws.send(JSON.stringify({ type: 'sync', items: formattedItems }));
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom)!;
      room.delete(ws);
      if (room.size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket server listening on path /ws`);
});
