"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const gemEngine = require("../../../src/services/gemSocketEngine");
const {
  safeParseInventory,
  takeItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");

const COLLECTOR_MS = 60000;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

const SOCKETABLE_GEAR = [
  { id: "sword", name: "Pedang Petualang ⚔️", maxSockets: 3 },
  { id: "armor", name: "Zirah Perlindungan 🛡️", maxSockets: 3 },
  { id: "pickaxe", name: "Beliung Penambang ⛏️", maxSockets: 2 },
  { id: "fishing_rod", name: "Pancingan Sakti 🎣", maxSockets: 2 },
];

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const profile = await cacheManager.getUserProfile(user.id);
    const survival = await cacheManager.getUserSurvival(user.id);

    if (!profile || !survival) {
      return interaction.editReply(
        buildErrorContainerV2({
          errorMessage:
            "Data petualanganmu belum ditemukan. Mulai dulu dengan /survival start ya!",
          footerText: ui.getFooter("survival"),
        }),
      );
    }

    const inventory = safeParseInventory(profile.inventory);
    const rpgState = survival.rpg_state || {};
    const enchantedGear = rpgState.enchanted_gear || {};

    // Filter gem yang dimiliki user
    const availableGems = gemEngine.getAvailableGems();
    const userGems = [];
    for (const [gemId, gemDef] of Object.entries(availableGems)) {
      const found = inventory.find(
        (it) => it && (it.id === gemId || it.id === gemId.toLowerCase()),
      );
      if (found && (found.amount || 1) > 0) {
        userGems.push({
          id: gemId,
          name: gemDef.name,
          amount: found.amount || 1,
          description: gemDef.description,
        });
      }
    }

    const gearOverview = SOCKETABLE_GEAR.map((g) => {
      const gearData = enchantedGear[g.id] || { cosmic_sockets: [] };
      const socketCount = gearData.cosmic_sockets?.length || 0;
      const socketVisual = (gearData.cosmic_sockets || [])
        .map((s) => `[💎 ${s.name}]`)
        .concat(
          Array(Math.max(0, g.maxSockets - socketCount)).fill("[⚪ Kosong]"),
        )
        .join(" ");
      return `• **${g.name}** (${socketCount}/${g.maxSockets} Socket)\n  ${socketVisual}`;
    }).join("\n\n");

    const descLines = [
      `Selamat datang di Meja Tempa Kosmik, **${user.displayName || user.username}**!`,
      "Di sini kamu bisa memasang Permata Kosmik ke peralatanmu untuk mendapatkan khasiat permanen saat dungeon dan pertarungan.",
      "",
      "**Status Socket Peralatan Saat Ini:**",
      gearOverview,
      "",
      `💎 **Permata di Tas Kamu:** ${userGems.length > 0 ? userGems.map((ug) => `\`${ug.amount}x\` ${ug.name}`).join(", ") : "*Belum ada permata kosmik. Dapatkan dari jarahan Boss atau Gacha!*"}`,
      "",
      userGems.length > 0
        ? "Pilih peralatan dan permata yang ingin kamu sematkan di bawah!"
        : "*Kumpulkan Permata Kosmik dulu untuk mulai menyematkan soket!*",
    ];

    const selectGearRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("enchant_select_gear")
        .setPlaceholder("Pilih peralatan yang ingin di-enchant...")
        .addOptions(
          SOCKETABLE_GEAR.map((g) => {
            const gearData = enchantedGear[g.id] || { cosmic_sockets: [] };
            const sockets = gearData.cosmic_sockets || [];
            return {
              label: g.name.replace(/[^a-zA-Z0-9 ]/g, "").trim(),
              description: `Terisi ${sockets.length}/${g.maxSockets} soket`,
              value: g.id,
            };
          }),
        ),
    );

    const payload = buildContainerV2({
      accentColorHex: survivalUI.getColor("bark"),
      authorName: "Altar Tempa & Cosmic Enchanter",
      title: `${e("gem", "\uD83D\uDC8E")} Penyematan Permata Kosmik`,
      iconURL: user.displayAvatarURL(),
      expression: "info",
      description: descLines.join("\n"),
      footerText: ui.getFooter("survival"),
    });

    const initialComponents =
      userGems.length > 0
        ? [...payload.components, selectGearRow]
        : payload.components;

    const message = await interaction.editReply({
      ...payload,
      components: initialComponents,
      embeds: [],
      flags: MessageFlags.IsComponentsV2,
    });

    if (
      userGems.length === 0 ||
      !message ||
      typeof message.createMessageComponentCollector !== "function"
    ) {
      return;
    }

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    let chosenGearId = null;

    collector.on("collect", async (i) => {
      if (i.isStringSelectMenu() && i.customId === "enchant_select_gear") {
        await i.deferUpdate().catch(() => {});
        chosenGearId = i.values[0];

        const gearConfig = SOCKETABLE_GEAR.find((g) => g.id === chosenGearId);
        const gearData = enchantedGear[chosenGearId] || {
          cosmic_sockets: [],
          maxSockets: gearConfig.maxSockets,
        };

        if ((gearData.cosmic_sockets?.length || 0) >= gearConfig.maxSockets) {
          return i.followUp({
            ...buildErrorContainerV2({
              errorMessage: `Soket untuk **${gearConfig.name}** sudah terisi penuh (${gearConfig.maxSockets}/${gearConfig.maxSockets})!`,
              footerText: ui.getFooter("survival"),
            }),
            flags: MessageFlags.Ephemeral,
          });
        }

        const selectGemRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("enchant_select_gem")
            .setPlaceholder(
              `Pilih permata untuk disematkan ke ${gearConfig.name}...`,
            )
            .addOptions(
              userGems.map((ug) => ({
                label: `${ug.name.replace(/[^a-zA-Z0-9 ]/g, "").trim()} (${ug.amount}x)`,
                description: ug.description.slice(0, 100),
                value: ug.id,
              })),
            ),
        );

        return interaction.editReply({
          ...payload,
          components: [...payload.components, selectGearRow, selectGemRow],
        });
      }

      if (i.isStringSelectMenu() && i.customId === "enchant_select_gem") {
        await i.deferUpdate().catch(() => {});
        const gemId = i.values[0];
        const gearConfig = SOCKETABLE_GEAR.find((g) => g.id === chosenGearId);

        // Ambil data terbaru
        const freshProfile = await cacheManager.getUserProfile(user.id);
        const freshInv = safeParseInventory(freshProfile.inventory);
        const gemInInv = freshInv.find(
          (it) => it && (it.id === gemId || it.id === gemId.toLowerCase()),
        );

        if (!gemInInv || (gemInInv.amount || 1) < 1) {
          return i.followUp({
            ...buildErrorContainerV2({
              errorMessage:
                "Permata tersebut sudah tidak ada lagi di dalam tasmu!",
              footerText: ui.getFooter("survival"),
            }),
            flags: MessageFlags.Ephemeral,
          });
        }

        // Jalankan socketing
        let socketResult = null;
        await cacheManager.mutateUserSurvivalJson(
          user.id,
          "rpg_state",
          (state) => {
            const s = state || {};
            if (!s.enchanted_gear) s.enchanted_gear = {};
            if (!s.enchanted_gear[chosenGearId]) {
              s.enchanted_gear[chosenGearId] = {
                id: chosenGearId,
                name: gearConfig.name,
                maxSockets: gearConfig.maxSockets,
                cosmic_sockets: [],
              };
            }

            socketResult = gemEngine.socketGem(
              s.enchanted_gear[chosenGearId],
              gemId,
            );
            return s;
          },
        );

        if (!socketResult || !socketResult.success) {
          return i.followUp({
            ...buildErrorContainerV2({
              errorMessage: `Gagal menyematkan permata: ${socketResult?.reason || "Error tidak diketahui"}`,
              footerText: ui.getFooter("survival"),
            }),
            flags: MessageFlags.Ephemeral,
          });
        }

        // Potong 1 gem dari inventory secara atomik
        await takeItemsAtomic(user.id, [{ id: gemInInv.id, amount: 1 }]);

        // Cek achievement
        const tracker = require("../../../src/survival/helpers/achievementTracker");
        await tracker.checkAndUnlock(user.id);

        const gemDef = gemEngine.getGemById(gemId);
        const successContainer = buildContainerV2({
          accentColorHex: survivalUI.getColor("moss"),
          authorName: "Altar Tempa & Cosmic Enchanter",
          title: `✨ Penyematan Permata Berhasil!`,
          expression: "success",
          description: [
            `Hebat, **${user.displayName || user.username}**! Permata kosmik berhasil disatukan:`,
            "",
            `💎 **Permata:** ${gemDef.name}`,
            `🛡️ **Peralatan:** ${gearConfig.name}`,
            `✨ **Efek Aktif:** *${gemDef.description}*`,
            "",
            "> *Efek permata ini akan otomatis aktif saat kamu bertarung di Infinite Dungeon dan Duel PvP!*",
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });

        collector.stop();

        return interaction.editReply({
          ...successContainer,
          components: successContainer.components,
          embeds: [],
        });
      }
    });
  },
};
