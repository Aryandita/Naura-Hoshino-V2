"use strict";

/**
 * @module forge
 * @description Subcommand /survival forge - Crafting dan upgrading equipment di bengkel pandai besi.
 * 
 * Fitur Utama:
 * - Recipe lookup dan material validation
 * - Tier-based crafting system
 * - Durability repair mechanic
 * - Upgrade path dengan material langka
 */


/**
 * @namespace: plugin/survival/subcommands/forge.js
 * @type: Subcommand
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 2.3.0
 * @description Bengkel Pandai Besi & Fasilitas Daur Ulang Alat (/survival forge)
 */

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { buildContainerV2, buildErrorContainerV2, disableContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
// ============================================================================
// CONSTANTS
// ============================================================================

const survivalUI = require("../../../src/utils/survivalUIHelper");
const ui = require("../../../src/config/ui");
const cacheManager = require("../../../src/managers/cacheManager");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const DurabilityEngine = require("../../../src/survival/engines/durabilityEngine");

const COLLECTOR_MS = 60000;

// ============================================================================
// HANDLER
// ============================================================================

module.exports = {
  /**
   * Handler utama untuk command /survival forge
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
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
        description: `Daur ulang menjadi batangan logam & bonus SC`.substring(0, 100),
        value: `${it.id || it.name}_${idx}`,
        emoji: "♻️",
      };
    });

    const buildPayload = (extraDesc = "") => {
      const descLines = [
        "> *Bengkel Pandai Besi Bagas kini dilengkapi fasilitas dekonstruksi material.*",
        "",
        "🔨 **Layanan Bengkel Pandai Besi:**",
        "• **Daur Ulang (Salvage):** Bongkar alat rusak atau aus menjadi batangan logam mentah dan bonus SC.",
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
          new ButtonBuilder()
            .setCustomId("forge_salvage_all")
            .setLabel("Bongkar Semua Alat Rusak (0%)")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("♻️"),
        ),
      );

      return buildContainerV2({
        accentColorHex: survivalUI.getColor("amber"),
        authorName: "Naura Wilds - Bengkel Tempa & Daur Ulang",
        title: "⚒️ Bengkel Pandai Besi Bagas",
        description: descLines.join("\n"),
        buttonsRow: rows,
        footerText: ui.getFooter("survival"),
      });
    };

    let currentPayload = buildPayload();
    const reply = await interaction.editReply(currentPayload);

    if (!reply) return;

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "forge_open_craft") {
        await i.deferUpdate().catch(() => {});
        collector.stop("navigated");
        const { adaptSurvivalInteraction } = require("../../../src/survival/helpers/survivalContext");
        adaptSurvivalInteraction(interaction, "craft");
        const craftSubcommand = require("./craft.js");
        return craftSubcommand.execute(interaction);
      }

      if (i.customId === "forge_salvage_all") {
        await i.deferUpdate().catch(() => {});
        const allRes = await DurabilityEngine.salvageAllDamagedItems(user.id);
        let snippet = "";
        if (allRes.ok) {
          const matLines = allRes.materials
            .map((m) => `• \`${m.name}\` x${m.amount}`)
            .join("\n");
          snippet = [
            `♻️ **Daur Ulang Massal Berhasil!**`,
            `Kamu membongkar **${allRes.count}** peralatan rusak menjadi:`,
            matLines,
            `💰 Total Hasil Kas Daur Ulang: \`+${allRes.nsfAwarded} SC\``,
          ].join("\n");
        } else {
          snippet = `⚠️ **Daur Ulang Massal:** ${allRes.message || "Tidak ada barang yang dibongkar."}`;
        }
        currentPayload = buildPayload(snippet);
        await i.editReply(currentPayload).catch(() => {});
        return;
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
            `💰 Bonus Kas Daur Ulang: \`+${salvageRes.nsfAwarded} SC\``,
          ].join("\n");
        } else {
          snippet = `⚠️ **Gagal Daur Ulang:** ${salvageRes.message || "Barang tidak dapat dibongkar."}`;
        }

        currentPayload = buildPayload(snippet);
        await i.editReply(currentPayload).catch(() => {});
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "navigated") return;
      if (currentPayload) {
        await interaction.editReply(disableContainerV2(currentPayload)).catch(() => {});
      }
    });
  },
};
