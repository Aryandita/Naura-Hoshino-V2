"use strict";

const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const cacheManager = require("../../../src/managers/cacheManager");
const roamEngine = require("../../../src/survival/engines/roamEngine");
const visualNovelRenderer = require("../../../src/survival/engines/visualNovelRenderer");
const currency = require("../../../src/survival/engines/currency");
const { ROAM_LOCATIONS } = require("../../../src/survival/data/roamLocations");
const { createManagedCollector } = require("../../../src/utils/interactionPipeline");

const LOCATION_EMOJIS = {
  warung: "🍜",
  sekolah: "🏫",
  kebun: "🌿",
  sungai: "🌊",
  balai_desa: "🏛️",
  cafe: "☕",
  klinik: "🏥",
  pasar_kota: "🏪",
  perpustakaan: "📚",
  taman_kota: "🌳",
  pondok_herbal: "🌿",
  hutan_belantara: "🌲",
  gua_tersembunyi: "🕳️",
  aula_utama: "🏰",
  ruang_takhta: "👑",
  perpustakaan_kuno: "📜",
};

const TYPE_LABELS = {
  shop: "Toko",
  work: "Tempat Kerja",
  explore: "Jelajah",
  social: "Sosial",
};

function normalizeLocationKey(raw) {
  if (!raw) return "desa_sukamaju";
  const normalized = raw.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (ROAM_LOCATIONS[normalized]) return normalized;
  for (const key of Object.keys(ROAM_LOCATIONS)) {
    if (key.includes(normalized) || normalized.includes(key.replace(/_/g, ""))) {
      return key;
    }
  }
  return "desa_sukamaju";
}

function getStaminaBar(current, max) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  const color =
    pct > 50
      ? survivalUI.getColor("moss")
      : pct > 20
        ? survivalUI.getColor("amber")
        : survivalUI.getColor("danger");
  return { bar: "█".repeat(filled) + "░".repeat(empty), pct: Math.round(pct), color };
}

module.exports = {
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const userId = interaction.user.id;
    const aksi = interaction.options.getString("aksi");
    const lokasi = interaction.options.getString("lokasi");
    const item = interaction.options.getString("item");
    const lang = interaction.localeLang || "id";

    try {
      const survival = await cacheManager.getUserSurvival(userId);

      if (!survival) {
        return interaction.editReply(
          buildErrorContainerV2({
            authorName: "Naura Wilds",
            title: "Petualangan Belum Dimulai",
            description: "Kamu harus memulai petualangan dengan `/survival start` terlebih dahulu.",
            buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
            footerText: ui.getFooter("survival"),
          }),
        );
      }

      const rawLocation = survival.currentLocation || "desa_sukamaju";
      const currentArea = normalizeLocationKey(rawLocation);
      const areaData = roamEngine.getAreaData(currentArea);

      if (!areaData) {
        return interaction.editReply(
          buildErrorContainerV2({
            authorName: "Naura Wilds",
            title: "Kawasan Tidak Dikenal",
            description: "Kamu berada di kawasan yang tidak bisa dijelajahi.",
            buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
            footerText: ui.getFooter("survival"),
          }),
        );
      }

      if (aksi === "explore") {
        return await handleExplore(interaction, userId, currentArea, areaData, survival, lang);
      } else if (aksi === "work") {
        if (!lokasi) {
          return interaction.editReply(
            buildErrorContainerV2({
              authorName: "Naura Wilds",
              title: "Lokasi Diperlukan",
              description: "Pilih lokasi tempat bekerja dengan mengisi parameter `lokasi`.",
              buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
              footerText: ui.getFooter("survival"),
            }),
          );
        }
        return await handleWork(interaction, userId, currentArea, lokasi, survival, lang);
      } else if (aksi === "shop") {
        if (!item) {
          return interaction.editReply(
            buildErrorContainerV2({
              authorName: "Naura Wilds",
              title: "Item Diperlukan",
              description: "Sebutkan item yang ingin dibeli dengan mengisi parameter `item`.",
              buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
              footerText: ui.getFooter("survival"),
            }),
          );
        }
        return await handleShop(interaction, userId, currentArea, item, survival, lang);
      }
    } catch (error) {
      const payload = buildErrorContainerV2({
        authorName: "Naura Wilds",
        title: "Terjadi Kesalahan",
        description: error.message || "Coba lagi nanti.",
        buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
        footerText: ui.getFooter("survival"),
      });
      await interaction.editReply(payload).catch(() => {});
    }
  },
};

async function handleExplore(interaction, userId, areaId, areaData, survival, lang) {
  const locations = roamEngine.getAvailableLocations(areaId);

  if (locations.length === 0) {
    return interaction.editReply(
      buildErrorContainerV2({
        authorName: "Naura Wilds",
        title: "Tidak Ada Lokasi",
        description: "Kawasan ini belum memiliki lokasi yang bisa dijelajahi.",
        buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
        footerText: ui.getFooter("survival"),
      }),
    );
  }

  const staminaInfo = getStaminaBar(survival.stamina || 0, 100);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("roam_location_select")
    .setPlaceholder("Pilih tempat yang ingin dikunjungi...")
    .addOptions(
      locations.slice(0, 25).map((loc) => ({
        label: `${LOCATION_EMOJIS[loc.id] || "📍"} ${loc.name}`,
        description: `[${TYPE_LABELS[loc.type] || loc.type}] ${loc.description.substring(0, 60)}`,
        value: loc.id,
      })),
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const navButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roam_back_survival")
      .setLabel("Kembali ke Survival")
      .setEmoji("🏠")
      .setStyle(ButtonStyle.Secondary),
  );

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("emerald"),
    authorName: `Naura Wilds · ${areaData.name}`,
    title: "🗺️ Mau pergi ke mana?",
    description: [
      `Kamu sedang berada di **${areaData.name}**.`,
      `*${areaData.description}*`,
      "",
      `${staminaInfo.bar} Stamina **${Math.round(survival.stamina || 0)}/100**`,
      "Biaya jelajah: 1-5 menit waktu + 2-5 stamina",
    ].join("\n"),
    buttonsRow: [row, navButtons],
    footerText: ui.getFooter("survival"),
  });

  const message = await interaction.editReply(payload);

  createManagedCollector(message, interaction.user, {
    time: 120000,
    componentType: null, // Allow both select menu and buttons
    denyMessage: "Ini bukan sesi jelajahmu.",
    onCollect: async (i) => {
      // 1. Handle Kembali ke Survival
      if (i.isButton() && i.customId === "roam_back_survival") {
        await i.deferUpdate().catch(() => {});
        try {
          const infoCmd = require("./info");
          return await infoCmd.execute(i);
        } catch (err) {
          const backPayload = buildContainerV2({
            accentColorHex: survivalUI.getColor("emerald"),
            title: "Kembali ke Beranda",
            description: "Gunakan perintah `/survival` untuk membuka menu utama petualangan.",
            buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
            footerText: ui.getFooter("survival"),
          });
          return i.editReply(backPayload);
        }
      }

      // 2. Handle Roam Location Selection
      if (i.isStringSelectMenu() && i.customId === "roam_location_select") {
        await i.deferUpdate().catch(() => {});
        const locationId = i.values[0];
        const locEmoji = LOCATION_EMOJIS[locationId] || "📍";

        const result = await roamEngine.executeRoam(userId, areaId, locationId);

        if (!result.success) {
          return i.editReply(
            buildErrorContainerV2({
              authorName: "Naura Wilds",
              title: "Gagal Menjelajah",
              description: result.error,
              buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
              footerText: ui.getFooter("survival"),
            }),
          );
        }

        // VN Scene events
        if (
          result.event &&
          (result.event.type === "first_meet" || result.event.type === "relationship")
        ) {
          const vnPayload = await visualNovelRenderer.renderScene(result.event.scene);
          return i.editReply(vnPayload);
        }

        // Location event with choices
        if (result.event && result.event.type === "location_event") {
          const ev = result.event.event;
          const rewardParts = [];
          if (ev?.reward?.itemId) rewardParts.push(`🎒 ${ev.reward.itemId} x${ev.reward.amount || 1}`);
          if (ev?.reward?.currency) {
            rewardParts.push(`${currency.emojiOf(ev.reward.currency)} +${ev.reward.amount}`);
          }
          if (ev?.reward?.stamina) rewardParts.push(`⚡ Stamina +${ev.reward.stamina}`);
          if (ev?.reward?.hunger) rewardParts.push(`🍖 Lapar +${ev.reward.hunger}`);

          const eventPayload = buildContainerV2({
            accentColorHex: survivalUI.getColor("amber"),
            authorName: `Naura Wilds · ${areaData.name}`,
            title: `✨ ${ev?.title || "Peristiwa Menarik"}`,
            description: [
              `${locEmoji} **${result.location.name}**`,
              "",
              ev?.description || "Kamu menemukan sesuatu yang menarik di sini.",
              "",
              rewardParts.length > 0 ? `**Hadiah:** ${rewardParts.join(" · ")}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
            footerText: ui.getFooter("survival"),
          });
          return i.editReply(eventPayload);
        }

        // Standard roam result
        const updatedSurvival = await cacheManager.getUserSurvival(userId);
        const newStamina = getStaminaBar(updatedSurvival?.stamina || 0, 100);

        const locData = areaData.locations[locationId];
        const actionButtons = [];

        if (locData?.type === "shop" && locData.shopItems) {
          const currencyEmoji = currency.emojiOf(areaData.currency);
          for (const shopItem of locData.shopItems.slice(0, 3)) {
            actionButtons.push(
              new ButtonBuilder()
                .setCustomId(`roam_buy_${shopItem.itemId}`)
                .setLabel(`${shopItem.itemId} (${shopItem.price} ${currencyEmoji})`)
                .setStyle(ButtonStyle.Success),
            );
          }
        }

        if (locData?.workAvailable) {
          actionButtons.push(
            new ButtonBuilder()
              .setCustomId(`roam_work_${locationId}`)
              .setLabel("Bekerja di sini")
              .setEmoji("💼")
              .setStyle(ButtonStyle.Primary),
          );
        }

        actionButtons.push(
          new ButtonBuilder()
            .setCustomId("roam_explore_again")
            .setLabel("Jelajah Lagi")
            .setEmoji("🗺️")
            .setStyle(ButtonStyle.Secondary),
        );

        const buttonRows = [];
        for (let idx = 0; idx < actionButtons.length; idx += 5) {
          buttonRows.push(
            new ActionRowBuilder().addComponents(actionButtons.slice(idx, idx + 5)),
          );
        }
        buttonRows.push(survivalUI.buildSurvivalActionRow('town', userId));

        const resultPayload = buildContainerV2({
          accentColorHex: survivalUI.getColor("moss"),
          authorName: `Naura Wilds · ${areaData.name}`,
          title: `${locEmoji} ${result.location.name}`,
          description: [
            `Kamu menghabiskan **${result.timeCost} menit** menjelajahi **${result.location.name}**.`,
            "",
            `⏱️ Waktu: **-${result.timeCost} menit** · ⚡ Stamina: **-${result.staminaCost}**`,
            `${newStamina.bar} **${Math.round(updatedSurvival?.stamina || 0)}/100**`,
          ].join("\n"),
          buttonsRow: buttonRows,
          footerText: ui.getFooter("survival"),
        });

        const followMessage = await i.editReply(resultPayload);

        // Sub-collector for actions on the explored location
        createManagedCollector(followMessage, interaction.user, {
          time: 120000,
          componentType: ComponentType.Button,
          denyMessage: "Ini bukan sesi kamu.",
          onCollect: async (btnInteraction) => {
            const customId = btnInteraction.customId;

            if (customId.startsWith("roam_buy_")) {
              const itemId = customId.replace("roam_buy_", "");
              await btnInteraction.deferUpdate().catch(() => {});

              const shopResult = await roamEngine.purchaseItem(
                userId,
                areaId,
                locationId,
                itemId,
              );

              if (!shopResult.success) {
                return btnInteraction.followUp({
                  ...buildErrorContainerV2({
                    authorName: "Naura Wilds",
                    title: "Gagal Membeli",
                    description: shopResult.error,
                    footerText: ui.getFooter("survival"),
                  }),
                  flags: MessageFlags.Ephemeral,
                });
              }

              const currencyEmoji = currency.emojiOf(areaData.currency);
              const shopItem = locData.shopItems.find((si) => si.itemId === itemId);

              const restores = [];
              if (shopItem?.restores?.stamina) restores.push(`⚡ +${shopItem.restores.stamina}`);
              if (shopItem?.restores?.hunger) restores.push(`🍖 +${shopItem.restores.hunger}`);
              if (shopItem?.restores?.thirst) restores.push(`💧 +${shopItem.restores.thirst}`);

              const buySuccessPayload = buildContainerV2({
                accentColorHex: survivalUI.getColor("emerald"),
                authorName: "Naura Wilds • Toko Sekitar",
                title: "✅ Berhasil Membeli!",
                description: [
                  `Membeli **${itemId}** seharga **${shopItem?.price || 0}** ${currencyEmoji}.`,
                  restores.length > 0 ? restores.join(" · ") : "",
                  `💰 Sisa saldo: **${shopResult.newBalance}** ${currencyEmoji}`,
                ]
                  .filter(Boolean)
                  .join("\n"),
                footerText: ui.getFooter("survival"),
              });

              return btnInteraction.followUp({
                ...buySuccessPayload,
                flags: MessageFlags.Ephemeral,
              });
            }

            if (customId.startsWith("roam_work_")) {
              const workLocId = customId.replace("roam_work_", "");
              await btnInteraction.deferUpdate().catch(() => {});

              const workResult = await roamEngine.executeWork(userId, areaId, workLocId);

              if (!workResult.success) {
                return btnInteraction.followUp({
                  ...buildErrorContainerV2({
                    authorName: "Naura Wilds",
                    title: "Tidak Bisa Bekerja",
                    description: workResult.error,
                    footerText: ui.getFooter("survival"),
                  }),
                  flags: MessageFlags.Ephemeral,
                });
              }

              const currencyEmoji = currency.emojiOf(workResult.reward.currency);
              const workSuccessPayload = buildContainerV2({
                accentColorHex: survivalUI.getColor("emerald"),
                authorName: "Naura Wilds • Tempat Kerja",
                title: "💼 Selesai Bekerja!",
                description: [
                  "Pekerjaanmu selesai dengan baik.",
                  `💰 Upah: **${workResult.reward.amount}** ${currencyEmoji}`,
                  `⭐ EXP: **+${workResult.reward.exp}**`,
                ].join("\n"),
                footerText: ui.getFooter("survival"),
              });

              return btnInteraction.followUp({
                ...workSuccessPayload,
                flags: MessageFlags.Ephemeral,
              });
            }

            if (customId === "roam_explore_again") {
              await btnInteraction.deferUpdate().catch(() => {});
              const freshSurvival = await cacheManager.getUserSurvival(userId);
              return await handleExplore(
                btnInteraction,
                userId,
                areaId,
                areaData,
                freshSurvival,
                lang,
              );
            }
          },
        });
      }
    },
  });

  return message;
}

async function handleWork(interaction, userId, areaId, locationId, survival, lang) {
  const result = await roamEngine.executeWork(userId, areaId, locationId);

  if (!result.success) {
    return interaction.editReply(
      buildErrorContainerV2({
        authorName: "Naura Wilds",
        title: "Tidak Bisa Bekerja",
        description: result.error,
        buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
        footerText: ui.getFooter("survival"),
      }),
    );
  }

  const currencyEmoji = currency.emojiOf(result.reward.currency);
  const locEmoji = LOCATION_EMOJIS[locationId] || "💼";
  const areaData = roamEngine.getAreaData(areaId);

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("emerald"),
    authorName: `Naura Wilds · ${areaData?.name || areaId}`,
    title: `${locEmoji} Selesai Bekerja!`,
    description: [
      "Kamu menyelesaikan pekerjaanmu dengan baik.",
      "",
      `💰 Upah: **${result.reward.amount}** ${currencyEmoji}`,
      `⭐ EXP: **+${result.reward.exp}**`,
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

async function handleShop(interaction, userId, areaId, itemId, survival, lang) {
  const areaData = ROAM_LOCATIONS[areaId];
  let shopLocation = null;
  let shopItem = null;

  for (const loc of Object.values(areaData.locations)) {
    if (loc.type === "shop" && loc.shopItems) {
      const found = loc.shopItems.find((i) => i.itemId === itemId);
      if (found) {
        shopLocation = loc;
        shopItem = found;
        break;
      }
    }
  }

  if (!shopLocation || !shopItem) {
    return interaction.editReply(
      buildErrorContainerV2({
        authorName: "Naura Wilds",
        title: "Item Tidak Tersedia",
        description: `Item \`${itemId}\` tidak dijual di kawasan ini. Cek item yang tersedia di toko sekitar.`,
        buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
        footerText: ui.getFooter("survival"),
      }),
    );
  }

  const result = await roamEngine.purchaseItem(userId, areaId, shopLocation.id, itemId);

  if (!result.success) {
    return interaction.editReply(
      buildErrorContainerV2({
        authorName: "Naura Wilds",
        title: "Gagal Membeli",
        description: result.error,
        buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
        footerText: ui.getFooter("survival"),
      }),
    );
  }

  const currencyEmoji = currency.emojiOf(areaData.currency);
  const shopEmoji = LOCATION_EMOJIS[shopLocation.id] || "🛒";

  let description;
  if (result.isTicket) {
    description = [
      `Kamu membeli **${shopItem.itemId}** seharga **${shopItem.price}** ${currencyEmoji}.`,
      "",
      "🎟️ Tiket ditambahkan ke inventaris!",
      "Gunakan tombol **Ajak Kencan** pada NPC romansa untuk menggunakannya.",
      "",
      `💰 Sisa saldo: **${result.newBalance}** ${currencyEmoji}`,
    ].join("\n");
  } else {
    const restores = [];
    if (shopItem.restores.stamina) restores.push(`⚡ Stamina +${shopItem.restores.stamina}`);
    if (shopItem.restores.hunger) restores.push(`🍖 Lapar +${shopItem.restores.hunger}`);
    if (shopItem.restores.thirst) restores.push(`💧 Haus +${shopItem.restores.thirst}`);

    description = [
      `Kamu membeli **${shopItem.itemId}** seharga **${shopItem.price}** ${currencyEmoji}.`,
      "",
      restores.join(" · "),
      "",
      `💰 Sisa saldo: **${result.newBalance}** ${currencyEmoji}`,
    ].join("\n");
  }

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("emerald"),
    authorName: `Naura Wilds · ${shopLocation.name}`,
    title: `${shopEmoji} Berhasil Dibeli!`,
    description,
    buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}
