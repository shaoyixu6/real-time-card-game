// server/index.js

const WebSocket = require('ws');
const Player = require('./game/Player');
const Room = require('./game/Room');

const wss = new WebSocket.Server({ port: 8080 });

const globalRoom = new Room('room_001');
let playerCounter = 1;

console.log('WebSocket Server is running on ws://localhost:8080');

// 广播最新状态给所有客户端
function broadcastRoomState() {
  const snapshot = globalRoom.getSnapshot();
  const msg = JSON.stringify({ type: 'STATE_UPDATE', data: snapshot });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  const playerId = 'p' + playerCounter++;
  const playerName = 'Player_' + playerId;
  
  console.log(`[Network] ${playerName} connected!`);

  const newPlayer = new Player(playerId, playerName);
  const joined = globalRoom.addPlayer(newPlayer);

  if (joined) {
    ws.send(JSON.stringify({
      type: 'SYSTEM',
      message: `Welcome ${playerName}! You joined ${globalRoom.roomId}`
    }));

    if (globalRoom.state === 'PLAYING') {
      broadcastRoomState();
    }
  } else {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full!' }));
    ws.close();
    return;
  }

  // 监听玩家发来的操作指令（出牌 / 结束回合）
  ws.on('message', (message) => {
    try {
      const action = JSON.parse(message);
      
      if (action.type === 'PLAY_CARD') {
        const success = globalRoom.playCard(playerId, action.payload);
        if (success) broadcastRoomState();
      } 
      else if (action.type === 'END_TURN') {
        const success = globalRoom.endTurn(playerId);
        if (success) broadcastRoomState();
      }
    } catch (err) {
      console.log(`[Error] 收到非 JSON 格式消息: ${message}`);
    }
  });

  // 监听玩家掉线/刷新网页，自动清理座位
  ws.on('close', () => {
    console.log(`[Network] ${playerName} disconnected.`);
    globalRoom.removePlayer(playerId);
  });
});