"use strict";

/**
 * @namespace: plugin/survival/subcommands/forge.js
 * @type: Subcommand
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 2.2.0
 * @description Bengkel Pandai Besi & Fasilitas Daur Ulang Alat (/survival forge)
 */

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const cacheManager = require("../../../src/managers/cacheManager");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const DurabilityEngine = require("../../../src/survival/engines/durabilityEngine");

const COLLECTOR_MS = 60000;

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const profile = await cacheManager.getUserProfile(user.id);

    if (!profile) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: "Profil Belum Terdaftar",
          errorMessage: "Kamu belum memulai perjalanan survival. Ketik `/survival start` terlebih dahulu ya!",
        }),
      );
    }

    const inventory = safeParseInventory(profile.inventory);

    // Cari item peralatan / senjata di tas yang bisa di-salvage
    const salvageableItems = inventory.filter((item) => {
      if (!item) return false;
      const cat = (item.category || "").toLowerCase();
      const id = (item.id || "").toLowerCase();
      return cat === "weapon" || cat === "tool" || cat === "armor" || id.includes("pickaxe") || id.includes("axe") || id.includes("sword");
    });

    const salvageOptions = salvageableItems.slice(0, 25).map((it, idx) => {
      const dur = it.durability !== undefined ? it.durability : 100;
      return {
        label: `Bongkar ${it.name || it.id} (Durability: ${dur}%)`,
        description: `Daur ulang menjadi batangan logam & bonus NSF`.substring(0, 100),
        value: `${it.id || it.name}_${idx}`,
        emoji: "♻️",
      };
    });

    const buildPayload = (extraDesc = "") => {
      const descLines = [
        "> *Bengkel Pandai Besi Bagas kini dilengkapi fasilitas dekonstruksi material.*",
        "",
        "🔨 **Layanan Bengkel Pandai Besi:**",
        "• **Daur Ulang (Salvage):** Bongkar alat rusak atau aus menjadi batangan logam mentah dan bonus NSF.",
        "• **Tempa & Rakit:** Buka meja perakitan untuk merakit senjata atau melebur bahan mentah.",
        "",
        `🎒 **Total Peralatan di Tas:** \`${salvageableItems.length}\` unit dapat didaur ulang.`,
      ];

      if (extraDesc) {
        descLines.push("", extraDesc);
      }

      const rows = [];
      if (salvageOptions.length > 0) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("forge_salvage_select")
              .setPlaceholder("Pilih peralatan untuk didaur ulang (Salvage)...")
              .addOptions(salvageOptions),
          ),
        );
      }

      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("forge_open_craft")
            .setLabel("Buka Meja Tempa & Rakit")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🔨"),
        ),
      );

      return {
        ...buildContainerV2({
          accentColorHex: "#F59E0B",
          authorName: "Naura Wilds - Bengkel Tempa & Daur Ulang",
          title: "⚒️ Bengkel Pandai Besi Bagas",
          description: descLines.join("\n"),
          footerText: ui.getFooter("survival"),
        }),
        components: rows,
      };
    };

    const initialPayload = buildPayload();
    const reply = await interaction.editReply(initialPayload);

    if (!reply) return;

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "forge_open_craft") {
        await i.deferUpdate().catch(() => {});
        const craftSubcommand = require("./craft.js");
        collector.stop();
        return craftSubcommand.execute(interaction);
      }

      if (i.customId === "forge_salvage_select") {
        await i.deferUpdate().catch(() => {});
        const chosenVal = i.values[0];
        // Ambil itemId dari value
        const lastUnder = chosenVal.lastIndexOf("_");
        const itemId = lastUnder !== -1 ? chosenVal.substring(0, lastUnder) : chosenVal;

        const salvageRes = await DurabilityEngine.salvageItem(user.id, itemId);

        let snippet = "";
        if (salvageRes.ok) {
          const matLines = salvageRes.materials.map((m) => `• \`${m.name}\` x${m.amount}`).join("\n");
          snippet = [
            `♻️ **Dekonstruksi Berhasil!**`,
            `Kamu membongkar **${salvageRes.salvagedItem.name || itemId}** dan memperoleh:`,
            matLines,
            `💰 Bonus Kas Daur Ulang: \`+${salvageRes.nsfAwarded} NSF\``,
          ].join("\n");
        } else {
          snippet = `⚠️ **Gagal Daur Ulang:** ${salvageRes.message || "Barang tidak dapat dibongkar."}`;
        }

        const updated = buildPayload(snippet);
        await i.editReply(updated).catch(() => {});
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
