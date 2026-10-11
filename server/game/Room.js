// server/game/Room.js

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
  }

  // 玩家加入逻辑
  addPlayer(player) {
    if (this.players.length >= 2) return false;
    
    this.players.push(player);
    
    // 满两人自动开局
    if (this.players.length === 2) {
      this.startGame();
    }
    return true;
  }

  // 玩家掉线/刷新网页时，将其移出房间并重置对局（彻底解决 Room is full）
  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
    console.log(`[Room ${this.roomId}] 玩家 ${playerId} 离开，房间已腾出座位 (当前人数: ${this.players.length})`);
  }

  // 开始对局：初始抽牌与费用初始化
  startGame() {
    this.state = 'PLAYING';
    this.currentTurnPlayerId = this.players[0].id;

    // 双方开局先各抽 3 张牌
    this.players[0].drawCard(3);
    this.players[1].drawCard(3);

    // 先手玩家获得第 1 回合的法力值（1费）并抽第 1 回合的 1 张牌
    this.players[0].refreshMana(this.turn);
    this.players[0].drawCard(1);

    console.log(`[Room ${this.roomId}] 游戏开始！先手: ${this.players[0].name}`);
  }

  // 处理真实出牌逻辑（只要费用够，一回合可以出多张牌）
  playCard(playerId, payload) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) {
      console.log('未轮到该玩家或游戏未开始');
      return false;
    }

    const attacker = this.players.find(p => p.id === playerId);
    const defender = this.players.find(p => p.id !== playerId);

    // 1. 在攻击者的手牌中查找点击的那张牌
    const cardIndex = payload && payload.cardId 
      ? attacker.hand.findIndex(c => c.id === payload.cardId) 
      : 0;

    if (cardIndex === -1 || attacker.hand.length === 0) {
      console.log('手牌中没有这张牌！');
      return false;
    }

    const card = attacker.hand[cardIndex];

    // 2. 校验法力值（Mana）是否足够
    if (attacker.mana < card.cost) {
      console.log(`法力值不足！需要 ${card.cost} 费，当前只有 ${attacker.mana} 费`);
      return false;
    }

    // 3. 扣除费用，并将卡牌从手牌数组中移除
    attacker.mana -= card.cost;
    attacker.hand.splice(cardIndex, 1);

    // 4. 根据卡牌效果结算伤害
    if (card.effect.type === 'DAMAGE') {
      defender.takeDamage(card.effect.value);
      console.log(`[Action] ${attacker.name} 消耗 ${card.cost} 费打出【${card.name}】，造成 ${card.effect.value} 点伤害！`);
    }

    // 5. 胜负判定
    if (defender.hp === 0) {
      this.state = 'ENDED';
      console.log(`[Game Over] ${attacker.name} 获胜！`);
      return true;
    }

    return true;
  }

  // 玩家主动点击“结束回合”
  endTurn(playerId) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) {
      console.log('不是你的回合，无法结束回合！');
      return false;
    }

    const nextPlayer = this.players.find(p => p.id !== playerId);

    // 切换操作权，回合数 +1，给下一个玩家涨费、回满费并抽 1 张牌
    this.currentTurnPlayerId = nextPlayer.id;
    this.turn++;
    nextPlayer.refreshMana(this.turn);
    nextPlayer.drawCard(1);

    console.log(`[Turn] 回合结束！进入第 ${this.turn} 回合，轮到 ${nextPlayer.name} 行动`);
    return true;
  }

  // 状态快照导出
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
        deckCount: p.deck.length,
        hand: p.hand
      })),
    };
  }
}

module.exports = Room;