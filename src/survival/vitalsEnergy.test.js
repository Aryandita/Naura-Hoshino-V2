"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const survivalVitals = require("./helpers/survivalVitals");
const worldWeatherEngine = require("./engines/worldWeatherEngine");
const worldPulseEngine = require("./engines/worldPulseEngine");
const survivalUI = require("../utils/survivalUIHelper");

test("survivalVitals - calculateFoodEnergyBonus tiering scaling", () => {
  // Non-food / non-consumable
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({ id: "iron_ore", category: "material" }),
    0,
  );

  // Common / Tier 1 (+5)
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "apple",
      category: "consumable",
      rarity: "common",
    }),
    5,
  );
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "apple",
      category: "consumable",
      tier: 1,
    }),
    5,
  );

  // Rare / Tier 2 (+10)
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "berry_pie",
      category: "consumable",
      rarity: "rare",
    }),
    10,
  );
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "berry_pie",
      category: "consumable",
      tier: 2,
    }),
    10,
  );

  // Epic / Tier 3 (+18)
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "golden_apple",
      category: "consumable",
      rarity: "epic",
    }),
    18,
  );
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "golden_apple",
      category: "consumable",
      tier: 3,
    }),
    18,
  );

  // Legendary / Mythic / Tier 4+ (+25)
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "ambrosia",
      category: "consumable",
      rarity: "legendary",
    }),
    25,
  );
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "ambrosia",
      category: "consumable",
      rarity: "mythic",
    }),
    25,
  );
  assert.strictEqual(
    survivalVitals.calculateFoodEnergyBonus({
      id: "ambrosia",
      category: "consumable",
      tier: 4,
    }),
    25,
  );
});

test("worldWeatherEngine - getWeatherFlavorText context", () => {
  const chopRain = worldWeatherEngine.getWeatherFlavorText("HEAVY_RAIN", "chop");
  assert.ok(chopRain.includes("hujan"));
  assert.ok(!chopRain.includes("\u2014")); // No em-dash

  const mineSand = worldWeatherEngine.getWeatherFlavorText("SANDSTORM", "mine");
  assert.ok(mineSand.includes("gurun"));
  assert.ok(!mineSand.includes("\u2014"));

  const defaultClear = worldWeatherEngine.getWeatherFlavorText("CLEAR_SKY", "default");
  assert.ok(defaultClear.includes("Langit cerah"));
});

test("worldPulseEngine - getWorldPulse unified pulse", () => {
  const pulse = worldPulseEngine.getWorldPulse({
    regionId: "desa_sukamaju",
    action: "chop",
  });

  assert.ok(pulse.weather);
  assert.ok(pulse.pulseHeader);
  assert.ok(pulse.flavorText);
  assert.strictEqual(pulse.regionName, "Wilayah Lembah Sukamaju");
  assert.strictEqual(typeof pulse.staminaMultiplier, "number");
  assert.ok(!pulse.pulseHeader.includes("\u2014"));
});

test("survivalUIHelper - Patterns A, B, and C Components V2", () => {
  const mockUser = {
    id: "user123",
    displayName: "Hero",
    displayAvatarURL: () => "https://example.com/avatar.png",
  };
  const mockSurvival = {
    userId: "user123",
    hp: 95,
    stamina: 80,
    hunger: 70,
    thirst: 75,
    survival_level: 3,
    survival_xp: 150,
    starFragments: 1200,
    coupons: 5,
    inGameDay: 4,
    inGameHour: 10,
    currentLocation: "desa_sukamaju",
  };
  const mockProfile = {
    economy_wallet: 500,
  };

  // Pattern A: Status Dashboard Card
  const dashboardCard = survivalUI.buildStatusDashboardCard({
    user: mockUser,
    survival: mockSurvival,
    profile: mockProfile,
    activeBuffs: ["Semangat Membara (+10% XP)"],
  });
  assert.strictEqual(typeof dashboardCard, "object");
  assert.strictEqual(dashboardCard.flags, 32768);
  assert.ok(dashboardCard.components.length > 0);

  // Pattern B: Action Result Card
  const actionCard = survivalUI.buildActionResultCard({
    user: mockUser,
    action: "chop",
    title: "Pohonnya tumbang!",
    description: "Ayunan kapak berhasil merobohkan kayu besar.",
    itemsGained: [{ id: "wood", name: "Kayu", amount: 3, emoji: "🪵" }],
    weatherBonus: "Bonus Panen Tropis",
  });
  assert.strictEqual(typeof actionCard, "object");
  assert.strictEqual(actionCard.flags, 32768);
  assert.ok(actionCard.components.length > 0);

  // Pattern C: Danger Zone Card
  const dangerCard = survivalUI.buildDangerZoneCard({
    user: mockUser,
    title: "Peringatan Ancaman Abyss!",
    description: "Kedalaman gua ini memancarkan aura dingin mencekam.",
    threatLevel: "EKSTREM",
    dangerWarning: "Stamina terkuras 2x lebih cepat di zona ini.",
  });
  assert.strictEqual(typeof dangerCard, "object");
  assert.strictEqual(dangerCard.flags, 32768);
  assert.ok(dangerCard.components.length > 0);
});
