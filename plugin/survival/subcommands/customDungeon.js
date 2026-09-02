"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const customDungeonEngine = require("../../../src/survival/engines/customDungeonEngine");

module.exports = {
  name: "custom-dungeon",
  description:
    "🏰 Custom Community Dungeon Maker & Arena Tantangan Buatan Pemain",

  async execute(interaction) {
    const action = interaction.options.getString("aksi") || "browse";
    const dungeonName = interaction.options.getString("nama");
    const dungeonId = interaction.options.getString("dungeon_id");
    const theme = interaction.options.getString("tema") || "CYBER_VOID";
    const entryFee = interaction.options.getInteger("tiket") || 100;
    const ratingVote = interaction.options.getInteger("bintang") || 5;

    const user = interaction.user;
    const guildId = interaction.guildId || "dm";
    const displayName =
      interaction.member?.displayName || user.displayName || user.username;

    // 1. JELAJAHI DUNGEON KOMUNITAS
    if (action === "browse") {
      const dungeons = await customDungeonEngine.browseDungeons(guildId);

      if (!dungeons || dungeons.length === 0) {
        const payload = buildContainerV2({
          authorName: "COMMUNITY DUNGEON ARCHITECT",
          title: "🏰 Bursa Dungeon Komunitas Masih Kosong",
          description: [
            `Halo, **${displayName}**! Belum ada dungeon buatan member di server ini.`,
            ``,
            `💡 *Jadilah yang pertama merancang labirin bawah tanah dan raih 5% royalti dari setiap penantang!*`,
            `Gunakan: \`/survival custom-dungeon aksi:Buat Dungeon nama:<Nama Dungeon>\``,
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });

        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const listLines = dungeons
        .map((d, i) => {
          return `**#${i + 1}. ${d.dungeonName}** (\`${d.dungeonId}\`)\n• Tema: \`${d.theme}\` | ⭐ Rating: \`${d.ratingAverage} / 5.0\`\n• Tiket: \`${d.entryFee.toLocaleString("id-ID")}\` Koin | ⚔️ Dimainkan: \`${d.totalPlays}\`x (Tuntas: \`${d.totalClears}\`)\n• Brankas Royalti Kreator: \`${d.vaultBalance.toLocaleString("id-ID")}\` Koin`;
        })
        .join("\n\n");

      const payload = buildContainerV2({
        authorName: "COMMUNITY DUNGEON ARCHITECT",
        title: "🏰 Daftar Dungeon Komunitas Server",
        description: [
          `Pilih dan tantang labirin berbahaya rancangan kreator server:`,
          ``,
          listLines,
          ``,
          `> *Tantang dungeon dengan: \`/survival custom-dungeon aksi:Tantang Dungeon dungeon_id:<ID>\`*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 2. BUAT DUNGEON BARU
    if (action === "create") {
      if (!dungeonName) {
        const payload = buildErrorContainerV2({
          title: "Nama Dungeon Kosong",
          description: "Harap masukkan nama dungeon yang ingin kamu bangun!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      // Default 5 ruangan tantangan terstruktur
      const defaultRooms = [
        { roomNumber: 1, type: "MONSTER", name: "Glitch Sentinel", difficulty: 40 },
        { roomNumber: 2, type: "PUZZLE", name: "Cyber Gatekeeper Cipher", difficulty: 50 },
        { roomNumber: 3, type: "MONSTER", name: "Void Stalker", difficulty: 70 },
        { roomNumber: 4, type: "PUZZLE", name: "Quantum Maze", difficulty: 85 },
        { roomNumber: 5, type: "BOSS", name: "Cybernetic Chimera", difficulty: 110 },
      ];

      const res = await customDungeonEngine.createDungeon(user.id, guildId, {
        dungeonName,
        theme,
        rooms: defaultRooms,
        entryFee,
        initialVault: 500,
      });

      if (!res.success) {
        let msg = "Gagal merancang dungeon.";
        if (res.reason === "INSUFFICIENT_FUNDS") {
          msg = `Saldo koin tidak cukup untuk setoran modal brankas awal (\`${res.required}\` Koin)!`;
        }

        const payload = buildErrorContainerV2({
          title: "Gagal Membangun Dungeon",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const d = res.dungeon;
      const payload = buildContainerV2({
        authorName: "COMMUNITY DUNGEON ARCHITECT",
        title: "🏰 Dungeon Berhasil Didaftarkan!",
        description: [
          `Selamat, **${displayName}**! Dungeon karyamu telah aktif di katalog komunitas server!`,
          ``,
          `🏛️ **Nama:** **${d.dungeonName}** (\`${d.dungeonId}\`)`,
          `🌌 **Tema:** \`${d.theme}\``,
          `🚪 **Jumlah Ruangan:** \`${defaultRooms.length} Ruangan Berbahaya\``,
          `🎟️ **Biaya Tiket Masuk:** \`${d.entryFee.toLocaleString("id-ID")}\` Koin`,
          `💰 **Brankas Awal:** \`${d.vaultBalance.toLocaleString("id-ID")}\` Koin`,
          ``,
          `-# 💡 *Kamu akan menerima 5% royalti otomatis setiap kali ada petualang yang membeli tiket masuk!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 3. TANTANG DUNGEON
    if (action === "play") {
      if (!dungeonId) {
        const payload = buildErrorContainerV2({
          title: "Dungeon ID Belum Diisi",
          description: "Harap masukkan `dungeon_id` yang ingin ditantang!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const res = await customDungeonEngine.playDungeon(user.id, dungeonId);

      if (!res.success) {
        let msg = "Tantangan tidak dapat dimulai.";
        if (res.reason === "DUNGEON_NOT_FOUND") msg = "Dungeon dengan ID tersebut tidak ditemukan!";
        if (res.reason === "INSUFFICIENT_FUNDS") msg = `Saldo koinmu tidak cukup untuk membeli tiket (\`${res.fee}\` Koin)!`;

        const payload = buildErrorContainerV2({
          title: "Ekspedisi Dibatalkan",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (res.cleared) {
        const payload = buildContainerV2({
          authorName: "COMMUNITY DUNGEON ARCHITECT",
          title: "🏆 DUNGEON BERHASIL DITAKLUKKAN!",
          description: [
            `Luar biasa, **${displayName}**! Kamu berhasil menembus seluruh **${res.totalRooms} ruangan** tantangan!`,
            ``,
            `💰 **Hadiah Payout Kemenangan:** \`+${res.rewardCoins.toLocaleString("id-ID")}\` Koin (2x Tiket)`,
            `🩸 **Damage Diterima:** \`-${res.hpLost} HP\``,
            ``,
            `> *Jangan lupa berikan rating bintangmu untuk dungeon ini!*`,
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });

        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        const payload = buildErrorContainerV2({
          title: "💀 Ekspedisi Gagal!",
          description: `Kamu tumbang di Ruangan #${res.roomsCleared + 1} akibat monster yang terlalu kuat! Sembuhkan lukamu dan coba lagi!`,
          footerText: ui.getFooter("survival"),
        });

        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    // 4. RATE DUNGEON
    if (action === "rate") {
      if (!dungeonId) {
        const payload = buildErrorContainerV2({
          title: "Dungeon ID Belum Diisi",
          description: "Harap masukkan `dungeon_id` yang ingin dinilai!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const res = await customDungeonEngine.rateDungeon(dungeonId, ratingVote);
      if (!res.success) {
        const payload = buildErrorContainerV2({
          title: "Rating Gagal",
          description: "Dungeon tidak ditemukan!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const payload = buildContainerV2({
        authorName: "COMMUNITY DUNGEON ARCHITECT",
        title: "⭐ Rating Berhasil Dicatat!",
        description: `Terima kasih! Kamu memberikan nilai **${ratingVote} / 5 Bintang**. Rata-rata rating dungeon ini sekarang: **${res.newRating} ⭐**!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 5. CAIRKAN ROYALTI
    if (action === "withdraw") {
      if (!dungeonId) {
        const payload = buildErrorContainerV2({
          title: "Dungeon ID Belum Diisi",
          description: "Harap masukkan `dungeon_id` brankas milikmu!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const res = await customDungeonEngine.withdrawVault(user.id, dungeonId);
      if (!res.success) {
        let msg = "Gagal mencairkan brankas.";
        if (res.reason === "NOT_CREATOR") msg = "Kamu bukan pemilik kreator dari dungeon ini!";
        if (res.reason === "EMPTY_VAULT") msg = "Brankas royalti dungeon masih kosong!";

        const payload = buildErrorContainerV2({
          title: "Pencairan Gagal",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const payload = buildContainerV2({
        authorName: "COMMUNITY DUNGEON ARCHITECT",
        title: "💰 Royalti Berhasil Dicairkan!",
        description: `Selamat, **${displayName}**! Berhasil mencairkan dana royalti sebesar **+${res.withdrawnAmount.toLocaleString("id-ID")} Koin** ke dalam dompetmu!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
