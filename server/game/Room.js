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