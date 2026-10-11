// server/game/Room.js

class Room {
  constructor(roomId, onStateChange) {
    this.roomId = roomId;
    this.onStateChange = onStateChange;
    this.players = [];
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
    this.turnTimer = null;        // 🌊 大水定时器
    this.sleepTimer = null;       // 💤 大睡 2.5秒挣扎定时器
    this.currentTurnTimeLimit = null;
    this.isCurrentPlayerSleeping = false; // 当前回合玩家是否正在沉睡挣扎中
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
    this.clearAllTimers();
    this.players = this.players.filter(p => p.id !== playerId);
    this.state = 'WAITING';
    this.turn = 1;
    this.currentTurnPlayerId = null;
    this.currentTurnTimeLimit = null;
    this.isCurrentPlayerSleeping = false;
    console.log(`[Room ${this.roomId}] 玩家 ${playerId} 离开，房间已腾出座位`);
  }

  clearAllTimers() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
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
    // 如果还没醒来（正在沉睡挣扎），严禁出牌！
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId || this.isCurrentPlayerSleeping) {
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
    // 👇 新增：【💤大睡】效果结算
    else if (card.effect.type === 'SLEEP') {
      defender.nextTurnSleep = true;
      console.log(`💤[催眠降临!] ${attacker.name} 打出【${card.name}】！${defender.name} 下回合将陷入沉睡！`);
    }

    if (defender.hp === 0) {
      this.clearAllTimers();
      this.state = 'ENDED';
      console.log(`[Game Over] ${attacker.name} 获胜！`);
      return true;
    }

    return true;
  }

  // 👇 新增：处理玩家狂按 12 次挣脱【大睡】的请求
  wakeUp(playerId) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId || !this.isCurrentPlayerSleeping) {
      return false;
    }

    // 取消 2.5 秒强制睡死定时器
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }

    this.isCurrentPlayerSleeping = false;
    const player = this.players.find(p => p.id === playerId);
    const opponent = this.players.find(p => p.id !== playerId);

    // 咬舌尖强行惊醒：受到 8 点精神反噬伤害！
    player.takeDamage(8);
    console.log(`🩸[强行惊醒!] ${player.name} 狂按12次咬破舌尖挣脱了【大睡】！受到 8 点反噬伤害，保住了回合！`);

    if (player.hp === 0) {
      this.clearAllTimers();
      this.state = 'ENDED';
      console.log(`[Game Over] ${player.name} 因强行挣脱催眠力竭倒下，${opponent.name} 获胜！`);
    }

    return true;
  }

  endTurn(playerId) {
    if (this.state !== 'PLAYING' || this.currentTurnPlayerId !== playerId) {
      return false;
    }

    this.clearAllTimers();
    this.isCurrentPlayerSleeping = false;

    const nextPlayer = this.players.find(p => p.id !== playerId);

    this.currentTurnPlayerId = nextPlayer.id;
    this.turn++;
    nextPlayer.refreshMana();
    nextPlayer.drawCard(1);

    // 1. 检查是否中了【💤大睡】（5秒内必须狂点25次挣脱）
    if (nextPlayer.nextTurnSleep) {
      nextPlayer.nextTurnSleep = false;
      this.isCurrentPlayerSleeping = true;
      console.log(`💤 [沉睡判定开始] ${nextPlayer.name} 陷入沉睡！必须在 5 秒内狂按 25 次惊醒！`);

      this.sleepTimer = setTimeout(() => {
        console.log(`💤 [彻底睡死!] ${nextPlayer.name} 未能挣脱【大睡】，回合被直接跳过！`);
        this.endTurn(nextPlayer.id);
        if (this.onStateChange) {
          this.onStateChange();
        }
      }, 5000); // 👈 这里从 2500 改成 5000（5秒）！
    }

    // 2. 检查是否中了【🌊大水】（6秒限时）
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
      if (!this.isCurrentPlayerSleeping) {
        console.log(`[Turn] 回合结束！进入第 ${this.turn} 回合，轮到 ${nextPlayer.name} 行动`);
      }
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
      isCurrentPlayerSleeping: this.isCurrentPlayerSleeping, // 告诉前端当前玩家是否正在沉睡挣扎
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        hp: p.hp,
        mana: p.mana,
        maxMana: p.maxMana,
        nextTurnFlooded: p.nextTurnTimeLimit,
        nextTurnSleep: p.nextTurnSleep, // 预告下回合是否中了大睡
        hand: p.hand
      })),
    };
  }
}

module.exports = Room;