// server/index.js

const WebSocket = require('ws');
const Player = require('./game/Player');
const Room = require('./game/Room');

// 1. 在 8080 端口启动一个 WebSocket 服务器
const wss = new WebSocket.Server({ port: 8080 });

// 2. 为了测试，我们先在全局建一个唯一的房间
const globalRoom = new Room('room_001');
let playerCounter = 1;

console.log('WebSocket Server is running on ws://localhost:8080');

// 3. 监听玩家连接事件（每当有一个浏览器连进来，就会触发这里）
wss.on('connection', (ws) => {
  const playerId = 'p' + playerCounter++;
  const playerName = 'Player_' + playerId;
  
  console.log(`[Network] ${playerName} connected!`);

  // 创建玩家实例并加入房间
  const newPlayer = new Player(playerId, playerName);
  const joined = globalRoom.addPlayer(newPlayer);

  if (joined) {
    // 如果加入成功，给这个玩家的浏览器发一条欢迎消息
    ws.send(JSON.stringify({
      type: 'SYSTEM',
      message: `Welcome ${playerName}! You joined ${globalRoom.roomId}`
    }));
  } else {
    // 如果房间满了（已经有2个人了），拒绝加入并断开连接
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full!' }));
    ws.close();
    return;
  }

  // 4. 监听这个玩家发来的任何消息
  ws.on('message', (message) => {
    console.log(`[Message from ${playerName}]: ${message}`);
    // 以后玩家出牌的指令就会发到这里，我们在这里调用 Room 的逻辑
  });

  // 5. 监听玩家掉线/关闭网页
  ws.on('close', () => {
    console.log(`[Network] ${playerName} disconnected.`);
    // 以后可以在这里处理玩家逃跑或掉线的逻辑
  });
});