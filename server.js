const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/:room', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const room = url.searchParams.get('room');
  if (!room) return ws.close();

  if (!rooms.has(room)) rooms.set(room, new Set());
  const peers = rooms.get(room);

  if (peers.size >= 2) {
    ws.send(JSON.stringify({ type: 'full' }));
    return ws.close();
  }

  peers.add(ws);
  ws.room = room;

  if (peers.size === 2) {
    const [first, second] = peers;
    first.send(JSON.stringify({ type: 'ready', initiator: true }));
    second.send(JSON.stringify({ type: 'ready', initiator: false }));
  } else {
    ws.send(JSON.stringify({ type: 'waiting' }));
  }

  ws.on('message', (data) => {
    const msg = data.toString();
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === 1) {
        peer.send(msg);
      }
    }
  });

  ws.on('close', () => {
    peers.delete(ws);
    if (peers.size === 0) rooms.delete(room);
    for (const peer of peers) {
      peer.send(JSON.stringify({ type: 'peer-left' }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
