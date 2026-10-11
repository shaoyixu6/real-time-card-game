// server/game/Player.js
const Card = require('./Card');

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.hp = 100;
    this.mana = 0;
    this.maxMana = 0;
    this.hand = [];
    this.deck = [];
    
    this.initDeck();
  }

  initDeck() {
    for (let i = 1; i <= 5; i++) {
      // 1费：炎弹（稳定伤害 5）
      this.deck.push(new Card(`fireball_${i}`, '🔥炎弹', 1, { type: 'DAMAGE', value: 5 }));
      // 2费：黑闪（需要前端 QTE 判定成功才能打出 25 伤！）
      this.deck.push(new Card(`strike_${i}`, '⚡黑闪', 2, { type: 'BLACK_FLASH', value: 25 }));
    }
    this.deck.sort(() => Math.random() - 0.5);
  }

  drawCard(count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.deck.length > 0 && this.hand.length < 10) {
        const card = this.deck.pop();
        this.hand.push(card);
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp < 0) {
      this.hp = 0;
    }
  }

  // 每回合固定 3 点费用
  refreshMana() {
    this.maxMana = 3;
    this.mana = 3;
  }
}

module.exports = Player;