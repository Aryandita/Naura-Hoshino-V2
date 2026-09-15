"use strict";

// Tiga aksi tempa yang dipakai subcommand craft. Semuanya memvalidasi ulang
// bahan tepat sebelum memotongnya, jadi tombol yang ditekan dua kali tidak bisa
// menghasilkan barang gratis.

const cacheManager = require("../../managers/cacheManager");
const { safeParseInventory } = require("../engines/inventoryHelper");
const currency = require("../engines/currency");
const { getSmeltRecipe, getUpgradePlan } = require("../data/craftingRecipes");
const { getBlueprint } = require("../data/craftBlueprints");
const helpers = require("./craftHelpers");
const { advanceTime } = require("./survivalTime");

const STAMINA_ASSEMBLE = 10;
const STAMINA_SMELT = 8;
const STAMINA_UPGRADE = 15;

const HOURS_ASSEMBLE = 1;
const HOURS_SMELT = 2;
const HOURS_UPGRADE = 3;

async function spendStamina(userId, survival, cost) {
  const next = Math.max(0, (survival.stamina || 0) - cost);
  await cacheManager.updateUserSurvival(userId, { stamina: next });
  survival.stamina = next;
}

async function saveInventory(userId, inventory) {
  await cacheManager.mutateUserProfileJson(
    userId,
    "inventory",
    () => inventory,
  );
}

async function bumpQuest(userId) {
  try {
    const { incrementQuestProgress } = require("../engines/questGenerator");
    await incrementQuestProgress(userId, "craft");
  } catch (err) {
    // Misi harian bersifat pelengkap; kegagalannya tidak boleh membatalkan tempa.
  }
}

// Merakit barang dasar. Tidak ada biaya uang, hanya bahan, stamina, dan waktu.
async function assemble({ userId, survival, profile, blueprintId }) {
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) return { ok: false, reason: "unknown" };

  const inventory = safeParseInventory(profile.inventory);
  const check = helpers.checkMaterials(inventory, blueprint.req);
  if (!check.ok) return { ok: false, reason: "materials", check };

  if (!helpers.takeAll(inventory, blueprint.req))
    return { ok: false, reason: "materials", check };

  const amount = blueprint.amount || 1;
  helpers.addItem(inventory, blueprint.id, amount);

  await saveInventory(userId, inventory);
  await spendStamina(userId, survival, STAMINA_ASSEMBLE);
  await advanceTime(userId, HOURS_ASSEMBLE);
  await bumpQuest(userId);

  try {
    const seasonEngine = require("../../services/seasonEngine");
    await seasonEngine.addSeasonXp(userId, 15);
  } catch (err) {}

  return { ok: true, itemId: blueprint.id, name: blueprint.name, amount };
}

// Peleburan di tungku Bagas. Upah tempa dibayar sesuai mata uang resepnya
// (Naura Star Fragment, karena tungkunya berada di desa).
async function smelt({ userId, survival, profile, outputId }) {
  const recipe = getSmeltRecipe(outputId);
  if (!recipe) return { ok: false, reason: "unknown" };

  const currentLevel = survival.survival_level || survival.level || 1;
  if (recipe.reqLevel && currentLevel < recipe.reqLevel) {
    return {
      ok: false,
      reason: "level",
      needLevel: recipe.reqLevel,
      currentLevel,
    };
  }

  if (recipe.reqStat) {
    const userStatVal = survival[recipe.reqStat.stat] || 0;
    if (userStatVal < recipe.reqStat.value) {
      return {
        ok: false,
        reason: "stat",
        stat: recipe.reqStat.stat,
        needValue: recipe.reqStat.value,
        currentValue: userStatVal,
      };
    }
  }

  const inventory = safeParseInventory(profile.inventory);
  const check = helpers.checkMaterials(inventory, recipe.input);
  if (!check.ok) return { ok: false, reason: "materials", check };

  const holders = { survival, profile };
  if (!currency.canAfford(recipe.currency, holders, recipe.fee)) {
    return {
      ok: false,
      reason: "money",
      need: recipe.fee,
      kind: recipe.currency,
      balance: currency.balanceOf(recipe.currency, holders),
    };
  }

  if (!helpers.takeAll(inventory, recipe.input))
    return { ok: false, reason: "materials", check };

  const balance = await currency.charge(recipe.currency, holders, recipe.fee);
  if (balance === null)
    return {
      ok: false,
      reason: "money",
      need: recipe.fee,
      kind: recipe.currency,
      balance: 0,
    };

  helpers.addItem(inventory, recipe.output.id, recipe.output.amount);

  await saveInventory(userId, inventory);
  await spendStamina(userId, survival, STAMINA_SMELT);
  await advanceTime(userId, HOURS_SMELT);
  await bumpQuest(userId);

  try {
    const seasonEngine = require("../../services/seasonEngine");
    await seasonEngine.addSeasonXp(userId, 20);
  } catch (err) {}

  return {
    ok: true,
    itemId: recipe.output.id,
    name: helpers.nameOf(recipe.output.id),
    amount: recipe.output.amount,
    fee: recipe.fee,
    kind: recipe.currency,
    balance,
  };
}

// Naik level alat: alat lama ikut terpakai, bahan inti sesuai jenis bahannya,
// ditambah bahan sekunder dan biaya tempa.
async function upgrade({ userId, survival, profile, fromId }) {
  const plan = getUpgradePlan(fromId);
  if (!plan) return { ok: false, reason: "unknown" };

  const inventory = safeParseInventory(profile.inventory);
  if (helpers.countItem(inventory, fromId) < 1)
    return { ok: false, reason: "no_tool" };

  const check = helpers.checkMaterials(inventory, plan.materials);
  if (!check.ok) return { ok: false, reason: "materials", check };

  const holders = { survival, profile };
  if (!currency.canAfford(plan.currency, holders, plan.cost)) {
    return {
      ok: false,
      reason: "money",
      need: plan.cost,
      kind: plan.currency,
      balance: currency.balanceOf(plan.currency, holders),
    };
  }

  if (!helpers.takeAll(inventory, plan.materials))
    return { ok: false, reason: "materials", check };
  if (!helpers.takeItem(inventory, fromId, 1))
    return { ok: false, reason: "no_tool" };

  const balance = await currency.charge(plan.currency, holders, plan.cost);
  if (balance === null)
    return {
      ok: false,
      reason: "money",
      need: plan.cost,
      kind: plan.currency,
      balance: 0,
    };

  helpers.addItem(inventory, plan.to, 1);

  await saveInventory(userId, inventory);
  await spendStamina(userId, survival, STAMINA_UPGRADE);
  await advanceTime(userId, HOURS_UPGRADE);
  await bumpQuest(userId);

  try {
    const seasonEngine = require("../../services/seasonEngine");
    await seasonEngine.addSeasonXp(userId, 30);
  } catch (err) {}

  return {
    ok: true,
    itemId: plan.to,
    fromName: helpers.nameOf(plan.from),
    name: helpers.nameOf(plan.to),
    amount: 1,
    cost: plan.cost,
    kind: plan.currency,
    balance,
  };
}

module.exports = {
  STAMINA_ASSEMBLE,
  STAMINA_SMELT,
  STAMINA_UPGRADE,
  assemble,
  smelt,
  upgrade,
};
