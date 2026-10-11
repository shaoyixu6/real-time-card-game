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

//提取一个广播函数，用来给所有连着的玩家同步最新游戏状态
function broadcastRoomState() {
  const snapshot = globalRoom.getSnapshot();
  const msg = JSON.stringify({ type: 'STATE_UPDATE', data: snapshot });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

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

    // 👇 [新增 2] 如果满两人自动开局了，立刻给所有人广播初始状态（血量、回合等）！
    if (globalRoom.state === 'PLAYING') {
      broadcastRoomState();
    }
  } else {
    // 如果房间满了（已经有2个人了），拒绝加入并断开连接
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full!' }));
    ws.close();
    return;
  }

  // 4. 监听这个玩家发来的任何消息
  // 👇 [新增 3] 把原来的简单打印，替换成 JSON 指令解析与出牌调用
  ws.on('message', (message) => {
    try {
      // 把收到的 JSON 字符串解析成 JS 对象
      const action = JSON.parse(message);
      console.log(`[Message from ${playerName}]:`, action);
      
      // 如果玩家发来的指令类型是出牌
      if (action.type === 'PLAY_CARD') {
        const success = globalRoom.playCard(playerId, action.payload);
        // 如果出牌成功（通过了回合校验并扣了血），立刻全服广播最新状态！
        if (success) {
          broadcastRoomState();
        }
      }
    } catch (err) {
      console.log(`[Error] 收到非 JSON 格式消息: ${message}`);
    }
  });

  // 5. 监听玩家掉线/关闭网页
  ws.on('close', () => {
    console.log(`[Network] ${playerName} disconnected.`);
    // 以后可以在这里处理玩家逃跑或掉线的逻辑
  });
});