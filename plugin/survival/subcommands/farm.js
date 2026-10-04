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
const survivalUI = require("../../../src/utils/survivalUIHelper");
const ui = require("../../../src/config/ui");
const greenhouseEngine = require("../../../src/survival/engines/greenhouseEngine");
const {
  CROP_SEEDS,
} = require("../../../src/survival/data/cropSeeds");
const {
  renderGreenhouseCard,
} = require("../../../src/canvas/greenhouseCanvas");

module.exports = {
  name: "farm",
  description:
    "🌿 Kelola Lahan Hidroponik Greenhouse, tanam benih kosmik, dan panen bahan kafe!",

  async execute(interaction) {
    if (
      typeof interaction.deferUpdate === "function" &&
      !interaction.deferred &&
      !interaction.replied
    ) {
      await interaction.deferUpdate().catch(() => {});
    }

    const sendResponse = async (payload, isEphemeral = false) => {
      const finalFlags =
        (payload.flags || MessageFlags.IsComponentsV2) |
        (isEphemeral ? MessageFlags.Ephemeral : 0);
      const data = { ...payload, flags: finalFlags };
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(data);
      }
      return interaction.reply(data);
    };

    const action = interaction.options?.getString?.("aksi") || "status";
    const seedId = interaction.options?.getString?.("benih") || null;
    const slotNumber = interaction.options?.getInteger?.("slot") || null;
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

      return sendResponse({
        ...payload,
        files,
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

      return sendResponse(payload);
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
        return sendResponse(payload, true);
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
        return sendResponse(payload, true);
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

      return sendResponse(payload);
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
        return sendResponse(payload, true);
      }

      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "💧 Penyiraman Berhasil!",
        description: `Pod #${res.slotIndex + 1} telah dialiri air nutrisi hidroponik. Kelembaban kembali optimal di 100%!`,
        footerText: ui.getFooter("survival"),
      });

      return sendResponse(payload);
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
        return sendResponse(payload, true);
      }

      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "⚡ Pupuk Nutrisi Diaplikasikan!",
        description: `Pod #${res.slotIndex + 1} telah diberi pupuk bio-elektrolit! Waktu panen dipercepat 25% dan hasil panen bertambah +50%!`,
        footerText: ui.getFooter("survival"),
      });

      return sendResponse(payload);
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
        return sendResponse(payload, true);
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
        ]
          .filter(Boolean)
          .join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("gathering", userId)],
        footerText: ui.getFooter("survival"),
      });

      return sendResponse(payload);
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
        return sendResponse(payload, true);
      }

      const payload = buildContainerV2({
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "🚀 Ekspansi Grid Selesai!",
        description: `Selamat! Fasilitas greenhouse berhasil ditingkatkan ke **Level ${res.newLevel}**! Kamu sekarang memiliki total **${res.newMaxSlots} Pod Hidroponik**!`,
        footerText: ui.getFooter("survival"),
      });

      return sendResponse(payload);
    }

    // 8. PERSILANGAN BENIH (CROSS-BREEDING)
    if (action === "breed") {
      const slotA = slotNumber ? slotNumber - 1 : 0;
      const secondSlotOpt = interaction.options?.getInteger?.("slot_kedua");
      const slotB = secondSlotOpt ? secondSlotOpt - 1 : slotA + 1;

      const res = await greenhouseEngine.crossBreedSlots(userId, slotA, slotB);
      if (!res.success) {
        let msg = "Gagal melakukan persilangan benih.";
        if (res.reason === "NOT_ADJACENT") {
          msg = "Dua petak harus berdampingan langsung (misalnya Slot 1 dan Slot 2).";
        } else if (res.reason === "NOT_MATURE") {
          msg = "Kedua tanaman harus sudah matang sempurna 100% untuk disilangkan!";
        } else if (res.reason === "SAME_SPECIES") {
          msg = "Persilangan membutuhkan dua jenis tanaman yang berbeda!";
        } else if (res.reason === "SLOT_EMPTY") {
          msg = "Salah satu atau kedua petak masih kosong!";
        } else if (res.reason === "NO_COMPATIBLE_RECIPE") {
          msg = "Kombinasi kedua tanaman ini tidak menghasilkan varietas hibrida yang kompatibel.";
        }

        const payload = buildErrorContainerV2({
          title: "Persilangan Gagal",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return sendResponse(payload, true);
      }

      const payload = buildContainerV2({
        accentColorHex: "#A855F7",
        authorName: "CYBER-AGRONOMY GREENHOUSE",
        title: "🧬 Mutasi Persilangan Hibrida Berhasil!",
        description: [
          `Selamat, **${displayName}**! ${res.message}`,
          "",
          `🌸 **Varietas Baru:** **${res.hybridSeed.name}**`,
          `⏱️ **Waktu Tumbuh:** ${res.hybridSeed.growTimeMinutes} menit`,
          `> *Benih hibrida ini memiliki nilai nutrisi dan hasil panen jauh lebih unggul!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return sendResponse(payload);
    }

    // 8. ATUR WEBHOOK NOTIFIKASI PANEN PRIBADI (#36)
    if (action === "webhook") {
      const webhookUrl = interaction.options?.getString?.("url");
      const farmWebhook = require("../../../src/services/farmNotificationWebhook");

      if (webhookUrl) {
        if (webhookUrl.toLowerCase() === "hapus" || webhookUrl.toLowerCase() === "delete") {
          await farmWebhook.deleteWebhook(userId);
          const payload = buildContainerV2({
            accentColorHex: "#EF4444",
            authorName: "NOTIFIKASI PANEN GREENHOUSE",
            title: "🗑️ Webhook Berhasil Dihapus",
            description: "Webhook notifikasi panen kamu telah dihapus. Kamu tidak akan lagi menerima peringatan eksternal saat tanaman matang.",
            footerText: ui.getFooter("survival"),
          });
          return sendResponse(payload, true);
        }

        const setRes = await farmWebhook.setWebhook(userId, webhookUrl);
        if (!setRes.success) {
          const payload = buildErrorContainerV2({
            title: "Pengaturan Webhook Gagal",
            description: setRes.message || "URL Webhook tidak valid.",
            footerText: ui.getFooter("survival"),
          });
          return sendResponse(payload, true);
        }

        const payload = buildContainerV2({
          accentColorHex: "#10B981",
          authorName: "NOTIFIKASI PANEN GREENHOUSE",
          title: "📡 Webhook Panen Aktif!",
          description: [
            `Halo, **${displayName}**! Webhook notifikasi panen kamu telah berhasil disimpan.`,
            "",
            `🔗 **Endpoint:** \`${webhookUrl}\``,
            "Bot akan secara otomatis mengirimkan ping payload saat tanaman kosmik kamu siap dipanen!",
            "",
            "> *Ketik `/survival farm aksi:webhook url:hapus` untuk menonaktifkan.*",
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });
        return sendResponse(payload, true);
      }

      // Tampilkan status webhook aktif
      const currentUrl = await farmWebhook.getWebhook(userId);
      const payload = buildContainerV2({
        accentColorHex: "#3B82F6",
        authorName: "NOTIFIKASI PANEN GREENHOUSE",
        title: "📡 Status Webhook Notifikasi",
        description: [
          `Halo, **${displayName}**! Layanan webhook mengirimkan peringatan instan saat pod tanaman kamu matang.`,
          "",
          `🔗 **Status Saat Ini:** ${currentUrl ? `\`${currentUrl}\`` : "⚪ _Belum dikonfigurasi_"}`,
          "",
          "💡 **Cara Mengatur Webhook:**",
          "Ketik: `/survival farm aksi:webhook url:https://discord.com/api/webhooks/...`",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });
      return sendResponse(payload, true);
    }
  },
};
