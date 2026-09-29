// server/game/Player.js

class Player {
  /**
   * @param {string} id - 玩家唯一标识（由 WebSocket 连接分配）
   * @param {string} name - 玩家昵称
   */
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.hp = 100;              // 初始生命值
    this.mana = 10;             // 当前可用费用
    this.maxMana = 4;          // 本回合费用上限
    this.hand = [];            // 手牌数组（存放 Card 实例）
    this.deck = [];            // 牌库数组（存放 Card 实例）
  }

  // 承受伤害的基础方法
  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp < 0) {
      this.hp = 0;
    }
  }

  // 回合开始时增加费用上限并回满
  refreshMana(turnCount) {
    this.maxMana = Math.min(turnCount, 10); // 假设最高 10 费
    this.mana = this.maxMana;
  }
}

module.exports = Player;