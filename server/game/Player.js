// server/game/Player.js
const Card = require('./Card');

// 🎛️ 卡牌概率调音台（直接按 100 分之几的直觉去填 weight！）
// 当前总和刚好是 8 + 17 + 25 + 50 = 100（对应 1 : 2 : 3 : 6 比例）
// 以后加新牌直接往后添一行即可，系统会自动重算总和！
const CARD_POOL = [
  // 👑 传说控制卡（8% 概率）：2费，让对手下回合陷入沉睡
  { weight: 8,  name: '💤大睡', cost: 2, effect: { type: 'SLEEP', value: 8 } }, // value: 8 代表强行咬舌尖醒来要扣 8 血

  // 🌊 稀有干扰卡（17% 概率）：1费，限制对手下回合只有 6 秒
  { weight: 17, name: '🌊大水', cost: 1, effect: { type: 'FLOOD', value: 6 } },

  // ⚡ 主力核心卡（25% 概率）：2费，QTE 命中造成 25 伤
  { weight: 25, name: '⚡黑闪', cost: 2, effect: { type: 'BLACK_FLASH', value: 25 } },

  // 🔥 基础弹药卡（50% 概率）：1费，稳定 5 伤
  { weight: 50, name: '🔥炎弹', cost: 1, effect: { type: 'DAMAGE', value: 5 } },
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
    this.nextTurnTimeLimit = null; // 下回合是否被【大水】限制时间
    this.nextTurnSleep = false;    // 下回合是否中了【大睡】
  }

  // 按百倍权重随机生成一张牌
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