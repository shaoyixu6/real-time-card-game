// server/game/Room.js

class Room {
  constructor(roomId, onStateChange) {
    this.roomId = roomId;
    this.onStateChange = onStateChange;
    this.players = [];
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
    this.turnTimer = null;
    this.currentTurnTimeLimit = null;
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
    this.clearTurnTimer();
    this.players = this.players.filter(p => p.id !== playerId);
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
    this.currentTurnTimeLimit = null;
    console.log(`[Room ${this.roomId}] 玩家 ${playerId} 离开，房间已腾出座位`);
  }

  clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
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

    attacker.mana -= card.cost;
    attacker.hand.splice(cardIndex, 1);

    if (card.effect.type === 'DAMAGE') {
      defender.takeDamage(card.effect.value);
      console.log(`[Action] ${attacker.name} 打出【${card.name}】，造成 ${card.effect.value} 点伤害！`);
    } 
    else if (card.effect.type === 'BLACK_FLASH') {
      if (payload.qteSuccess) {
        defender.takeDamage(card.effect.value);
        console.log(`⚡[黑闪暴击!!] ${attacker.name} 完美命中判定区！造成 ${card.effect.value} 点毁灭伤害！`);
      } else {
        console.log(`💨[黑闪失误...] ${attacker.name} 未能命中核心区，造成 0 点伤害！`);
      }
    }
    else if (card.effect.type === 'FLOOD') {
      defender.nextTurnTimeLimit = card.effect.value;
      console.log(`🌊[大水漫灌!] ${attacker.name} 打出【${card.name}】！${defender.name} 下回合出牌时间被限制为 ${card.effect.value} 秒！`);
    }

    if (defender.hp === 0) {
      this.clearTurnTimer();
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

    this.clearTurnTimer();

    const nextPlayer = this.players.find(p => p.id !== playerId);

    this.currentTurnPlayerId = nextPlayer.id;
    this.turn++;
    nextPlayer.refreshMana();
    nextPlayer.drawCard(1);

    if (nextPlayer.nextTurnTimeLimit) {
      const limitSeconds = nextPlayer.nextTurnTimeLimit;
      this.currentTurnTimeLimit = limitSeconds;
      nextPlayer.nextTurnTimeLimit = null;

      console.log(`⏱️ [大水计时开始] ${nextPlayer.name} 只有 ${limitSeconds} 秒时间出牌！`);

      this.turnTimer = setTimeout(() => {
        console.log(`🌊 [时间到!] ${nextPlayer.name} 的 ${limitSeconds} 秒时间耗尽，回合被大水强制冲走！`);
        this.endTurn(nextPlayer.id);
        if (this.onStateChange) {
          this.onStateChange();
        }
      }, limitSeconds * 1000);
    } else {
      this.currentTurnTimeLimit = null;
      console.log(`[Turn] 回合结束！进入第 ${this.turn} 回合，轮到 ${nextPlayer.name} 行动`);
    }

    return true;
  }

  getSnapshot() {
    return {
      roomId: this.roomId,
      state: this.state,
      turn: this.turn,
      currentTurnPlayerId: this.currentTurnPlayerId,
      turnTimeLimit: this.currentTurnTimeLimit,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        hp: p.hp,
        mana: p.mana,
        maxMana: p.maxMana,
        nextTurnFlooded: p.nextTurnTimeLimit, // 直接传递秒数（如 6），没有则为 null
        hand: p.hand
      })),
    };
  }
}

module.exports = Room;