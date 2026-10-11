// server/index.js
const WebSocket = require('ws');
const Room = require('./game/Room');
const Player = require('./game/Player');

const wss = new WebSocket.Server({ port: 8080 });
const room = new Room('room_001', () => broadcastRoomState(room));

const clients = new Map();
let playerCounter = 1;

function broadcastRoomState(roomInstance) {
  const snapshot = roomInstance.getSnapshot();
  const message = JSON.stringify({
    type: 'STATE_UPDATE',
    data: snapshot
  });

  for (const [playerId, clientWs] of clients.entries()) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  }
}

wss.on('connection', (ws) => {
  const playerId = `p${playerCounter++}`;
  const player = new Player(playerId, `Player_${playerId}`);

  const joined = room.addPlayer(player);
  if (!joined) {
    ws.send(JSON.stringify({ type: 'ERROR', message: '房间已满！' }));
    ws.close();
    return;
  }

  clients.set(playerId, ws);
  ws.send(JSON.stringify({ type: 'SYSTEM', message: `Welcome ${player.name}! You joined ${room.roomId}` }));

  if (room.state === 'PLAYING') {
    broadcastRoomState(room);
  }

  ws.on('message', (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage);
      let stateChanged = false;

      if (data.type === 'PLAY_CARD') {
        stateChanged = room.playCard(playerId, data.payload);
      } else if (data.type === 'END_TURN') {
        stateChanged = room.endTurn(playerId);
      }

      if (stateChanged) {
        broadcastRoomState(room);
      }
    } catch (err) {
      console.error('解析消息失败:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(playerId);
    room.removePlayer(playerId);
  });
});

console.log('WebSocket Server is running on ws://localhost:8080');