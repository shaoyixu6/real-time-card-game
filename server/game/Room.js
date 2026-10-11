// server/game/Room.js

class Room {
  /**
   * @param {string} roomId - 房间唯一ID
   */
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];         // 存放最多 2 个 Player 实例
    this.state = 'WAITING';    // 状态机：WAITING(等待玩家), PLAYING(对局中), ENDED(已结束)
    this.turn = 1;             // 当前第几回合
    this.currentTurnPlayerId = null; // 当前正在行动的玩家 ID
  }

  // 玩家加入逻辑
  addPlayer(player) {
    if (this.players.length >= 2) {
      return false; // 房间已满
    }

    this.players.push(player);

    // 满两人自动开局
    if (this.players.length === 2) {
      this.startGame();
    }
    return true;
  }

  // 开始对局
  startGame() {
    this.state = 'PLAYING';
    // 默认让第一个进入房间的玩家先手
    this.currentTurnPlayerId = this.players[0].id;
    console.log(`[Room ${this.roomId}] Game started between ${this.players[0].name} and ${this.players[1].name}`);
  }

  // 处理出牌逻辑
  playCard(playerId, payload) {
    // 1. 校验：游戏是否在进行？是否轮到该玩家出牌？
    if (this.state !== 'PLAYING') {
      console.log('游戏未开始或已结束');
      return false; 
    }
    if (this.currentTurnPlayerId !== playerId) {
      console.log('还没轮到你出牌！');
      return false;
    }

    // 2. 找到攻击者和防御者
    const attacker = this.players.find(p => p.id === playerId);
    const defender = this.players.find(p => p.id !== playerId);

    // 3. 执行扣血（为了测试，先写死造成 10 点伤害）
    // 以后这里可以改成根据 payload.cardId 去实例化的卡牌字典里取伤害值
    const damage = 10;
    defender.takeDamage(damage);
    
    console.log(`[Action] ${attacker.name} 打出卡牌，造成 ${damage} 伤害！${defender.name} 剩余 HP: ${defender.hp}`);

    // 4. 检查是否击杀结束游戏
    if (defender.hp === 0) {
      this.state = 'ENDED';
      console.log(`[Game Over] ${attacker.name} 取得了胜利！`);
      return true;
    }

    // 5. 切换回合（交换操作权，回合数 +1）
    this.currentTurnPlayerId = defender.id;
    this.turn++;

    return true; // 返回 true 代表动作执行成功，状态已改变
  }

  // 状态快照导出（后续广播给客户端渲染用）
  getSnapshot() {
    return {
      roomId: this.roomId,
      state: this.state,
      turn: this.turn,
      currentTurnPlayerId: this.currentTurnPlayerId,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        hp: p.hp,
        mana: p.mana,
        maxMana: p.maxMana,
        handCount: p.hand.length, // 广播给全局时只透露手牌张数，隐藏手牌具体内容
      })),
    };
  }
}

module.exports = Room;