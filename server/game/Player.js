// server/game/Player.js

const SUITS = ['♠️', '♥️', '♣️', '♦️'];

const CARD_POOL = [
  { weight: 40, template: { name: '炎弹', cost: 1, effect: { type: 'DAMAGE', value: 5 } } },
  { weight: 20, template: { name: '黑闪', cost: 2, effect: { type: 'BLACK_FLASH', value: 25 } } },
  { weight: 15, template: { name: '魔术箱', cost: 2, effect: { type: 'MAGIC_BOX', value: 20 } } }, // 🌟 修复：魔术箱改为 2 费
  { weight: 15, template: { name: '大水', cost: 2, effect: { type: 'FLOOD', value: 6 } } },
  { weight: 10, template: { name: '大睡', cost: 2, effect: { type: 'SLEEP', value: 8 } } }
];

function getRandomCardTemplate() {
  const rand = Math.floor(Math.random() * 100);
  let sum = 0;
  for (const item of CARD_POOL) {
    sum += item.weight;
    if (rand < sum) return item.template;
  }
  return CARD_POOL[0].template; 
}

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.hp = 100;
    this.mana = 3;      // 🌟 修复：开局直接给 3 滴法力
    this.maxMana = 3;   // 🌟 修复：最大法力值固定为 3
    this.hand = [];
    
    this.nextTurnTimeLimit = null;
    this.nextTurnSkip = false; 
    this.isSleeping = false;   
    this.isStunned = false;    
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;
  }

  refreshMana() {
    this.mana = this.maxMana; // 🌟 修复：每回合直接回满 3 费，不再有成长机制
  }

  drawCard(count) {
    for (let i = 0; i < count; i++) {
      if (this.hand.length >= 10) break; 
      const template = getRandomCardTemplate();
      const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
      
      this.hand.push({
        id: Math.random().toString(36).substring(2, 9),
        name: template.name,
        cost: template.cost,
        effect: template.effect,
        suit: randomSuit 
      });
    }
  }
}

module.exports = Player;