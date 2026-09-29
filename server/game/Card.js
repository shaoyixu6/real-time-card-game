// server/game/Card.js

class Card {
  /**
   * @param {string} id - 卡牌唯一编号，比如 'card_001'
   * @param {string} name - 卡牌名称，比如 'Fireball'
   * @param {number} cost - 打出该牌消耗的费用，比如 3
   * @param {object} effect - 卡牌效果数据包，比如 { type: 'DAMAGE', value: 6 }
   */
  constructor(id, name, cost, effect) {
    this.id = id;
    this.name = name;
    this.cost = cost;
    this.effect = effect;
  }
}

// 导出类供其他模块 require 使用（Node.js 标准 CommonJS 规范）
module.exports = Card;