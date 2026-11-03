// server/game/Player.js

const SUITS = ['♠️', '♥️', '♣️', '♦️'];

const CARD_POOL = [
  // 40% 基础牌：保证每回合有费能打，且有充足的低费牌作为魔术箱的祭品
  { weight: 40, template: { name: '炎弹', cost: 1, effect: { type: 'DAMAGE', value: 5 } } },
  
  // 14% 强攻牌：QTE爆发
  { weight: 14, template: { name: '黑闪', cost: 2, effect: { type: 'BLACK_FLASH', value: 25 } } },
  
  // 11% 软控牌：限制对方时间
  { weight: 11, template: { name: '大水', cost: 2, effect: { type: 'FLOOD', value: 6 } } },
  
  // 10% 硬控牌：大睡是极强的连招起手，必须稀有
  { weight: 10, template: { name: '大睡', cost: 2, effect: { type: 'SLEEP', value: 8 } } },
  
  // 9% 脏牌：蛊毒能直接卡死对面2个手牌槽
  { weight: 9,  template: { name: '蛊毒', cost: 2, effect: { type: 'POISON' } } },
  
  // 8% 终极心理战：魔术箱
  { weight: 8,  template: { name: '魔术箱', cost: 2, effect: { type: 'MAGIC_BOX', value: 20 } } },

  // 🌟 8% 新增【生死判官】：黑箱盲狙对手手牌花色，零信息泄露！
  { weight: 8,  template: { name: '生死判官', cost: 2, effect: { type: 'JUDGE', value: 25, selfDmg: 10 } } }
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
    this.mana = 0;
    this.maxMana = 2;   // 🌟【机制】：初始上限为 2，第一回合系统自动+1，开局刚好 3 费
    this.hand = [];
    
    this.nextTurnTimeLimit = null;
    this.nextTurnSkip = false; 
    this.isSleeping = false;   
    this.isStunned = false;    
    // 🌟【新增】：花色连击系统状态
    this.streakSuit = null;      // 当前连击的花色
    this.streakCount = 0;        // 连击次数 (0~3)
    this.nextAttackDouble = false; // 黑桃专属 Buff：下次攻击伤害翻倍
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;
  }

  refreshMana() {
    // 🌟【机制】：每回合上限 +1，直到 5 费封顶！
    if (this.maxMana < 5) this.maxMana++;
    this.mana = this.maxMana;
  }

  drawCard(count, room = null) {
    for (let i = 0; i < count; i++) {
      if (this.hand.length >= 5) { // 🌟 严格限制上限 5 张！
        if (room && room.onAction) room.onAction({ type: 'CARD_BURNED', target: this.id });
        break; // 手牌满了，爆牌直接丢弃后续抽牌
      }
      
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