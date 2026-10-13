// server/game/Room.js

class Room {
  constructor(roomId, onStateChange, onAction) {
    this.roomId = roomId;
    this.onStateChange = onStateChange;
    this.onAction = onAction; // 👈 接收动画广播喇叭
    this.players = [];
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
    this.turnTimer = null;
    this.sleepTimer = null;
    this.currentTurnTimeLimit = null;
    this.isCurrentPlayerSleeping = false;
  }

  addPlayer(player) {
    if (this.players.length >= 2) return false;
    this.players.push(player);
    if (this.players.length === 2) this.startGame();
    return true;
  }

  removePlayer(playerId) {
    this.clearAllTimers();
    this.players = this.players.filter(p => p.id !== playerId);
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
    this.currentTurnTimeLimit = null;
    this.isCurrentPlayerSleeping = false;
  }

  clearAllTimers() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (this.sleepTimer) { clearTimeout(this.sleepTimer); this.sleepTimer = null; }
  }

  startGame() {
    this.state = 'PLAYING';
    this.currentTurnPlayerId = this.players[0].id;
    this.players[0].drawCard(3);
    this.players[1].drawCard(3);
    this.players[0].refreshMana();
    this.players[0].drawCard(1);
  }

  playCard(playerId, payload) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId || this.isCurrentPlayerSleeping) return false;

    const attacker = this.players.find(p => p.id === playerId);
    const defender = this.players.find(p => p.id !== playerId);
    const cardIndex = payload && payload.cardId ? attacker.hand.findIndex(c => c.id === payload.cardId) : 0;
    if (cardIndex === -1 || attacker.hand.length === 0) return false;

    const card = attacker.hand[cardIndex];
    if (attacker.mana < card.cost) return false;

    attacker.mana -= card.cost;
    attacker.hand.splice(cardIndex, 1);

    // 👇 核心改动：在扣血的同时，通知前端播放对应特效！
    if (card.effect.type === 'DAMAGE') {
      defender.takeDamage(card.effect.value);
      if (this.onAction) this.onAction({ type: 'FIREBALL', attacker: attacker.id, target: defender.id, value: card.effect.value });
    } 
    else if (card.effect.type === 'BLACK_FLASH') {
      if (payload.qteSuccess) {
        defender.takeDamage(card.effect.value);
        if (this.onAction) this.onAction({ type: 'BLACK_FLASH', attacker: attacker.id, target: defender.id, value: card.effect.value, success: true });
      } else {
        if (this.onAction) this.onAction({ type: 'BLACK_FLASH', attacker: attacker.id, target: defender.id, value: 0, success: false });
      }
    }
    else if (card.effect.type === 'FLOOD') {
      defender.nextTurnTimeLimit = card.effect.value;
    }
    else if (card.effect.type === 'SLEEP') {
      defender.nextTurnSleep = true;
    }

    if (defender.hp === 0) {
      this.clearAllTimers();
      this.state = 'ENDED';
    }
    return true;
  }

  wakeUp(playerId) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId || !this.isCurrentPlayerSleeping) return false;

    if (this.sleepTimer) { clearTimeout(this.sleepTimer); this.sleepTimer = null; }
    this.isCurrentPlayerSleeping = false;
    const player = this.players.find(p => p.id === playerId);
    
    player.takeDamage(8);
    // 👇 挣扎醒来受到的伤害也触发受击特效！
    if (this.onAction) this.onAction({ type: 'WAKE_UP_DAMAGE', target: player.id, value: 8 });

    if (player.hp === 0) {
      this.clearAllTimers();
      this.state = 'ENDED';
    }
    return true;
  }

  endTurn(playerId) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) return false;
    this.clearAllTimers();
    this.isCurrentPlayerSleeping = false;

    const nextPlayer = this.players.find(p => p.id !== playerId);
    this.currentTurnPlayerId = nextPlayer.id;
    this.turn++;
    nextPlayer.refreshMana();
    nextPlayer.drawCard(1);

    if (nextPlayer.nextTurnSleep) {
      nextPlayer.nextTurnSleep = false;
      this.isCurrentPlayerSleeping = true;
      this.sleepTimer = setTimeout(() => {
        this.endTurn(nextPlayer.id);
        if (this.onStateChange) this.onStateChange();
      }, 5000);
    }

    if (nextPlayer.nextTurnTimeLimit) {
      const limitSeconds = nextPlayer.nextTurnTimeLimit;
      this.currentTurnTimeLimit = limitSeconds;
      nextPlayer.nextTurnTimeLimit = null;
      this.turnTimer = setTimeout(() => {
        this.endTurn(nextPlayer.id);
        if (this.onStateChange) this.onStateChange();
      }, limitSeconds * 1000);
    } else {
      this.currentTurnTimeLimit = null;
    }
    return true;
  }

  getSnapshot() {
    return {
      roomId: this.roomId, state: this.state, turn: this.turn,
      currentTurnPlayerId: this.currentTurnPlayerId,
      turnTimeLimit: this.currentTurnTimeLimit,
      isCurrentPlayerSleeping: this.isCurrentPlayerSleeping,
      players: this.players.map(p => ({
        id: p.id, name: p.name, hp: p.hp, mana: p.mana, maxMana: p.maxMana,
        nextTurnFlooded: p.nextTurnTimeLimit, nextTurnSleep: p.nextTurnSleep, hand: p.hand
      }))
    };
  }
}

module.exports = Room;