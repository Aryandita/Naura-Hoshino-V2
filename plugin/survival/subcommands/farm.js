"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");

const UserFarm = require("../../../src/models/UserFarm");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const {
  safeParseInventory,
} = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const itemsConfig = require("../../../src/survival/data/items");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const COLLECTOR_MS = 120000;
const MAX_OPTIONS = 25;

// Kapasitas lahan per properti.
const PLOT_CAPACITY = {
  kos: 2,
  prop_kos: 2,
  rumah: 6,
  prop_rumah: 6,
  mansion: 12,
  prop_mansion: 12,
};

const GROW_DAYS = { wheat: 1, potato: 2, apple: 3 };

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function ephemeral(content) {
  return { content, flags: MessageFlags.Ephemeral };
}

function addItem(inventory, id, name, amount) {
  const exist = inventory.find((it) => it && it.id === id);
  if (exist) exist.amount = (exist.amount || 1) + amount;
  else inventory.push({ id, name, amount, type: "material" });
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    if (survival.currentLocation === "prison")
      return ui.sendError(interaction, "err_sys_43", true);

    // Model menyimpan properti di `propertyId`, bukan `property`, dan hari
    // in-game ada di `inGameDay`. Nama lama membuat panen tidak pernah siap.
    const prop = survival.propertyId || "jalanan";
    const rpgState = survival.rpg_state || {};

    if (rpgState.house_seized)
      return ui.sendError(interaction, "err_sys_44", true);
    if (prop === "jalanan")
      return ui.sendError(interaction, "err_sys_45", true);

    const maxLahan = PLOT_CAPACITY[prop] || 0;
    if (maxLahan === 0) return ui.sendError(interaction, "err_sys_45", true);

    const currentDay = survival.inGameDay || 1;
    const [farmData] = await UserFarm.findOrCreate({
      where: { userId: user.id },
    });
    const plots = Array.isArray(farmData.plots) ? [...farmData.plots] : [];

    if (plots.length < maxLahan) {
      for (let i = plots.length; i < maxLahan; i++) {
        plots.push({ id: i, seed: null, plantedAtDay: null, harvestDay: null });
      }
      await UserFarm.update({ plots }, { where: { userId: user.id } });
    }

    const lines = [];
    const options = [];

    plots.slice(0, maxLahan).forEach((plot, index) => {
      if (!plot || !plot.seed) {
        lines.push(
          `${e("read", "\uD83D\uDFEB")} **Lahan ${index + 1}:** kosong dan tanahnya subur`,
        );
        options.push({
          label: `Tanam di Lahan ${index + 1}`,
          value: `plant_${index}`,
          description: "Bibit pertama di tasmu yang dipakai",
        });
        return;
      }

      if (currentDay >= (plot.harvestDay || 0)) {
        lines.push(
          `${e("cheers", "\uD83C\uDF3B")} **Lahan ${index + 1}:** ${plot.seed} sudah siap dipanen!`,
        );
        options.push({
          label: `Panen Lahan ${index + 1}`,
          value: `harvest_${index}`,
          description: String(plot.seed).substring(0, 100),
        });
        return;
      }

      const wait = (plot.harvestDay || 0) - currentDay;
      lines.push(
        `${e("sleepy", "\uD83C\uDF31")} **Lahan ${index + 1}:** ${plot.seed}, tunggu **${wait} hari** lagi`,
      );
    });

    const header = `**Properti:** ${prop} \u2022 **Kapasitas:** ${maxLahan} lahan \u2022 **Hari ke-${currentDay}**`;

    if (options.length === 0) {
      const waitPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Farming",
        title: `${e("happy", "\uD83C\uDFE1")} Kebun kamu`,
        iconURL: user.displayAvatarURL(),
        expression: "info",
        description: [
          header,
          "",
          lines.join("\n"),
          "",
          "Semua lahanmu sedang ditanami dan belum ada yang siap. Sabar ya, Naura ikut menunggu hari berganti sambil menyiram tanamannya!",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...waitPayload, embeds: [] });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("farm_select")
      .setPlaceholder("Mau mengelola lahan yang mana?")
      .addOptions(options.slice(0, MAX_OPTIONS));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const farmPayload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      authorName: "Naura Farming",
      title: `${e("happy", "\uD83C\uDFE1")} Kebun kamu`,
      iconURL: user.displayAvatarURL(),
      expression: "info",
      description: [
        header,
        "",
        lines.join("\n"),
        "",
        "Pilih lahannya di bawah ya, Naura bantu catat semuanya.",
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });

    const response = await interaction.editReply({
      ...farmPayload,
      embeds: [],
      components: [...farmPayload.components, row],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate().catch(() => {});

      const [action, rawIdx] = i.values[0].split("_");
      const plotIdx = Number.parseInt(rawIdx, 10);
      if (Number.isNaN(plotIdx) || !plots[plotIdx]) return;

      const profile = await cacheManager.getUserProfile(user.id);
      const inventory = safeParseInventory(profile.inventory);

      if (action === "plant") {
        const seed = inventory.find(
          (item) =>
            item && typeof item.id === "string" && item.id.startsWith("seed_"),
        );

        if (!seed) {
          return i
            .followUp(
              ephemeral(
                `${e("shy", "\uD83C\uDF31")} Kamu belum punya bibit di tas. Beli dulu di warung Pak Damar ya, Naura temani!`,
              ),
            )
            .catch(() => {});
        }

        const cropId = seed.id.replace("seed_", "");
        const growTime = GROW_DAYS[cropId] || 2;

        plots[plotIdx] = {
          id: plotIdx,
          seed: cropId,
          plantedAtDay: currentDay,
          harvestDay: currentDay + growTime,
        };

        if ((seed.amount || 1) > 1) seed.amount -= 1;
        else inventory.splice(inventory.indexOf(seed), 1);

        await cacheManager.updateUserProfile(user.id, { inventory });
        await UserFarm.update({ plots }, { where: { userId: user.id } });

        return i
          .followUp(
            ephemeral(
              `${e("cheers", "\uD83C\uDF31")} Bibit **${seed.name || cropId}** sudah Naura tanam di Lahan ${plotIdx + 1}. Panennya **${growTime} hari** lagi, ya!`,
            ),
          )
          .catch(() => {});
      }

      if (action === "harvest") {
        const cropId = plots[plotIdx].seed;
        if (!cropId) return;

        const cropObj = itemsConfig.find((it) => it.id === cropId);
        const cropName = cropObj ? cropObj.name : cropId;
        const amount = Math.floor(Math.random() * 2) + 2;

        addItem(inventory, cropId, cropName, amount);
        plots[plotIdx] = {
          id: plotIdx,
          seed: null,
          plantedAtDay: null,
          harvestDay: null,
        };

        // Lewat cacheManager supaya salinan cache tidak jadi basi.
        await cacheManager.updateUserProfile(user.id, { inventory });
        await UserFarm.update({ plots }, { where: { userId: user.id } });

        return i
          .followUp(
            ephemeral(
              `${e("impressed", "\uD83C\uDF3E")} Panennya berhasil! Kamu dapat **${amount}x ${cropName}** dari Lahan ${plotIdx + 1}. Naura sudah masukkan ke tasmu.`,
            ),
          )
          .catch(() => {});
      }
    });
  },
};
