// server/game/Room.js

const EFFECT_HANDLERS = {
  'DAMAGE': (attacker, defender, effect, payload, room) => {
    defender.takeDamage(effect.value);
    if (room.onAction) room.onAction({ type: 'FIREBALL', attacker: attacker.id, target: defender.id, value: effect.value });
  },
  
  'BLACK_FLASH': (attacker, defender, effect, payload, room) => {
    if (payload && payload.qteSuccess) {
      defender.takeDamage(effect.value);
      if (room.onAction) room.onAction({ type: 'BLACK_FLASH', attacker: attacker.id, target: defender.id, value: effect.value, success: true });
    } else {
      if (room.onAction) room.onAction({ type: 'BLACK_FLASH', attacker: attacker.id, target: defender.id, value: 0, success: false });
    }
  },

  'FLOOD': (attacker, defender, effect, payload, room) => {
    defender.nextTurnTimeLimit = effect.value;
  },

  'SLEEP': (attacker, defender, effect, payload, room) => {
    defender.isSleeping = true;
    defender.isStunned = false;
    if (room.onAction) room.onAction({ type: 'START_SLEEP_QTE', target: defender.id });
    defender.sleepTimer = setTimeout(() => {
      defender.isSleeping = false;
      defender.isStunned = true; 
      defender.nextTurnSkip = true; 
      if (room.onStateChange) room.onStateChange();
    }, 5000);
  },

  // 🌟【蛊毒】：循环塞入 2 张，严格判断 < 5 张上限
  'POISON': (attacker, defender, effect, payload, room) => {
    let dudsAdded = 0;
    for (let i = 0; i < 2; i++) {
      if (defender.hand.length < 5) { // 检查如果没满5张，才塞进去
        defender.hand.push({
          id: Math.random().toString(36).substring(2, 9),
          name: '废牌',
          cost: 2, // 🌟 标价 2 费
          effect: { type: 'DUD', description: '无效果' },
          suit: '☠️' // 独特的死灵花色
        });
        dudsAdded++;
      }
    }
    if (room.onAction) room.onAction({ type: 'POISON_HIT', target: defender.id, count: dudsAdded });
  },

  // 🌟【废牌结算】：花 2 费打出后，除了通知前端播报，无任何实质伤害或效果
  'DUD': (attacker, defender, effect, payload, room) => {
    if (room.onAction) room.onAction({ type: 'DUD_DISCARDED', attacker: attacker.id });
  },

  'MAGIC_BOX': (attacker, defender, effect, payload, room) => {
    if (defender.isSleeping || defender.isStunned) {
      defender.takeDamage(effect.value);
      // 🌟【修改】：将整张暗牌（tributeCard）发送给前端
      if (room.onAction) room.onAction({ type: 'MAGIC_BOX_AUTO_HIT', target: defender.id, value: effect.value, tributeCard: payload.tributeCard });
      return;
    }

    room.state = 'BOX_GUESSING';
    room.boxData = {
      attackerId: attacker.id,
      defenderId: defender.id,
      tributeCard: payload.tributeCard, // 🌟【修改】：存入整张暗牌的数据
      timer: setTimeout(() => {
        room.resolveBoxGuess(defender.id, null); 
      }, 6000)
    };
  }
  
};

class Room {
  constructor(roomId, onStateChange, onAction) {
    this.roomId = roomId;
    this.onStateChange = onStateChange;
    this.onAction = onAction;
    this.players = [];
    this.state = 'WAITING'; 
    this.turn = 1;
    this.currentTurnPlayerId = null;
    this.turnTimer = null;
    this.currentTurnTimeLimit = null;
    this.boxData = null; 
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
  }

  clearAllTimers() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (this.boxData && this.boxData.timer) { clearTimeout(this.boxData.timer); }
    this.players.forEach(p => { if (p.sleepTimer) { clearTimeout(p.sleepTimer); p.sleepTimer = null; } });
  }

  startGame() {
    this.state = 'PLAYING';
    this.currentTurnPlayerId = this.players[0].id;
    // 🌟 传入 this 给发牌机
    this.players[0].drawCard(3, this); 
    this.players[1].drawCard(3, this);
    this.players[0].refreshMana();
    this.players[0].drawCard(1, this);
  }

  playCard(playerId, payload) {
    // 🌟【关键修复】：魔术箱猜谜请求特权通道！无视回合限制直接处理！
    if (payload && payload.action === 'GUESS_BOX') {
      return this.resolveBoxGuess(playerId, payload.suit);
    }

    // 正常出牌必须满足：在自己的回合且不是时停状态
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) return false;

    const attacker = this.players.find(p => p.id === playerId);
    const defender = this.players.find(p => p.id !== playerId);
    const card = attacker.hand.find(c => c.id === payload.cardId);
    if (!card || attacker.mana < card.cost) return false;

    if (card.effect.type === 'DUD') return false;
    
    if (card.effect.type === 'MAGIC_BOX') {
      const tributeCard = attacker.hand.find(c => c.id === payload.tributeId);
      if (!tributeCard || tributeCard.id === card.id) return false;
      
      attacker.mana -= card.cost;
      attacker.hand = attacker.hand.filter(c => c.id !== card.id && c.id !== tributeCard.id);
      // 🌟【修改】：把整张卡牌对象塞进 payload
      EFFECT_HANDLERS['MAGIC_BOX'](attacker, defender, card.effect, { tributeCard: tributeCard }, this);
    }else {
      attacker.mana -= card.cost;
      attacker.hand = attacker.hand.filter(c => c.id !== card.id);
      const handler = EFFECT_HANDLERS[card.effect.type];
      if (handler) handler(attacker, defender, card.effect, payload, this);
    }

    if (defender.hp === 0) { this.clearAllTimers(); this.state = 'ENDED'; }
    return true;
  }

  resolveBoxGuess(playerId, guessSuit) {
    if (this.state !== 'BOX_GUESSING' || this.boxData.defenderId !== playerId) return false;
    clearTimeout(this.boxData.timer);
    
    const attacker = this.players.find(p => p.id === this.boxData.attackerId);
    const defender = this.players.find(p => p.id === this.boxData.defenderId);
    const actualCard = this.boxData.tributeCard; // 🌟 取出整张底牌
    const actualSuit = actualCard.suit; 

    const safeGuess = guessSuit ? guessSuit.charAt(0) : null;
    const safeActual = actualSuit ? actualSuit.charAt(0) : null;

    if (safeGuess === null) {
      defender.takeDamage(10); 
      if (this.onAction) this.onAction({ type: 'MAGIC_BOX_RESULT', target: defender.id, result: 'TIMEOUT', damage: 10, tributeCard: actualCard });
    } else if (safeGuess === safeActual) {
      attacker.takeDamage(20); 
      if (this.onAction) this.onAction({ type: 'MAGIC_BOX_RESULT', target: attacker.id, result: 'REFLECT', damage: 20, tributeCard: actualCard });
    } else {
      defender.takeDamage(20); 
      if (this.onAction) this.onAction({ type: 'MAGIC_BOX_RESULT', target: defender.id, result: 'HIT', damage: 20, tributeCard: actualCard });
    }

    this.state = 'PLAYING'; 
    this.boxData = null;
    
    if (attacker.hp === 0 || defender.hp === 0) { this.clearAllTimers(); this.state = 'ENDED'; }
    if (this.onStateChange) this.onStateChange();
    return true;
  }
  
  wakeUp(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isSleeping) return false;

    clearTimeout(player.sleepTimer);
    player.isSleeping = false;
    player.isStunned = false;
    
    player.takeDamage(8);
    if (this.onAction) this.onAction({ type: 'WAKE_UP_DAMAGE', target: player.id, value: 8 });

    if (player.hp === 0) { this.clearAllTimers(); this.state = 'ENDED'; }
    if (this.onStateChange) this.onStateChange();
    return true;
  }

  endTurn(playerId) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) return false;
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }

    const nextPlayer = this.players.find(p => p.id !== playerId);
    
    if (nextPlayer.nextTurnSkip) {
      nextPlayer.nextTurnSkip = false;
      nextPlayer.isStunned = false; 
      this.turn++;
      const me = this.players.find(p => p.id === playerId);
      me.refreshMana();
      me.drawCard(1, this); // 🌟 这里加上 this
    } else {
      this.currentTurnPlayerId = nextPlayer.id;
      this.turn++;
      nextPlayer.refreshMana();
      nextPlayer.drawCard(1, this); // 🌟 这里加上 this

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
    }
    return true;
  }

  getSnapshot() {
    return {
      roomId: this.roomId, state: this.state, turn: this.turn,
      currentTurnPlayerId: this.currentTurnPlayerId,
      turnTimeLimit: this.currentTurnTimeLimit,
      boxData: this.boxData ? { defenderId: this.boxData.defenderId } : null,
      players: this.players.map(p => ({
        id: p.id, name: p.name, hp: p.hp, mana: p.mana, maxMana: p.maxMana,
        nextTurnFlooded: p.nextTurnTimeLimit, 
        isSleeping: p.isSleeping, isStunned: p.isStunned, nextTurnSkip: p.nextTurnSkip,
        hand: p.hand
      }))
    };
  }
}

module.exports = Room;