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

const allowedOrigins = [
  'https://cart-share.vercel.app',
  'http://localhost:4200',
  process.env.FRONTEND_URL || ''
].filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
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

// Update list name
app.put('/api/lists/:shareToken/name', (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;
    const { name, creatorToken } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Valid name is required' });
    }

    if (!creatorToken || typeof creatorToken !== 'string') {
      return res.status(401).json({ error: 'Creator token is required' });
    }

    // Verify list exists
    const list = db.prepare('SELECT id, creator_token_hash FROM lists WHERE share_token = ?').get(shareToken) as any;
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Verify creator token
    const creatorTokenHash = crypto.createHash('sha256').update(creatorToken).digest('hex');
    if (creatorTokenHash !== list.creator_token_hash) {
      return res.status(403).json({ error: 'Forbidden: only the creator can edit the list name' });
    }

    // Update name
    db.prepare('UPDATE lists SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), Date.now(), list.id);

    res.json({ success: true, name: name.trim() });
  } catch (error) {
    console.error('Failed to update list name:', error);
    res.status(500).json({ error: 'Failed to update list name' });
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

      const broadcast = (payload: any) => {
        if (currentRoom && rooms.has(currentRoom)) {
          const messageStr = JSON.stringify(payload);
          rooms.get(currentRoom)!.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(messageStr);
            }
          });
        }
      };

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
      } else if (parsed.type === 'item_add') {
        if (!currentRoom) return;
        const list = db.prepare('SELECT id FROM lists WHERE share_token = ?').get(currentRoom) as any;
        if (!list) return;

        const { item } = parsed;
        const stmt = db.prepare(`
          INSERT INTO items (id, list_id, name, quantity, checked, position, updated_at, editor)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(item.id, list.id, item.name, item.quantity || null, item.checked ? 1 : 0, item.position, item.updated_at, item.editor || null);
        
        db.prepare('UPDATE lists SET updated_at = ?, last_active_at = ? WHERE id = ?').run(Date.now(), Date.now(), list.id);

        broadcast({ type: 'item_broadcast', action: 'add', item });
      } else if (parsed.type === 'item_update') {
        if (!currentRoom) return;
        const list = db.prepare('SELECT id FROM lists WHERE share_token = ?').get(currentRoom) as any;
        if (!list) return;

        const { item } = parsed;
        // Last-write-wins: only update if the incoming updated_at is >= the stored one
        const currentItem = db.prepare('SELECT updated_at FROM items WHERE id = ?').get(item.id) as any;
        
        if (!currentItem || item.updated_at >= currentItem.updated_at) {
          const stmt = db.prepare(`
            UPDATE items 
            SET name = ?, quantity = ?, checked = ?, position = ?, updated_at = ?, editor = ?
            WHERE id = ?
          `);
          stmt.run(item.name, item.quantity || null, item.checked ? 1 : 0, item.position, item.updated_at, item.editor || null, item.id);
          
          db.prepare('UPDATE lists SET updated_at = ?, last_active_at = ? WHERE id = ?').run(Date.now(), Date.now(), list.id);
          
          broadcast({ type: 'item_broadcast', action: 'update', item });
        }
      } else if (parsed.type === 'item_delete') {
        if (!currentRoom) return;
        const list = db.prepare('SELECT id FROM lists WHERE share_token = ?').get(currentRoom) as any;
        if (!list) return;

        const { itemId } = parsed;
        db.prepare('DELETE FROM items WHERE id = ?').run(itemId);
        
        db.prepare('UPDATE lists SET updated_at = ?, last_active_at = ? WHERE id = ?').run(Date.now(), Date.now(), list.id);
        
        broadcast({ type: 'item_broadcast', action: 'delete', itemId });
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

// Rotate list share link
app.post('/api/lists/:shareToken/rotate', (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;
    const { creatorToken } = req.body;

    if (!creatorToken || typeof creatorToken !== 'string') {
      return res.status(401).json({ error: 'Creator token is required' });
    }

    const list = db.prepare('SELECT id, creator_token_hash FROM lists WHERE share_token = ?').get(shareToken) as any;
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    const creatorTokenHash = crypto.createHash('sha256').update(creatorToken).digest('hex');
    if (creatorTokenHash !== list.creator_token_hash) {
      return res.status(403).json({ error: 'Forbidden: only the creator can rotate the link' });
    }

    const newShareToken = crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE lists SET share_token = ?, updated_at = ? WHERE id = ?').run(newShareToken, Date.now(), list.id);

    // Close all connections in the old room
    if (rooms.has(shareToken)) {
      rooms.get(shareToken)!.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'error', message: 'List share link has been revoked or rotated.' }));
          client.close(4000, 'Link rotated');
        }
      });
      rooms.delete(shareToken);
    }

    res.json({ success: true, newShareToken });
  } catch (error) {
    console.error('Failed to rotate list link:', error);
    res.status(500).json({ error: 'Failed to rotate list link' });
  }
});

server.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket server listening on path /ws`);
});
