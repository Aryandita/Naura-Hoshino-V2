// Lokasi: plugin/survival/subcommands/craft.js
"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const currency = require("../../../src/survival/engines/currency");
const helpers = require("../../../src/survival/helpers/craftHelpers");
const { listAvailable, getBlueprint } = require("../craftBlueprints");
const {
  SMELT_RECIPES,
  getSmeltRecipe,
  getUpgradePlan,
  isUpgradable,
} = require("../../../src/survival/data/craftingRecipes");
const actions = require("../../../src/survival/helpers/craftActions");

const COLLECTOR_MS = 180000;
const IMAGE_NAME = "crafting.png";
const MAX_OPTIONS = 25;
const e = helpers.e;

const MODES = {
  assemble: { label: "Rakit Sendiri", heading: "Meja Perakitan Naura" },
  smelt: { label: "Lebur di Tungku", heading: "Tungku Pandai Besi Bagas" },
  upgrade: { label: "Tingkatkan Alat", heading: "Tempa Naik Level" },
};

function modeRow(active) {
  const row = new ActionRowBuilder();
  for (const [key, meta] of Object.entries(MODES)) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("craft_mode_" + key)
        .setLabel(meta.label)
        .setStyle(key === active ? ButtonStyle.Primary : ButtonStyle.Secondary),
    );
  }
  return row;
}

function cut(text) {
  return String(text).slice(0, 100);
}

function costLabel(kind, amount) {
  const meta = currency.CURRENCIES[kind];
  return amount + " " + (meta ? meta.short : "");
}

function optionsFor(mode, inventory, unlocked) {
  if (mode === "assemble") {
    return listAvailable(unlocked).map((bp) => ({
      label: cut(bp.name),
      value: bp.id,
      description: cut(
        "Butuh " +
          bp.req.map((r) => r.amount + "x " + helpers.nameOf(r.id)).join(", "),
      ),
    }));
  }

  if (mode === "smelt") {
    return SMELT_RECIPES.slice(0, MAX_OPTIONS).map((recipe) => ({
      label: cut(helpers.nameOf(recipe.output.id)),
      value: recipe.id,
      description: cut(
        "Upah " +
          costLabel(recipe.currency, recipe.fee) +
          " - " +
          recipe.input
            .map((i) => i.amount + "x " + helpers.nameOf(i.id))
            .join(", "),
      ),
    }));
  }

  const seen = [];
  for (const entry of inventory) {
    const id = typeof entry === "string" ? entry : entry && entry.id;
    if (!id || !isUpgradable(id) || seen.some((opt) => opt.value === id))
      continue;
    const plan = getUpgradePlan(id);
    seen.push({
      label: cut(helpers.nameOf(id) + " jadi " + helpers.nameOf(plan.to)),
      value: id,
      description: cut("Biaya tempa " + costLabel(plan.currency, plan.cost)),
    });
  }
  return seen.slice(0, MAX_OPTIONS);
}

function pickRow(mode, options) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("craft_pick")
    .setPlaceholder(
      mode === "assemble"
        ? "Mau merakit apa hari ini?"
        : mode === "smelt"
          ? "Bahan apa yang mau dilebur?"
          : "Alat mana yang mau ditempa naik?",
    );

  if (options.length === 0) {
    menu.addOptions({
      label: "Belum ada pilihan",
      value: "none",
      description: "Naura belum menemukan resep yang cocok.",
    });
    menu.setDisabled(true);
  } else {
    menu.addOptions(options);
  }
  return new ActionRowBuilder().addComponents(menu);
}

// Kebutuhan tiap mode diseragamkan supaya kanvas dan aksinya memakai bentuk sama.
function planFor(mode, id) {
  if (mode === "assemble") {
    const bp = getBlueprint(id);
    if (!bp) return null;
    return { title: bp.name, desc: bp.desc, req: bp.req, cost: 0, kind: null };
  }

  if (mode === "smelt") {
    const recipe = getSmeltRecipe(id);
    if (!recipe) return null;
    return {
      title: helpers.nameOf(recipe.output.id) + " x" + recipe.output.amount,
      desc: "Bagas mengipasi tungkunya sampai membara. Bahan olahan selalu jauh lebih bernilai daripada bahan mentahnya, lho!",
      req: recipe.input,
      cost: recipe.fee,
      kind: recipe.currency,
    };
  }

  const plan = getUpgradePlan(id);
  if (!plan) return null;
  return {
    title: helpers.nameOf(plan.from) + " menjadi " + helpers.nameOf(plan.to),
    desc:
      "Alat lamanya ikut dilebur, jadi Naura minta kamu yakin dulu. Bahan intinya " +
      helpers.nameOf(plan.coreId) +
      ", sesuai jenis bahan alatmu.",
    req: plan.materials,
    cost: plan.cost,
    kind: plan.currency,
  };
}

async function detailPayload(mode, id, inventory, holders) {
  const plan = planFor(mode, id);
  if (!plan) return null;

  const check = helpers.checkMaterials(inventory, plan.req);
  const affordable =
    plan.cost === 0 || currency.canAfford(plan.kind, holders, plan.cost);
  const ready = check.ok && affordable;

  const buffer = await helpers.createCraftingCanvas({
    heading: MODES[mode].heading,
    target: plan.title,
    lines: check.lines,
    ready,
    note: !check.ok
      ? "Bahannya masih kurang, ya. Naura tunggu, kok."
      : !affordable
        ? "Bahannya lengkap, tapi uangnya belum cukup."
        : null,
  });

  const costText =
    plan.cost > 0
      ? "\n" +
        e("coin", "\ud83e\ude99") +
        " Upah tempa: " +
        currency.format(plan.kind, plan.cost)
      : "";
  const payload = buildContainerV2({
    accentColorHex: ready ? ui.getColor("success") : ui.getColor("warning"),
    authorName: "Naura Crafting Guide",
    expression: ready ? "cheers" : "thinking",
    title: e("craft_table", "\ud83d\udd28") + " " + plan.title,
    description:
      plan.desc +
      costText +
      "\n" +
      e("sleepy", "\ud83d\ude34") +
      " Stamina terpakai: " +
      (mode === "assemble"
        ? actions.STAMINA_ASSEMBLE
        : mode === "smelt"
          ? actions.STAMINA_SMELT
          : actions.STAMINA_UPGRADE),
    bannerAttachmentName: IMAGE_NAME,
    footerText: ui.getFooter("survival"),
  });

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("craft_do")
      .setLabel(ready ? "Kerjakan Sekarang" : "Belum Bisa")
      .setStyle(ready ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(!ready),
    new ButtonBuilder()
      .setCustomId("craft_cancel")
      .setLabel("Selesai Dulu")
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    payload,
    attachment: new AttachmentBuilder(buffer, { name: IMAGE_NAME }),
    confirmRow,
  };
}

function failText(result) {
  if (result.reason === "materials")
    return (
      "Bahannya kurang: " +
      helpers.missingText(result.check.lines) +
      ". Naura bantu cari lagi, yuk!"
    );
  if (result.reason === "money")
    return (
      "Upah tempanya belum cukup. Butuh " +
      currency.format(result.kind, result.need) +
      ", punyamu " +
      currency.format(result.kind, result.balance) +
      "."
    );
  if (result.reason === "no_tool")
    return "Alat yang mau ditempa sudah tidak ada di tasmu, ya?";
  return "Naura bingung dengan resep itu. Coba pilih yang lain, ya.";
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    if (survival.currentLocation === "prison")
      return ui.sendError(interaction, "err_sys_37", true);
    if ((survival.stamina || 0) <= 10)
      return ui.sendError(interaction, "err_sys_38", true);

    let profile = await cacheManager.getUserProfile(user.id);
    let inventory = safeParseInventory(profile.inventory);
    const rpgState = survival.rpg_state || {};
    const unlocked = rpgState.unlocked_recipes || [];

    let mode = "assemble";
    let selected = null;

    const intro = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      authorName: "Naura Crafting Guide",
      expression: "happy",
      title: e("craft_table", "\ud83d\udd28") + " Meja Perakitan Naura",
      description:
        "Selamat datang di sudut kerja Naura! Di sini kamu bisa merakit barang dasar, menitipkan bahan mentah ke tungku Bagas biar jadi lebih bernilai, atau menempa alat lamamu supaya naik level.\n\nPilih dulu mau yang mana, ya.",
      footerText: ui.getFooter("survival"),
    });

    const options = optionsFor(mode, inventory, unlocked);
    const message = await interaction.editReply({
      ...intro,
      components: [...intro.components, modeRow(mode), pickRow(mode, options)],
    });

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      try {
        await i.deferUpdate();

        if (i.customId.startsWith("craft_mode_")) {
          mode = i.customId.replace("craft_mode_", "");
          selected = null;
          profile = await cacheManager.getUserProfile(user.id);
          inventory = safeParseInventory(profile.inventory);
          const list = optionsFor(mode, inventory, unlocked);
          return i.editReply({
            ...intro,
            files: [],
            components: [
              ...intro.components,
              modeRow(mode),
              pickRow(mode, list),
            ],
          });
        }

        if (i.customId === "craft_pick") {
          if (i.values[0] === "none") return;
          selected = i.values[0];
          profile = await cacheManager.getUserProfile(user.id);
          inventory = safeParseInventory(profile.inventory);
          const detail = await detailPayload(mode, selected, inventory, {
            survival,
            profile,
          });
          if (!detail) return;
          const list = optionsFor(mode, inventory, unlocked);
          return i.editReply({
            ...detail.payload,
            files: [detail.attachment],
            components: [
              ...detail.payload.components,
              modeRow(mode),
              pickRow(mode, list),
              detail.confirmRow,
            ],
          });
        }

        if (i.customId === "craft_do") {
          if (!selected) return;
          profile = await cacheManager.getUserProfile(user.id);
          await survival.reload();

          const args = {
            userId: user.id,
            survival,
            profile,
            blueprintId: selected,
            outputId: selected,
            fromId: selected,
          };
          const result =
            mode === "assemble"
              ? await actions.assemble(args)
              : mode === "smelt"
                ? await actions.smelt(args)
                : await actions.upgrade(args);

          if (!result.ok) {
            return i.followUp({
              ...buildErrorContainerV2({
                errorMessage: failText(result),
                footerText: ui.getFooter("survival"),
              }),
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
          }

          const extra = result.cost
            ? "\nBiaya tempa " +
              currency.format(result.kind, result.cost) +
              ", sisa " +
              currency.format(result.kind, result.balance) +
              "."
            : result.fee
              ? "\nUpah untuk Bagas " +
                currency.format(result.kind, result.fee) +
                ", sisa " +
                currency.format(result.kind, result.balance) +
                "."
              : "";
          const opening =
            mode === "upgrade"
              ? result.fromName +
                " kamu naik jadi **" +
                result.name +
                "**! Naura ikut senang banget!"
              : "Berhasil! Kamu dapat **" +
                result.name +
                " x" +
                result.amount +
                "**. Naura simpan rapi di tasmu, ya.";

          const done = buildContainerV2({
            accentColorHex: ui.getColor("success"),
            authorName: "Naura Crafting Guide",
            expression: "success",
            title: e("success", "\u2705") + " Tempaan Selesai!",
            description: opening + extra,
            footerText: ui.getFooter("survival"),
          });

          selected = null;
          profile = await cacheManager.getUserProfile(user.id);
          inventory = safeParseInventory(profile.inventory);
          const list = optionsFor(mode, inventory, unlocked);
          return i.editReply({
            ...done,
            files: [],
            components: [
              ...done.components,
              modeRow(mode),
              pickRow(mode, list),
            ],
          });
        }

        if (i.customId === "craft_cancel") {
          const bye = buildContainerV2({
            accentColorHex: ui.getColor("info"),
            authorName: "Naura Crafting Guide",
            expression: "shy",
            title: "Sampai nanti, ya!",
            description:
              "Naura bereskan dulu mejanya. Kalau butuh menempa lagi, panggil Naura kapan pun.",
            footerText: ui.getFooter("survival"),
          });
          await i.editReply({ ...bye, files: [] });
          return collector.stop("done");
        }
      } catch (err) {
        collector.stop("error");
      }
    });
  },
};
