"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const greenhouseEngine = require("../../../src/survival/engines/greenhouseEngine");
const { CROP_SEEDS, getSeedById } = require("../../../src/survival/data/cropSeeds");
const { renderGreenhouseCard } = require("../../../src/canvas/greenhouseCanvas");

module.exports = {
  name: "farm",
  description:
    "🌿 Kelola Lahan Hidroponik Greenhouse, tanam benih kosmik, dan panen bahan kafe!",

  async execute(interaction) {
    const action = interaction.options.getString("aksi") || "status";
    const seedId = interaction.options.getString("benih");
    const slotNumber = interaction.options.getInteger("slot");
    const userId = interaction.user.id;
    const displayName =
      interaction.member?.displayName ||
      interaction.user.displayName ||
      interaction.user.username;

    // 1. LIHAT STATUS GREENHOUSE
    if (action === "status") {
      const gh = await greenhouseEngine.getGreenhouse(userId);
      const files = [];

      try {
        const cardBuffer = await renderGreenhouseCard(gh);
        files.push(
          new AttachmentBuilder(cardBuffer, { name: "greenhouse_status.png" }),
        );
      } catch (err) {
        // Fallback jika canvas gagal
      }

      const slotSummaries = gh.slots
        .map((s, idx) => {
          if (s.isEmpty) {
            return `• **Pod #${idx + 1}**: ⚪ _Lahan Kosong_ (Siap ditanami)`;
          }
          const seed = s.seed || {};
          const statusText = s.isMature
            ? "✨ **Siap Dipanen!**"
            : `⏳ ${s.stage} (\`${s.remainingMinutes} menit lagi\`) [${s.progressPercent}%]`;
          const fert = s.isFertilized ? "⚡ _Terpupuk (+50% Panen)_" : "";
          return `• **Pod #${idx + 1}**: ${seed.emoji || "🌱"} **${seed.name || "Tanaman"}** | ${statusText} ${fert}`;
        })
        .join("\n");

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("farm_quick_water")
          .setLabel("Siram Semua")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("💧"),
        new ButtonBuilder()
          .setCustomId("farm_quick_harvest")
          .setLabel("Panen Semua")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🌾"),
        new ButtonBuilder()
          .setCustomId("farm_open_shop")
          .setLabel("Toko Benih")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🛒"),
      );

      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: `🌿 GreenHouse Hidroponik • ${displayName}`,
        description: [
          `Selamat datang di fasilitas agrikultur kosmik berteknologi tinggi!`,
          ``,
          `📊 **Status Fasilitas:**`,
          `• **Tingkat Grid:** \`Level ${gh.gridLevel}\` (${gh.maxSlots} Pod Aktif)`,
          `• **Total Panen:** \`${gh.totalHarvests}\` kali`,
          ``,
          `🌱 **Kondisi Pod Tanaman:**`,
          slotSummaries,
          ``,
          `> *Gunakan \`/survival farm plant\` untuk menanam benih atau siram pod secara berkala!*`,
        ].join("\n"),
        buttonsRow,
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        files,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 2. TOKO BENIH
    if (action === "shop") {
      const seedLines = CROP_SEEDS.map((s) => {
        return `• ${s.emoji} **${s.name}**\n  💰 Harga: \`${s.seedPrice}\` Koin | ⏱️ Waktu Tumbuh: \`${s.growTimeMinutes}m\`\n  📦 Hasil: \`${s.harvestYield.amountMin}-${s.harvestYield.amountMax}x ${s.harvestYield.itemName}\` (+${s.harvestYield.xp} XP)\n  _${s.description}_`;
      }).join("\n\n");

      const payload = buildContainerV2({
        authorName: "GREENHOUSE SEED DISPENSARY",
        title: "🛒 Katalog Benih Kosmik & Bibit Hidroponik",
        description: [
          `Pilih benih terbaik untuk ditanam di greenhouse hidroponikmu:`,
          ``,
          seedLines,
          ``,
          `> *Tanam dengan perintah: \`/survival farm aksi:Tanam Benih benih:<pilihan> slot:<nomor>\`*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 3. MENANAM BENIH
    if (action === "plant") {
      if (!seedId) {
        const payload = buildErrorContainerV2({
          title: "Benih Belum Dipilih",
          description:
            "Silakan tentukan benih yang ingin ditanam melalui opsi `benih`!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const slotIdx = slotNumber ? slotNumber - 1 : 0;
      const res = await greenhouseEngine.plantSeed(userId, slotIdx, seedId);

      if (!res.success) {
        let msg = "Gagal menanam benih.";
        if (res.reason === "INSUFFICIENT_FUNDS") {
          msg = `Saldo koinmu tidak cukup untuk membeli benih ini (\`${res.cost}\` Koin)!`;
        } else if (res.reason === "SLOT_OCCUPIED") {
          msg = `Pod #${slotIdx + 1} sudah terisi tanaman! Pilih pod lain atau tunggu panen.`;
        } else if (res.reason === "INVALID_SLOT_INDEX") {
          msg = `Nomor pod #${slotIdx + 1} tidak valid. Tingkatkan level greenhouse untuk membuka lebih banyak pod!`;
        }

        const payload = buildErrorContainerV2({
          title: "Gagal Menanam",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const seed = res.seed;
      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "🌱 Benih Berhasil Ditanam!",
        description: [
          `Berhasil menanam **${seed.name}** ${seed.emoji} di **Pod #${res.slotIndex + 1}**!`,
          ``,
          `⏱️ **Waktu Tumbuh:** \`${seed.growTimeMinutes} menit\``,
          `💧 **Status Awal:** Kelembaban 100% (Subur)`,
          `💰 **Modal Benih:** \`${seed.seedPrice}\` Koin`,
          ``,
          `> *Gunakan pupuk atau siram secara berkala agar panen lebih melimpah!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 4. MENYIRAM TANAMAN
    if (action === "water") {
      const slotIdx = slotNumber ? slotNumber - 1 : 0;
      const res = await greenhouseEngine.waterSlot(userId, slotIdx);

      if (!res.success) {
        const payload = buildErrorContainerV2({
          title: "Gagal Menyiram",
          description: "Pod tersebut kosong atau nomor pod tidak valid!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "💧 Penyiraman Berhasil!",
        description: `Pod #${res.slotIndex + 1} telah dialiri air nutrisi hidroponik. Kelembaban kembali optimal di 100%!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 5. MEMUPUK TANAMAN
    if (action === "fertilize") {
      const slotIdx = slotNumber ? slotNumber - 1 : 0;
      const res = await greenhouseEngine.fertilizeSlot(userId, slotIdx);

      if (!res.success) {
        let msg = "Gagal memberikan pupuk.";
        if (res.reason === "INSUFFICIENT_FUNDS") {
          msg = `Saldo koinmu tidak cukup untuk membeli pupuk nutrisi (\`${res.cost}\` Koin)!`;
        } else if (res.reason === "ALREADY_FERTILIZED") {
          msg = `Pod #${slotIdx + 1} sudah diberi pupuk nutrisi sebelumnya!`;
        } else if (res.reason === "SLOT_EMPTY") {
          msg = `Pod #${slotIdx + 1} masih kosong. Tanam benih terlebih dahulu!`;
        }

        const payload = buildErrorContainerV2({
          title: "Gagal Memupuk",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "⚡ Pupuk Nutrisi Diaplikasikan!",
        description: `Pod #${res.slotIndex + 1} telah diberi pupuk bio-elektrolit! Waktu panen dipercepat 25% dan hasil panen bertambah +50%!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 6. PANEN TANAMAN
    if (action === "harvest") {
      const slotIdx = slotNumber ? slotNumber - 1 : 0;
      const res = await greenhouseEngine.harvestSlot(userId, slotIdx);

      if (!res.success) {
        let msg = "Gagal memanen tanaman.";
        if (res.reason === "NOT_MATURE_YET") {
          msg = `Tanaman di Pod #${slotIdx + 1} belum matang! Harap tunggu sekitar \`${res.remainingMinutes} menit lagi\`.`;
        } else if (res.reason === "SLOT_EMPTY") {
          msg = `Pod #${slotIdx + 1} masih kosong!`;
        }

        const payload = buildErrorContainerV2({
          title: "Belum Siap Panen",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const questGen = require("../../../src/survival/engines/questGenerator");
      await questGen
        .incrementQuestProgress(userId, "farm_harvest", 1)
        .catch(() => {});

      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "🌾 Panen Berhasil!",
        description: [
          `Selamat, **${displayName}**! Kamu berhasil memanen hasil hidroponik dari Pod #${res.slotIndex + 1}:`,
          ``,
          `📦 **Hasil Panen:** \`${res.item.amount}x\` **${res.item.name}**`,
          `⭐ **Bonus XP:** \`+${res.xpYield} XP\``,
          res.wasFertilized ? `✨ _Bonus Pupuk Bio-Elektrolit Aktif!_` : ``,
          ``,
          `> *Bahan mentah ini siap diolah di Kafe (\`/survival cafe cook\`) atau dijual!*`,
        ].filter(Boolean).join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 7. UPGRADE GRID
    if (action === "upgrade") {
      const res = await greenhouseEngine.upgradeGrid(userId);
      if (!res.success) {
        let msg = "Gagal meningkatkan level greenhouse.";
        if (res.reason === "ALREADY_MAX_LEVEL") {
          msg = "Greenhouse milikmu sudah mencapai tingkat maksimal (Level 4)!";
        } else if (res.reason === "INSUFFICIENT_FUNDS") {
          msg = `Saldo koin tidak cukup untuk ekspansi grid (\`${res.cost}\` Koin)!`;
        }

        const payload = buildErrorContainerV2({
          title: "Ekspansi Gagal",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "🚀 Ekspansi Grid Selesai!",
        description: `Selamat! Fasilitas greenhouse berhasil ditingkatkan ke **Level ${res.newLevel}**! Kamu sekarang memiliki total **${res.newMaxSlots} Pod Hidroponik**!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
