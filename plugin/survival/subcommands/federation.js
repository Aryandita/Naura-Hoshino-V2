"use strict";

const { MessageFlags } = require("discord.js");
const guildFederationEngine = require("../../../src/survival/engines/guildFederationEngine");
const GuildClan = require("../../../src/models/GuildClan");
const UserSurvival = require("../../../src/models/UserSurvival");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = {
  name: "federation",
  description: "🌐 Hub Federasi Aliansi Klan Lintas-Server & Global Hall of Fame",

  async execute(interaction) {
    const action = interaction.options.getString("aksi") || "status";
    const user = interaction.user;
    const guild = interaction.guild;
    const displayName =
      interaction.member?.displayName || user.displayName || user.username;

    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    // 1. HALL OF FAME (Global Leaderboard Aliansi)
    if (action === "halloffame") {
      const hall = await guildFederationEngine.getHallOfFame(10);
      const lines = hall.map((fed, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎖️";
        const memberCount = fed.memberClans?.length || 1;
        return `${medal} **#${idx + 1} [${fed.tag}] ${fed.name}**\n   ⭐ Prestise: \`${fed.prestige}\` | 🐉 Kemenangan Boss: \`${fed.bossVictories || 0}\` | 🏰 \`${memberCount} Klan Tergabung\``;
      });

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "GLOBAL CLAN FEDERATION",
        title: "🏆 Global Hall of Fame: Aliansi Klan Antar-Server",
        description: [
          `Papan peringkat kehormatan aliansi klan terbesar di seluruh galaksi Naura Wilds:\n`,
          lines.join("\n\n"),
          `\n> *Gunakan \`/survival federation aksi:create\` untuk mendirikan aliansi klanmu sendiri!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Pengecekan keanggotaan klan untuk aksi klan spesifik
    if (!survival.clanId) {
      const payload = buildErrorContainerV2({
        title: "Belum Memiliki Klan",
        description:
          "Kamu harus bergabung atau mendirikan klan terlebih dahulu sebelum dapat mengakses fitur Aliansi Federasi!\n\n> *Gunakan `/survival clan aksi:create` atau `/survival clan aksi:join`.*",
        footerText: ui.getFooter("survival"),
      });
      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const userClan = await GuildClan.findByPk(survival.clanId);
    if (!userClan) {
      const payload = buildErrorContainerV2({
        title: "Klan Tidak Ditemukan",
        description: "Data klanmu tidak ditemukan di database server.",
        footerText: ui.getFooter("survival"),
      });
      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 2. STATUS ALLIANCE RAID BOSS
    if (action === "boss") {
      const boss = guildFederationEngine.getAllianceBoss();
      const hpPercent = Math.max(0, Math.round((boss.hp / boss.maxHp) * 100));

      const payload = buildContainerV2({
        accentColorHex: "#F43F5E",
        authorName: "ALLIANCE RAID COMBAT",
        title: `🐉 Alliance Raid Boss: ${boss.name} (Fase ${boss.phase})`,
        description: [
          `Bos kuno antar-dimensi sedang mengancam stabilitas galaksi! Seluruh klan anggota aliansi wajib bersatu mengerahkan kekuatan tempur.\n`,
          `❤️ **Status HP Bos:** \`${boss.hp.toLocaleString("id-ID")} / ${boss.maxHp.toLocaleString("id-ID")}\` (\`${hpPercent}%\`)`,
          `🌀 **Fase Tempur:** \`Fase ${boss.phase}\``,
          `🏰 **Klan Penantang:** **${userClan.name}**`,
          `\n*Serangan kolektif akan mendistribusikan hadiah dividen Star Fragments ke brankas klan anggota saat bos tumbang!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 3. CREATE FEDERATION (Hanya Pemimpin Klan)
    if (action === "create") {
      if (userClan.leaderId !== user.id) {
        const payload = buildErrorContainerV2({
          title: "Izin Ditolak",
          description: "Hanya Ketua Pemimpin Klan yang memiliki wewenang untuk mendirikan Aliansi Federasi baru!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const fedName = interaction.options.getString("nama");
      const fedTag = interaction.options.getString("tag");

      if (!fedName || !fedTag) {
        const payload = buildErrorContainerV2({
          title: "Input Belum Lengkap",
          description: "Silakan masukkan parameter `nama` dan `tag` (maksimal 5 karakter) untuk aliansi federasi barumu!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const createRes = await guildFederationEngine.createFederation({
        name: fedName,
        tag: fedTag,
        leaderClanId: userClan.id,
        guildId: guild.id,
      });

      if (!createRes.success) {
        const payload = buildErrorContainerV2({
          title: "Gagal Mendirikan Aliansi",
          description: createRes.error || "Terjadi kesalahan saat mendirikan federasi.",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const fed = createRes.federation;
      const payload = buildContainerV2({
        accentColorHex: "#10B981",
        authorName: "GLOBAL CLAN FEDERATION",
        title: "🎉 Aliansi Federasi Berhasil Didirikan!",
        description: [
          `Selamat kepada Pemimpin **${displayName}** dan Klan **${userClan.name}**!`,
          `Aliansi federasi klan antar-server resmi berdiri di jaringan galaksi Naura Wilds.\n`,
          `🌐 **Nama Aliansi:** **${fed.name}**`,
          `🏷️ **Tag Aliansi:** \`[${fed.tag}]\``,
          `🆔 **Federation ID:** \`${fed.id}\``,
          `⭐ **Prestise Awal:** \`${fed.prestige} Poin\``,
          `\n> *Bagikan Federation ID di atas kepada klan lain agar mereka dapat bergabung via \`/survival federation aksi:join\`!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 4. JOIN FEDERATION
    if (action === "join") {
      if (userClan.leaderId !== user.id) {
        const payload = buildErrorContainerV2({
          title: "Izin Ditolak",
          description: "Hanya Pemimpin Klan yang dapat mendaftarkan klan ke dalam aliansi federasi!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const fedId = interaction.options.getString("federation_id");
      if (!fedId) {
        const payload = buildErrorContainerV2({
          title: "ID Federasi Diperlukan",
          description: "Silakan masukkan `federation_id` aliansi yang ingin kamu ikuti!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const joinRes = await guildFederationEngine.joinFederation(
        fedId.trim(),
        userClan.id,
        guild.id,
      );

      if (!joinRes.success) {
        const payload = buildErrorContainerV2({
          title: "Gagal Bergabung ke Aliansi",
          description: joinRes.error || "Federasi tidak ditemukan atau sudah penuh.",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const fed = joinRes.federation;
      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "GLOBAL CLAN FEDERATION",
        title: "🤝 Sukses Bergabung ke Aliansi Federasi!",
        description: [
          `Klan **${userClan.name}** resmi menjadi anggota aliansi **${fed.name}** [${fed.tag}]!`,
          `Kontribusi kekuatan klanmu menambah prestise aliansi sebesar **+50 Poin**.\n`,
          `👥 **Total Klan Anggota:** \`${fed.memberClans.length} / 10 Klan\``,
          `⭐ **Total Prestise Aliansi:** \`${fed.prestige} Poin\``,
          `\n> *Ayo bersama-sama tantang Alliance Raid Boss via \`/survival federation aksi:boss\`!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 5. STATUS DEFAULT
    const payload = buildContainerV2({
      accentColorHex: "#6366F1",
      authorName: "GLOBAL CLAN FEDERATION",
      title: "🌐 Hub Federasi Aliansi Antar-Server",
      description: [
        `Halo, **${displayName}**! Hub Federasi Aliansi memungkinkan klan-klan dari berbagai server berkolaborasi membentuk aliansi pertahanan dan raid bersama.\n`,
        `🏰 **Klan Kamu Saat Ini:** **${userClan.name}** (Level ${userClan.level})`,
        `💰 **Kas Klan:** \`${(userClan.vault || 0).toLocaleString("id-ID")} Star Fragments\``,
        `\n**Pilihan Perintah Aliansi:**`,
        `• \`/survival federation aksi:halloffame\` - Papan peringkat prestise aliansi global.`,
        `• \`/survival federation aksi:boss\` - Status pertempuran Alliance Raid Boss kolektif.`,
        `• \`/survival federation aksi:create nama:<...> tag:<...>\` - Dirikan federasi baru (Ketua Klan).`,
        `• \`/survival federation aksi:join federation_id:<...>\` - Bergabung ke federasi yang ada.`,
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });

    return interaction.reply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
