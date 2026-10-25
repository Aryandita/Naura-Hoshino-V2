"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CLASS_BONUS,
  SKILLS,
  lootName,
  enemyFor,
  rollLoot,
  rewardsFor,
  resolveAttack,
  enemyDamage,
} = require("../../src/survival/engines/dungeonCombat");

const {
  BASE_HP,
  HP_PER_LEVEL,
  MIN_HP_AFTER,
  MIN_STAMINA_AFTER,
  bonusFor,
  maxHpFor,
  basicAttack,
  useSkill,
  narrate,
  calculateElo,
} = require("../../src/survival/engines/duelEngine");

test.describe("DungeonCombat Engine", () => {
  test.describe("CLASS_BONUS constants", () => {
    test("should have correct warrior bonus", () => {
      assert.equal(CLASS_BONUS.warrior.maxHp, 50);
      assert.equal(CLASS_BONUS.warrior.strength, 5);
      assert.equal(CLASS_BONUS.warrior.agility, 0);
    });

    test("should have correct mage bonus", () => {
      assert.equal(CLASS_BONUS.mage.intelligence, 8);
      assert.equal(CLASS_BONUS.mage.agility, 3);
      assert.equal(CLASS_BONUS.mage.maxHp, 0);
    });

    test("should have correct assassin bonus", () => {
      assert.equal(CLASS_BONUS.assassin.agility, 8);
      assert.equal(CLASS_BONUS.assassin.luck, 5);
    });

    test("should have correct ranger bonus", () => {
      assert.equal(CLASS_BONUS.ranger.agility, 5);
      assert.equal(CLASS_BONUS.ranger.luck, 8);
    });
  });

  test.describe("SKILLS configuration", () => {
    test("should have skill for each class", () => {
      assert.ok(SKILLS.warrior);
      assert.ok(SKILLS.mage);
      assert.ok(SKILLS.assassin);
      assert.ok(SKILLS.ranger);
    });

    test("warrior skill should be Iron Slash with cost 15", () => {
      assert.equal(SKILLS.warrior.name, "Iron Slash");
      assert.equal(SKILLS.warrior.cost, 15);
    });

    test("mage skill should be Fireball with cost 25", () => {
      assert.equal(SKILLS.mage.name, "Fireball");
      assert.equal(SKILLS.mage.cost, 25);
    });
  });

  test.describe("lootName()", () => {
    test("should return known name for demon_horn", () => {
      const name = lootName("demon_horn");
      assert.equal(name, "Tanduk Iblis");
    });

    test("should return known name for dragon_scale", () => {
      const name = lootName("dragon_scale");
      assert.equal(name, "Sisik Naga");
    });

    test("should return id for unknown item", () => {
      const name = lootName("unknown_item_xyz");
      assert.equal(name, "unknown_item_xyz");
    });
  });

  test.describe("enemyFor()", () => {
    test("should create slime for floor 1", () => {
      const enemy = enemyFor(1, null);
      assert.equal(enemy.type, "slime");
      assert.ok(!enemy.isBoss);
      assert.ok(enemy.maxHp > 0);
    });

    test("should create boss every 10 floors", () => {
      const enemy10 = enemyFor(10, null);
      assert.ok(enemy10.isBoss);
      assert.equal(enemy10.type, "demon");

      const enemy20 = enemyFor(20, null);
      assert.ok(enemy20.isBoss);
    });

    test("should create goblin for floor 11-20", () => {
      const enemy = enemyFor(15, null);
      assert.equal(enemy.type, "goblin");
      assert.ok(!enemy.isBoss);
    });

    test("should create dragon for floor > 20", () => {
      const enemy = enemyFor(25, null);
      assert.equal(enemy.type, "dragon");
    });

    test("should scale HP with multiplier", () => {
      const normal = enemyFor(10, null, 1);
      const doubled = enemyFor(10, null, 2);
      assert.equal(doubled.maxHp, normal.maxHp * 2);
    });

    test("should apply extreme difficulty multiplier", () => {
      const normal = enemyFor(10, null);
      const extreme = enemyFor(10, { extreme: true });
      assert.ok(extreme.maxHp > normal.maxHp);
    });

    test("should add special tag for multiplier > 1", () => {
      const enemy = enemyFor(5, null, 2);
      assert.ok(enemy.special);
      assert.ok(enemy.name.includes("Segel Spesial"));
    });
  });

  test.describe("rollLoot()", () => {
    test("should return array of loot items", () => {
      const loot = rollLoot(5, 10, 1);
      assert.ok(Array.isArray(loot));
    });

    test("should include mega_potion for boss floor (100% chance)", () => {
      let foundMegaPotion = false;
      for (let i = 0; i < 10; i++) {
        const loot = rollLoot(10, 10, 1);
        if (loot.some((item) => item.id === "mega_potion")) {
          foundMegaPotion = true;
          break;
        }
      }
      assert.ok(foundMegaPotion, "mega_potion should drop from boss");
    });

    test("should stack items based on multiplier", () => {
      const loot = rollLoot(10, 10, 3);
      for (const item of loot) {
        assert.equal(item.amount, 3);
      }
    });

    test("should increase drop rate with luck", () => {
      const lowLuckDrops = [];
      const highLuckDrops = [];

      for (let i = 0; i < 20; i++) {
        lowLuckDrops.push(rollLoot(5, 1, 1).length);
        highLuckDrops.push(rollLoot(5, 50, 1).length);
      }

      const avgLow = lowLuckDrops.reduce((a, b) => a + b, 0) / 20;
      const avgHigh = highLuckDrops.reduce((a, b) => a + b, 0) / 20;
      assert.ok(avgHigh >= avgLow, "Higher luck should give more drops on average");
    });
  });

  test.describe("rewardsFor()", () => {
    test("should give more rewards for boss floors", () => {
      const normalReward = rewardsFor(5, null);
      const bossReward = rewardsFor(10, null);
      assert.ok(bossReward.money > normalReward.money);
      assert.ok(bossReward.xp > normalReward.xp);
    });

    test("should scale with multiplier", () => {
      const normal = rewardsFor(10, null, 1);
      const doubled = rewardsFor(10, null, 2);
      assert.equal(doubled.money, normal.money * 2);
      assert.equal(doubled.xp, normal.xp * 2);
    });

    test("should apply coin and exp multipliers from diffConfig", () => {
      const config = { coinMultiplier: 2, expMultiplier: 1.5 };
      const reward = rewardsFor(10, config);
      const base = rewardsFor(10, null);
      assert.equal(reward.money, base.money * 2);
      assert.equal(reward.xp, Math.floor(base.xp * 1.5));
    });
  });

  test.describe("resolveAttack()", () => {
    const mockStats = {
      userClass: "warrior",
      skill: SKILLS.warrior,
      weaponDmg: 100,
      strength: 10,
      agility: 5,
      intelligence: 5,
      luck: 5,
      synergy: { hasSynergy: false, multiplier: 1.0 },
    };

    const mockProfile = { weapon_level: 5 };

    test("should deal damage without skill", () => {
      const result = resolveAttack({ useSkill: false, stats: mockStats, profile: mockProfile });
      assert.ok(result.damage > 0);
      assert.equal(result.cost, 0);
      assert.ok(result.log.includes("damage"));
    });

    test("should deal more damage with warrior skill", () => {
      const normalHits = [];
      const skillHits = [];

      for (let i = 0; i < 20; i++) {
        normalHits.push(resolveAttack({ useSkill: false, stats: mockStats, profile: mockProfile }).damage);
        skillHits.push(resolveAttack({ useSkill: true, stats: mockStats, profile: mockProfile }).damage);
      }

      const avgNormal = normalHits.reduce((a, b) => a + b, 0) / 20;
      const avgSkill = skillHits.reduce((a, b) => a + b, 0) / 20;
      assert.ok(avgSkill > avgNormal, "Skill should deal more damage on average");
    });

    test("should consume stamina when using skill", () => {
      const result = resolveAttack({ useSkill: true, stats: mockStats, profile: mockProfile });
      assert.equal(result.cost, SKILLS.warrior.cost);
    });

    test("mage should use intelligence for magic damage", () => {
      const mageStats = { ...mockStats, userClass: "mage", skill: SKILLS.mage, intelligence: 20 };
      const result = resolveAttack({ useSkill: true, stats: mageStats, profile: mockProfile });
      assert.ok(result.log.includes("Fireball"));
      assert.ok(result.damage > 0);
    });
  });

  test.describe("enemyDamage()", () => {
    test("should deal more damage for boss", () => {
      const damages = [];
      const bossDamages = [];

      for (let i = 0; i < 20; i++) {
        damages.push(enemyDamage(10, false, null));
        bossDamages.push(enemyDamage(10, true, null));
      }

      const avgNormal = damages.reduce((a, b) => a + b, 0) / 20;
      const avgBoss = bossDamages.reduce((a, b) => a + b, 0) / 20;
      assert.ok(avgBoss > avgNormal, "Boss should deal more damage");
    });

    test("should scale with floor number", () => {
      const floor5 = enemyDamage(5, false, null);
      const floor50 = enemyDamage(50, false, null);
      assert.ok(floor50 > floor5);
    });

    test("should apply extreme difficulty multiplier", () => {
      const damages = [];
      const extremeDamages = [];

      for (let i = 0; i < 20; i++) {
        damages.push(enemyDamage(10, false, null));
        extremeDamages.push(enemyDamage(10, false, { extreme: true }));
      }

      const avgNormal = damages.reduce((a, b) => a + b, 0) / 20;
      const avgExtreme = extremeDamages.reduce((a, b) => a + b, 0) / 20;
      assert.ok(avgExtreme > avgNormal);
    });
  });
});

test.describe("DuelEngine", () => {
  test.describe("bonusFor()", () => {
    test("should return warrior bonus", () => {
      const bonus = bonusFor("warrior");
      assert.equal(bonus.maxHp, 50);
      assert.equal(bonus.strength, 5);
    });

    test("should return empty object for unknown class", () => {
      const bonus = bonusFor("unknown");
      assert.deepEqual(bonus, {});
    });

    test("should return empty object for null", () => {
      const bonus = bonusFor(null);
      assert.deepEqual(bonus, {});
    });
  });

  test.describe("maxHpFor()", () => {
    test("should calculate HP based on level", () => {
      const survival = { survival_level: 10 };
      const hp = maxHpFor(survival, {});
      assert.equal(hp, BASE_HP + 10 * HP_PER_LEVEL);
    });

    test("should add class bonus HP", () => {
      const survival = { survival_level: 10 };
      const hp = maxHpFor(survival, { maxHp: 50 });
      assert.equal(hp, BASE_HP + 10 * HP_PER_LEVEL + 50);
    });

    test("should default to level 1 for missing level", () => {
      const survival = {};
      const hp = maxHpFor(survival, {});
      assert.equal(hp, BASE_HP + HP_PER_LEVEL);
    });
  });

  test.describe("basicAttack()", () => {
    test("should deal damage to target", () => {
      const attacker = {
        weaponDmg: 100,
        stamina: 50,
        agility: 10,
        luck: 10,
        petBuffs: {},
      };
      const target = { hp: 200, agility: 5, petBuffs: {} };

      const results = [];
      for (let i = 0; i < 20; i++) {
        const t = { ...target, hp: 200 };
        const result = basicAttack({ ...attacker }, t);
        results.push(result);
      }

      const hits = results.filter((r) => !r.dodged);
      assert.ok(hits.length > 0, "Should land some hits");
      assert.ok(hits.every((r) => r.damage > 0));
    });

    test("should allow dodge based on agility", () => {
      const attacker = { weaponDmg: 100, stamina: 50, agility: 5, luck: 5, petBuffs: {} };
      const target = { hp: 200, agility: 30, petBuffs: { dodge: 15 } };

      let dodged = false;
      for (let i = 0; i < 200; i++) {
        const result = basicAttack({ ...attacker }, { ...target, hp: 200 });
        if (result.dodged) {
          dodged = true;
          break;
        }
      }
      assert.ok(dodged, "High agility target should dodge sometimes");
    });

    test("should restore stamina on attack", () => {
      const attacker = { weaponDmg: 100, stamina: 50, agility: 10, luck: 10, petBuffs: {} };
      const target = { hp: 200, agility: 5, petBuffs: {} };

      basicAttack(attacker, target);
      assert.ok(attacker.stamina > 50);
    });
  });

  test.describe("useSkill()", () => {
    test("should fail without class", () => {
      const attacker = { skill: null, stamina: 100 };
      const target = { hp: 200 };

      const result = useSkill(attacker, target);
      assert.ok(!result.ok);
      assert.equal(result.reason, "no_class");
    });

    test("should fail without enough stamina", () => {
      const attacker = {
        skill: { name: "Test", staminaCost: 50, multiplier: 1.5, kind: "physical" },
        stamina: 30,
        synergy: { hasSynergy: false },
      };
      const target = { hp: 200 };

      const result = useSkill(attacker, target);
      assert.ok(!result.ok);
      assert.equal(result.reason, "no_stamina");
    });

    test("should consume stamina on successful skill", () => {
      const attacker = {
        skill: { name: "Test", staminaCost: 20, multiplier: 1.5, kind: "physical" },
        stamina: 50,
        weaponDmg: 100,
        synergy: { hasSynergy: false },
      };
      const target = { hp: 200, agility: 5, petBuffs: {} };

      const result = useSkill(attacker, target);
      assert.ok(result.ok);
      assert.equal(attacker.stamina, 30);
    });

    test("magic skill should use intelligence", () => {
      const attacker = {
        skill: { name: "Fireball", staminaCost: 25, multiplier: 1.1, kind: "magic" },
        stamina: 100,
        intelligence: 30,
        weaponDmg: 50,
        synergy: { hasSynergy: false },
      };
      const target = { hp: 200, agility: 5, petBuffs: {} };

      const result = useSkill(attacker, target);
      assert.ok(result.ok);
      assert.ok(result.damage > 0);
    });
  });

  test.describe("calculateElo()", () => {
    test("should give positive change to winner", () => {
      const result = calculateElo(1200, 1200);
      assert.ok(result.winnerDiff > 0);
      assert.ok(result.loserDiff < 0);
    });

    test("should give less points for beating lower rated opponent", () => {
      const beatLower = calculateElo(1500, 1200);
      const beatEqual = calculateElo(1200, 1200);
      assert.ok(beatLower.winnerDiff < beatEqual.winnerDiff);
    });

    test("should give more points for beating higher rated opponent", () => {
      const beatHigher = calculateElo(1200, 1500);
      const beatEqual = calculateElo(1200, 1200);
      assert.ok(beatHigher.winnerDiff > beatEqual.winnerDiff);
    });
  });

  test.describe("narrate()", () => {
    test("should narrate basic attack hit", () => {
      const active = { username: "Player1" };
      const target = { username: "Player2" };
      const result = { damage: 50, dodged: false, crit: false };

      const text = narrate(active, target, result);
      assert.ok(text.includes("Player1"));
      assert.ok(text.includes("Player2"));
      assert.ok(text.includes("50"));
    });

    test("should narrate critical hit", () => {
      const active = { username: "Player1" };
      const target = { username: "Player2" };
      const result = { damage: 100, dodged: false, crit: true };

      const text = narrate(active, target, result);
      assert.ok(text.includes("KRITIKAL"));
    });

    test("should narrate dodge", () => {
      const active = { username: "Player1" };
      const target = { username: "Player2" };
      const result = { damage: 0, dodged: true };

      const text = narrate(active, target, result);
      assert.ok(text.includes("menghindar"));
    });

    test("should narrate skill usage", () => {
      const active = { username: "Player1" };
      const target = { username: "Player2" };
      const result = { skill: { name: "Iron Slash" }, damage: 80, dodged: false };

      const text = narrate(active, target, result);
      assert.ok(text.includes("Iron Slash"));
    });
  });

  test.describe("Constants", () => {
    test("MIN_HP_AFTER should be 20", () => {
      assert.equal(MIN_HP_AFTER, 20);
    });

    test("MIN_STAMINA_AFTER should be 20", () => {
      assert.equal(MIN_STAMINA_AFTER, 20);
    });

    test("BASE_HP should be 100", () => {
      assert.equal(BASE_HP, 100);
    });

    test("HP_PER_LEVEL should be 20", () => {
      assert.equal(HP_PER_LEVEL, 20);
    });
  });
});
