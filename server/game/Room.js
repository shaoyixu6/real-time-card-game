// server/game/Room.js

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
  }

  addPlayer(player) {
    if (this.players.length >= 2) return false;
    this.players.push(player);
    if (this.players.length === 2) {
      this.startGame();
    }
    return true;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
    console.log(`[Room ${this.roomId}] 玩家 ${playerId} 离开，房间已腾出座位`);
  }

  startGame() {
    this.state = 'PLAYING';
    this.currentTurnPlayerId = this.players[0].id;

    this.players[0].drawCard(3);
    this.players[1].drawCard(3);

    this.players[0].refreshMana();
    this.players[0].drawCard(1);

    console.log(`[Room ${this.roomId}] 游戏开始！先手: ${this.players[0].name}`);
  }

  playCard(playerId, payload) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) {
      return false;
    }

    const attacker = this.players.find(p => p.id === playerId);
    const defender = this.players.find(p => p.id !== playerId);

    const cardIndex = payload && payload.cardId 
      ? attacker.hand.findIndex(c => c.id === payload.cardId) 
      : 0;

    if (cardIndex === -1 || attacker.hand.length === 0) return false;

    const card = attacker.hand[cardIndex];

    if (attacker.mana < card.cost) {
      console.log(`法力值不足！需要 ${card.cost} 费，当前只有 ${attacker.mana} 费`);
      return false;
    }

    // 扣除费用并移除手牌
    attacker.mana -= card.cost;
    attacker.hand.splice(cardIndex, 1);

    // 结算卡牌效果
    if (card.effect.type === 'DAMAGE') {
      defender.takeDamage(card.effect.value);
      console.log(`[Action] ${attacker.name} 消耗 ${card.cost} 费打出【${card.name}】，造成 ${card.effect.value} 点伤害！`);
    } 
    // 👇 新增：黑闪 QTE 专属判定结算
    else if (card.effect.type === 'BLACK_FLASH') {
      if (payload.qteSuccess) {
        defender.takeDamage(card.effect.value);
        console.log(`⚡[黑闪暴击!!] ${attacker.name} 完美命中判定区！打出【${card.name}】造成 ${card.effect.value} 点毁灭伤害！`);
      } else {
        console.log(`💨[黑闪失误...] ${attacker.name} 未能把握空间扭曲的瞬间，【${card.name}】发动失败，造成 0 点伤害！`);
      }
    }

    if (defender.hp === 0) {
      this.state = 'ENDED';
      console.log(`[Game Over] ${attacker.name} 获胜！`);
      return true;
    }

    return true;
  }

  endTurn(playerId) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) {
      return false;
    }

    const nextPlayer = this.players.find(p => p.id !== playerId);

    this.currentTurnPlayerId = nextPlayer.id;
    this.turn++;
    nextPlayer.refreshMana();
    nextPlayer.drawCard(1);

    console.log(`[Turn] 回合结束！进入第 ${this.turn} 回合，轮到 ${nextPlayer.name} 行动`);
    return true;
  }

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