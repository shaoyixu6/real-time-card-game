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
    
    // 创建玩家时自动初始化牌库
    this.initDeck();
  }

  initDeck() {
    for (let i = 1; i <= 5; i++) {
      this.deck.push(new Card(`fireball_${i}`, '小火球', 1, { type: 'DAMAGE', value: 5 }));
      this.deck.push(new Card(`strike_${i}`, '重击', 2, { type: 'DAMAGE', value: 12 }));
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

  refreshMana(turnCount) {
    this.maxMana = Math.min(turnCount, 10);
    this.mana = this.maxMana;
  }
}

module.exports = Player;