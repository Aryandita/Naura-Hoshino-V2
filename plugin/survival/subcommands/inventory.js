// Lokasi: plugin/survival/subcommands/inventory.js
// Subcommand /survival profile inventory (dan shortcut /survival inventory)
// Menampilkan Ransel Petualang dengan render Canvas adaptif dan detail item

"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { logger } = require("../../../src/managers/logger");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const {
  safeParseInventory,
} = require("../../../src/survival/engines/inventoryHelper");
const { CATALOG_BY_ID } = require("../../../src/survival/data/items_catalog");
const {
  generateInventoryBackpackImage,
} = require("../../../src/canvas/inventoryCanvas");

const IMAGE_NAME = "naura-backpack.png";

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;

    try {
      const [profile, survival] = await Promise.all([
        cacheManager.getUserProfile(user.id),
        cacheManager.getUserSurvival(user.id),
      ]);

      const rawInventory = safeParseInventory(profile?.inventory);

      // Agregasi item untuk statistik deskriptif
      const aggregatedMap = new Map();
      let totalUnits = 0;
      let totalSellValue = 0;
      const categoryCounts = {
        weapon: 0,
        armor: 0,
        tool: 0,
        consumable: 0,
        material: 0,
        other: 0,
      };

      for (const item of rawInventory) {
        if (!item) continue;
        const id = item.id || (typeof item === "string" ? item : "unknown");
        const amount = Number(item.amount) || 1;
        totalUnits += amount;

        const catalogItem = CATALOG_BY_ID.get(id);
        const cat = catalogItem
          ? catalogItem.category
          : item.category || "other";
        if (categoryCounts[cat] !== undefined) {
          categoryCounts[cat] += amount;
        } else {
          categoryCounts.other += amount;
        }

        const sellPrice = catalogItem
          ? catalogItem.sellPrice
          : item.sellPrice || 10;
        totalSellValue += sellPrice * amount;

        if (aggregatedMap.has(id)) {
          aggregatedMap.get(id).amount += amount;
        } else {
          aggregatedMap.set(id, {
            id,
            name: item.name || (catalogItem ? catalogItem.name : id),
            amount,
            tier: catalogItem ? catalogItem.tier : item.tier || 1,
            tierColor: catalogItem ? catalogItem.tierColor : "#9CA3AF",
            emoji: item.emoji || (catalogItem ? catalogItem.emoji : "📦"),
          });
        }
      }

      const uniqueTypesCount = aggregatedMap.size;
      const displayName = ui.ux
        ? ui.ux.resolveUserName(interaction)
        : user.displayName || user.username;

      // Render Visual Canvas Ransel Petualang
      let files = [];
      let bannerAttachmentName;
      try {
        const imageBuffer = await generateInventoryBackpackImage(
          user,
          rawInventory,
          profile,
          {
            survival,
          },
        );
        if (imageBuffer) {
          files = [new AttachmentBuilder(imageBuffer, { name: IMAGE_NAME })];
          bannerAttachmentName = IMAGE_NAME;
        }
      } catch (canvasErr) {
        logger.warn("[SURVIVAL INVENTORY CANVAS ERROR]", canvasErr.message);
      }

      // Tombol Aksi Cepat Interaktif
      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("inv_cta_consume")
          .setLabel("🧪 Konsumsi Makanan")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("inv_cta_craft")
          .setLabel("🔨 Bengkel Tempa")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("inv_cta_shop")
          .setLabel("🛒 Kunjungi Toko")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("inv_cta_info")
          .setLabel("👤 Status Profil")
          .setStyle(ButtonStyle.Secondary),
      );

      // Deskripsi & Catatan Naura
      let descriptionText = `🎒 **Ransel Petualang ${displayName}** tersusun rapi dengan sabuk kulit dan pengait kuningan.\n`;
      if (uniqueTypesCount === 0) {
        descriptionText += `> *Ranselmu masih kosong. Jelajahi alam liar dengan \`/survival gather collect\` atau tebang kayu untuk mengisinya!*`;
      } else if (uniqueTypesCount > 15) {
        descriptionText += `> *Wah, bawaanmu penuh sekali! Kotak terakhir pada ransel menampilkan **... +${uniqueTypesCount - 14} barang lainnya** yang tersimpan di saku dalam.*`;
      } else {
        descriptionText += `> *Ukuran saku ransel otomatis menyesuaikan ruang agar seluruh perlengkapanmu tersimpan sempurna dan mudah dijangkau.*`;
      }

      const payload = buildContainerV2({
        accentColorHex: survivalUI.getColor("emerald") || "#86EFAC",
        authorName: `Naura Wilds • Sistem Manajemen Ransel Petualang`,
        title: `🎒 Isi Ransel Petualang: ${displayName}`,
        iconURL: user.displayAvatarURL(),
        expression: uniqueTypesCount > 0 ? "Cheers" : "idle",
        description: descriptionText,
        fields: [
          {
            name: `📊 Kapasitas & Muatan`,
            value: [
              `> ${e("box", "📦")} **Jenis Item Unik:** \`${uniqueTypesCount}\` jenis`,
              `> ${e("inventory", "🎒")} **Total Muatan:** \`${totalUnits}\` unit barang`,
              `> ${e("coin", "🪙")} **Estimasi Nilai Jual:** \`${totalSellValue.toLocaleString("id-ID")}\` Coins`,
            ].join("\n"),
            inline: true,
          },
          {
            name: `📦 Kategori Muatan`,
            value: [
              `> ⚔️ **Senjata:** \`${categoryCounts.weapon}\` • 🛡️ **Zirah:** \`${categoryCounts.armor}\``,
              `> ⛏️ **Alat:** \`${categoryCounts.tool}\` • 🧪 **Konsumsi:** \`${categoryCounts.consumable}\``,
              `> 💎 **Bahan Baku:** \`${categoryCounts.material}\``,
            ].join("\n"),
            inline: true,
          },
        ],
        buttonsRow,
        bannerAttachmentName,
        files,
        footerText: ui.getFooter("survival"),
      });

      const replyMsg = await interaction.editReply(payload);

      if (
        !replyMsg ||
        typeof replyMsg.createMessageComponentCollector !== "function"
      ) {
        return;
      }

      const collector = replyMsg.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === user.id && i.customId.startsWith("inv_cta_"),
        time: 60000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "inv_cta_consume") {
          const consumeSub = require("./consume.js");
          return consumeSub.execute(i);
        }
        if (i.customId === "inv_cta_craft") {
          const craftSub = require("./craft.js");
          return craftSub.execute(i);
        }
        if (i.customId === "inv_cta_shop") {
          const shopSub = require("./shop.js");
          return shopSub.execute(i);
        }
        if (i.customId === "inv_cta_info") {
          const infoSub = require("./info.js");
          return infoSub.execute(i);
        }
      });
    } catch (err) {
      logger.error("[SURVIVAL INVENTORY ERROR]", err);
      const errPayload = buildErrorContainerV2({
        title: `${e("naura_cry", "😭")} Gagal Membuka Ransel`,
        description:
          "Maaf ya, ada kendala saat Naura membukakan ranselmu. Coba ulangi sebentar lagi ya!",
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply(errPayload);
    }
  },
};
