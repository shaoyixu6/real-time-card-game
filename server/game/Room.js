// server/game/Room.js

const EFFECT_HANDLERS = {
  'DAMAGE': (attacker, defender, effect, payload, room) => {
    let finalDmg = effect.value;
    let isCrit = false;
    
    // 🌟 黑桃结界 Buff 生效：伤害翻倍并清空 Buff
    if (attacker.nextAttackDouble) {
      finalDmg *= 2;
      attacker.nextAttackDouble = false;
      isCrit = true;
    }
    
    defender.takeDamage(finalDmg);
    if (room.onAction) room.onAction({ type: 'DAMAGE_HIT', attacker: attacker.id, target: defender.id, value: finalDmg, crit: isCrit });
  },
  
  'BLACK_FLASH': (attacker, defender, effect, payload, room) => {
    if (payload && payload.qteSuccess) {
      let finalDmg = effect.value;
      // 🌟 只有 QTE 成功命中时，才消耗黑桃双倍 Buff！（爆出 50 点斩杀！）
      if (attacker.nextAttackDouble) {
        finalDmg *= 2;
        attacker.nextAttackDouble = false;
      }
      defender.takeDamage(finalDmg);
      if (room.onAction) room.onAction({ type: 'BLACK_FLASH', attacker: attacker.id, target: defender.id, value: finalDmg, success: true });
    } else {
      // QTE 失误不消耗黑桃双倍 Buff
      if (room.onAction) room.onAction({ type: 'BLACK_FLASH', attacker: attacker.id, target: defender.id, value: 0, success: false });
    }
  },

  'FLOOD': (attacker, defender, effect, payload, room) => {
    defender.nextTurnTimeLimit = effect.value;
    if (room.onAction) room.onAction({ type: 'FLOOD_CAST', attacker: attacker.id, target: defender.id, value: effect.value });
  },

  'SLEEP': (attacker, defender, effect, payload, room) => {
    defender.isSleeping = true;
    defender.isStunned = false;
    if (room.onAction) room.onAction({ type: 'START_SLEEP_QTE', target: defender.id });
    if (defender.sleepTimer) clearTimeout(defender.sleepTimer);
    defender.sleepTimer = setTimeout(() => {
      defender.isSleeping = false;
      defender.isStunned = true; 
      defender.nextTurnSkip = true; 
      if (room.onStateChange) room.onStateChange();
    }, 5000);
  },

  'POISON': (attacker, defender, effect, payload, room) => {
    let dudsAdded = 0;
    for (let i = 0; i < 2; i++) {
      if (defender.hand.length < 5) {
        defender.hand.push({
          id: Math.random().toString(36).substring(2, 9),
          name: '废牌',
          cost: 2,
          effect: { type: 'DUD', description: '无效果' },
          suit: '☠️'
        });
        dudsAdded++;
      }
    }
    if (room.onAction) room.onAction({ type: 'POISON_HIT', target: defender.id, count: dudsAdded });
  },

  'DUD': (attacker, defender, effect, payload, room) => {
    if (room.onAction) room.onAction({ type: 'DUD_DISCARDED', attacker: attacker.id });
  },

  'MAGIC_BOX': (attacker, defender, effect, payload, room) => {
    if (defender.isSleeping || defender.isStunned) {
      let finalDmg = effect.value;
      if (attacker.nextAttackDouble) {
        finalDmg *= 2;
        attacker.nextAttackDouble = false;
      }
      defender.takeDamage(finalDmg);
      if (room.onAction) room.onAction({ type: 'MAGIC_BOX_AUTO_HIT', target: defender.id, value: finalDmg, tributeCard: payload.tributeCard });
      return;
    }

    // 🌟 进入魔术箱时停前，如果当前回合有大水倒计时，先暂停它防止偷跑！
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    room.state = 'BOX_GUESSING';
    room.boxData = {
      attackerId: attacker.id,
      defenderId: defender.id,
      tributeCard: payload.tributeCard,
      timer: setTimeout(() => {
        room.resolveBoxGuess(defender.id, null); 
      }, 6500)
    };
  },

  // 🌟【生死判官（方案B：黑箱验牌）】：绝不泄露具体卡面，只返回卡背数量与花色印记！
  'JUDGE': (attacker, defender, effect, payload, room) => {
    const declaredSuit = (payload && payload.declaredSuit) ? payload.declaredSuit : '♠️';
    const targetChar = declaredSuit.charAt(0);
    
    // 检查对手每张手牌是否匹配宣言的花色（只生成 true/false 掩码，不暴露卡牌内容）
    const slotMatches = defender.hand.map(c => Boolean(c.suit && c.suit.charAt(0) === targetChar));
    const matchCount = slotMatches.filter(Boolean).length;
    const isSuccess = (matchCount >= 2);

    if (isSuccess) {
      let finalDmg = effect.value; // 25
      let isCrit = false;
      if (attacker.nextAttackDouble) {
        finalDmg *= 2;
        attacker.nextAttackDouble = false;
        isCrit = true;
      }
      defender.takeDamage(finalDmg);
      if (room.onAction) {
        room.onAction({
          type: 'JUDGE_RESULT',
          attacker: attacker.id,
          target: defender.id,
          declaredSuit: declaredSuit,
          matchCount: matchCount,
          handCount: defender.hand.length,
          // 🌟 成功时只传布尔掩码（如 [true, false, true]），只亮卡背印章，绝不传卡面！
          slotMatches: slotMatches,
          success: true,
          damage: finalDmg,
          crit: isCrit
        });
      }
    } else {
      // 审判失败：反噬自身 10 血，且连布尔掩码和具体数量都完全抹除（防止猜错还试探出有1张还是0张）
      const selfDmg = effect.selfDmg || 10;
      attacker.takeDamage(selfDmg);
      if (room.onAction) {
        room.onAction({
          type: 'JUDGE_RESULT',
          attacker: attacker.id,
          target: attacker.id,
          declaredSuit: declaredSuit,
          handCount: defender.hand.length,
          slotMatches: [], // 🌟 失败时全黑箱，零信息反馈！
          success: false,
          damage: selfDmg,
          crit: false
        });
      }
    }
  },
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
    player.pendingClubDiscard = false;
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
    this.clearAllTimers();
    this.state = 'PLAYING';
    this.turn = 1;
    this.currentTurnTimeLimit = null;
    this.boxData = null;

    // 🌟【修复】：开局前彻底重置双方所有属性，防止有人刷新重连后带着上一局的残血和旧牌！
    this.players.forEach(p => {
      p.hp = 100;
      p.mana = 0;
      p.maxMana = 2;
      p.hand = [];
      p.nextTurnTimeLimit = null;
      p.nextTurnSkip = false;
      p.isSleeping = false;
      p.isStunned = false;
      p.streakSuit = null;
      p.streakCount = 0;
      p.nextAttackDouble = false;
      p.pendingClubDiscard = false;
    });

    this.currentTurnPlayerId = this.players[0].id;
    this.players[0].drawCard(3, this); 
    this.players[1].drawCard(4, this);
    this.players[0].refreshMana();
    this.players[0].drawCard(1, this);
  }

  playCard(playerId, payload) {
    // 1. 魔术箱猜谜特权通道
    if (payload && payload.action === 'GUESS_BOX') {
      return this.resolveBoxGuess(playerId, payload.suit);
    }
    // 2. 梅花共鸣点选对手手牌弃置特权通道
    if (payload && payload.action === 'PICK_CLUB_DISCARD') {
      return this.resolveClubDiscard(playerId, payload.targetIndex);
    }

    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) return false;

    const attacker = this.players.find(p => p.id === playerId);
    const defender = this.players.find(p => p.id !== playerId);
    const card = attacker.hand.find(c => c.id === payload.cardId);
    if (!card || attacker.mana < card.cost) return false;

    // 魔术箱祭品校验
    let tributeCard = null;
    if (card.effect.type === 'MAGIC_BOX') {
      tributeCard = attacker.hand.find(c => c.id === payload.tributeId);
      if (!tributeCard || tributeCard.id === card.id || tributeCard.effect.type === 'DUD') return false;
    }

    // 扣除费用并移除手牌
    attacker.mana -= card.cost;
    if (card.effect.type === 'MAGIC_BOX') {
      attacker.hand = attacker.hand.filter(c => c.id !== card.id && c.id !== tributeCard.id);
    } else {
      attacker.hand = attacker.hand.filter(c => c.id !== card.id);
    }

    // 🌟 第 1 步：先结算当前打出的卡牌效果（确保第 3 张黑桃绝不会消耗掉刚触发的双倍 Buff）
    if (card.effect.type === 'MAGIC_BOX') {
      EFFECT_HANDLERS['MAGIC_BOX'](attacker, defender, card.effect, { tributeCard: tributeCard }, this);
    } else {
      const handler = EFFECT_HANDLERS[card.effect.type];
      if (handler) handler(attacker, defender, card.effect, payload, this);
    }

    // 如果对手已经阵亡，直接结束游戏，不再触发后续共鸣
    if (defender.hp <= 0 || attacker.hp <= 0) {
      this.clearAllTimers();
      this.state = 'ENDED';
      return true;
    }

    // 🌟 第 2 步：累计花色连击并触发共鸣（废牌 DUD 不计入连击）
    if (card.effect.type !== 'DUD') {
      if (attacker.streakSuit === card.suit) {
        attacker.streakCount++;
      } else {
        attacker.streakSuit = card.suit;
        attacker.streakCount = 1;
      }

      if (attacker.streakCount >= 3) {
        const resonanceTriggered = attacker.streakSuit;
        attacker.streakCount = 0;
        attacker.streakSuit = null; 
        
        if (resonanceTriggered === '♥️') {
          attacker.hp = Math.min(100, attacker.hp + 20);
          if (this.onAction) this.onAction({ type: 'RESONANCE', target: attacker.id, suit: '♥️' });
        } 
        else if (resonanceTriggered === '♠️') {
          attacker.nextAttackDouble = true;
          if (this.onAction) this.onAction({ type: 'RESONANCE', target: attacker.id, suit: '♠️' });
        } 
        else if (resonanceTriggered === '♦️') {
          attacker.mana = Math.min(attacker.maxMana, attacker.mana + 2);
          attacker.drawCard(1, this);
          if (this.onAction) this.onAction({ type: 'RESONANCE', target: attacker.id, suit: '♦️' });
        } 
        else if (resonanceTriggered === '♣️') {
          // 如果第 3 张梅花刚好是魔术箱（处于猜牌时停），自动随机弃对手 1 张牌防止弹窗冲突
          if (this.state === 'BOX_GUESSING') {
            if (defender.hand && defender.hand.length > 0) {
              const randIdx = Math.floor(Math.random() * defender.hand.length);
              const dropped = defender.hand.splice(randIdx, 1)[0];
              if (this.onAction) this.onAction({ type: 'CLUB_DISCARD_DONE', attacker: attacker.id, target: defender.id, discardedCard: dropped });
            }
          } else {
            if (defender.hand && defender.hand.length > 0) {
              attacker.pendingClubDiscard = true;
            }
            if (this.onAction) this.onAction({ type: 'RESONANCE', target: attacker.id, suit: '♣️' });
          }
        }
      }
    }

    return true;
  }

  resolveClubDiscard(playerId, targetIndex) {
    const attacker = this.players.find(p => p.id === playerId);
    const defender = this.players.find(p => p.id !== playerId);
    // 🌟 严格校验：必须拥有待执行的梅花弃牌权
    if (!attacker || !attacker.pendingClubDiscard || !defender || !defender.hand || defender.hand.length === 0) {
      return false;
    }

    attacker.pendingClubDiscard = false;
    const idx = (targetIndex >= 0 && targetIndex < defender.hand.length) ? targetIndex : 0;
    const discardedCard = defender.hand.splice(idx, 1)[0];

    if (this.onAction) {
      this.onAction({
        type: 'CLUB_DISCARD_DONE',
        attacker: attacker.id,
        target: defender.id,
        discardedCard: discardedCard
      });
    }
    return true;
  }

  resolveBoxGuess(playerId, guessSuit) {
    if (this.state !== 'BOX_GUESSING' || !this.boxData || this.boxData.defenderId !== playerId) return false;
    clearTimeout(this.boxData.timer);
    
    const attacker = this.players.find(p => p.id === this.boxData.attackerId);
    const defender = this.players.find(p => p.id === this.boxData.defenderId);
    const actualCard = this.boxData.tributeCard;
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
    
    if (attacker.hp <= 0 || defender.hp <= 0) { 
      this.clearAllTimers(); 
      this.state = 'ENDED'; 
    }
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

    if (player.hp <= 0) { this.clearAllTimers(); this.state = 'ENDED'; }
    if (this.onStateChange) this.onStateChange();
    return true;
  }

  endTurn(playerId) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) return false;
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    this.currentTurnTimeLimit = null; // 🌟 先清空上一回合的大水限时状态

    const me = this.players.find(p => p.id === playerId);
    const nextPlayer = this.players.find(p => p.id !== playerId);
    if (me) me.pendingClubDiscard = false;
    
    // 🌟 确定下一回合真正行动的玩家（如果对手被眩晕跳过，则依然是 me 行动）
    let activePlayer = nextPlayer;
    if (nextPlayer.nextTurnSkip) {
      nextPlayer.nextTurnSkip = false;
      nextPlayer.isStunned = false; 
      activePlayer = me;
    }

    this.currentTurnPlayerId = activePlayer.id;
    this.turn++;
    activePlayer.refreshMana();
    activePlayer.drawCard(2, this);

    // 🌟 统一检查当前行动玩家身上是否有大水限时
    if (activePlayer.nextTurnTimeLimit) {
      const limitSeconds = activePlayer.nextTurnTimeLimit;
      this.currentTurnTimeLimit = limitSeconds;
      activePlayer.nextTurnTimeLimit = null;
      this.turnTimer = setTimeout(() => {
        this.endTurn(activePlayer.id);
        if (this.onStateChange) this.onStateChange();
      }, limitSeconds * 1000);
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
        streakSuit: p.streakSuit,
        streakCount: p.streakCount,
        nextAttackDouble: p.nextAttackDouble,
        pendingClubDiscard: p.pendingClubDiscard,
        hand: p.hand
      }))
    };
  }
}

module.exports = Room;