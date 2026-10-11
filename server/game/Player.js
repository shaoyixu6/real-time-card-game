// server/game/Player.js
const Card = require('./Card');

// 🎲 卡牌概率配置表：大水(2) : 黑闪(3) : 炎弹(7)
const CARD_POOL = [
  { weight: 2, name: '🌊大水', cost: 1, effect: { type: 'FLOOD', value: 6 } }, // 已改为 6 秒！
  { weight: 3, name: '⚡黑闪', cost: 2, effect: { type: 'BLACK_FLASH', value: 25 } },
  { weight: 7, name: '🔥炎弹', cost: 1, effect: { type: 'DAMAGE', value: 5 } },
];

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.hp = 100;
    this.mana = 0;
    this.maxMana = 0;
    this.hand = [];
    this.cardSeq = 1;
    this.nextTurnTimeLimit = null;
  }

  // 按权重 2:3:7 随机抽一张牌
  generateRandomCard() {
    const totalWeight = CARD_POOL.reduce((sum, item) => sum + item.weight, 0);
    let randomNum = Math.random() * totalWeight;

    for (const template of CARD_POOL) {
      if (randomNum < template.weight) {
        const uniqueId = `card_${this.id}_${this.cardSeq++}`;
        return new Card(uniqueId, template.name, template.cost, { ...template.effect });
      }
      randomNum -= template.weight;
    }
  }

  drawCard(count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.hand.length < 10) {
        this.hand.push(this.generateRandomCard());
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp < 0) {
      this.hp = 0;
    }
  }

  refreshMana() {
    this.maxMana = 3;
    this.mana = 3;
  }
}

module.exports = Player;