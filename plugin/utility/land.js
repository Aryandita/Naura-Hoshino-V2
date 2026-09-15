"use strict";

const { SlashCommandBuilder } = require("discord.js");
const landEngine = require("../../src/survival/engines/landEngine");
const cacheManager = require("../../src/managers/cacheManager");
const GuildClan = require("../../src/models/GuildClan");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("land")
    .setDescription("🏰 Kelola Metaverse Land, Istana Klan, & Fasilitas Riset Teknologi.")
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Lihat status kapling tanah dan struktur klan di server."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("claim")
        .setDescription("Klaim kapling tanah virtual baru pada grid koordinat (1..8).")
        .addIntegerOption((opt) =>
          opt
            .setName("x")
            .setDescription("Koordinat X (1..8)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(8),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("y")
            .setDescription("Koordinat Y (1..8)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(8),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("upgrade")
        .setDescription("Upgrade struktur bangunan di atas tanah klan.")
        .addIntegerOption((opt) =>
          opt
            .setName("x")
            .setDescription("Koordinat X kapling")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(8),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("y")
            .setDescription("Koordinat Y kapling")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(8),
        )
        .addStringOption((opt) =>
          opt
            .setName("struktur")
            .setDescription("Struktur yang ingin di-upgrade")
            .setRequired(true)
            .addChoices(
              { name: "Istana Klan (Guild Castle)", value: "castle" },
              { name: "Menara Pertahanan (Defense Tower)", value: "defense_tower" },
              { name: "Fasilitas Riset (Tech Lab)", value: "research_lab" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tech")
        .setDescription("Lihat daftar bonus riset teknologi bersama yang aktif."),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const subCmd = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const survival = await cacheManager.getUserSurvival(userId);
    if (!survival || !survival.clanId) {
      const err = buildErrorContainerV2({
        title: "🏰 Akses Tanah Ditolak",
        description: "Kamu harus menjadi anggota klan terlebih dahulu untuk mengelola kapling tanah Metaverse!",
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply(err);
    }

    const clan = await GuildClan.findByPk(survival.clanId);
    if (!clan) {
      const err = buildErrorContainerV2({
        title: "🏰 Klan Tidak Ditemukan",
        description: "Data klanmu tidak ditemukan di sistem.",
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply(err);
    }

    if (subCmd === "status") {
      const landData = await landEngine.getGuildLand(guildId);
      const clanStats = await landEngine.getClanLandStats(guildId, clan.id);

      const plotEntries = Object.entries(landData.plots).filter(
        ([, p]) => p.clanId === clan.id,
      );

      const plotList =
        plotEntries.length > 0
          ? plotEntries
              .map(
                ([coord, p]) =>
                  `• **Kapling (${coord})**: Castle Lv.${p.structures.castle || 0} | Tower Lv.${p.structures.defense_tower || 0} | Lab Lv.${p.structures.research_lab || 0}`,
              )
              .join("\n")
          : "*Klan kamu belum memiliki kapling tanah. Gunakan `/land claim` untuk mengklaim!*";

      const payload = buildContainerV2({
        accentColorHex: "#3B82F6",
        authorName: "Naura Metaverse Land",
        title: `🏰 Metaverse Land & Castles: ${clan.name}`,
        description: [
          `Pusat teritorial dan tanah virtual milik klan **${clan.name}** di server ini.`,
          "",
          `📊 **Total Kapling Dimiliki:** \`${clanStats.plotsOwned} Plot\``,
          `🛡️ **Bonus Pertahanan Klan:** \`+${clanStats.totalDefense} DEF\``,
          `💰 **Kapasitas Ekstra Brankas:** \`+${clanStats.totalVaultBonus.toLocaleString("id-ID")} NSF\``,
          `👥 **Kapasitas Ekstra Anggota:** \`+${clanStats.maxMembersBonus} Member\``,
          "",
          "📍 **Daftar Kapling & Fasilitas:**",
          plotList,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    if (subCmd === "claim") {
      const x = interaction.options.getInteger("x");
      const y = interaction.options.getInteger("y");

      const result = await landEngine.claimPlot({
        guildId,
        clanId: clan.id,
        x,
        y,
      });

      if (!result.success) {
        const err = buildErrorContainerV2({
          title: "❌ Gagal Mengklaim Tanah",
          description: result.error,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(err);
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22C55E",
        authorName: "Naura Metaverse Land",
        title: "✨ Kapling Tanah Berhasil Diklaim!",
        description: [
          `Selamat! Klan **${clan.name}** berhasil mengklaim kapling virtual di koordinat **(${x}, ${y})**.`,
          "",
          "> 🏰 **Struktur Awal:** Frontier Outpost (Lv. 1)",
          "> 💰 **Biaya Konstruksi:** `1.000 Star Fragments` (Dipotong dari Kas Klan)",
          "> 🛠️ **Langkah Berikutnya:** Gunakan `/land upgrade` untuk mendirikan Menara Pertahanan atau Lab Riset!",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    if (subCmd === "upgrade") {
      const x = interaction.options.getInteger("x");
      const y = interaction.options.getInteger("y");
      const structureType = interaction.options.getString("struktur");

      const result = await landEngine.upgradeStructure({
        guildId,
        clanId: clan.id,
        x,
        y,
        structureType,
      });

      if (!result.success) {
        const err = buildErrorContainerV2({
          title: "❌ Gagal Upgrade Struktur",
          description: result.error,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(err);
      }

      const payload = buildContainerV2({
        accentColorHex: "#8B5CF6",
        authorName: "Naura Metaverse Land",
        title: "⚡ Konstruksi Fasilitas Berhasil!",
        description: [
          `Fasilitas di kapling **(${x}, ${y})** berhasil ditingkatkan!`,
          "",
          `> 🏗️ **Bangunan:** \`${result.structureName}\` (Level ${result.newLevel})`,
          `> 💰 **Biaya:** \`${result.cost.toLocaleString("id-ID")} Star Fragments\``,
          "> 📈 **Dampak:** Manfaat bonus pertahanan atau riset klan langsung diterapkan secara otomatis.",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    if (subCmd === "tech") {
      const clanStats = await landEngine.getClanLandStats(guildId, clan.id);
      const buffLines =
        clanStats.activeBuffs.length > 0
          ? clanStats.activeBuffs.map((b) => `• 🔬 **${b}** aktif`).join("\n")
          : "*Belum ada teknologi aktif. Bangun Tech Lab di kapling tanahmu!*";

      const payload = buildContainerV2({
        accentColorHex: "#06B6D4",
        authorName: "Naura Tech Lab",
        title: `🔬 Riset Teknologi Bersama: ${clan.name}`,
        description: [
          "Fasilitas riset teknologi memberikan buff pasif bagi seluruh anggota klan.",
          "",
          "📜 **Status Riset Aktif:**",
          buffLines,
          "",
          "-# 💡 *Bangun dan upgrade Tech Lab di `/land upgrade` untuk membuka teknologi baru!*",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }
  },
};
