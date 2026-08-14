"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const CardEngine = require("./cardEngine");
const { drawAnimeCard } = require("../../src/canvas/cardCanvas");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const UserCard = require("../../src/models/UserCard");
const cacheManager = require("../../src/managers/cacheManager");
const redisManager = require("../../src/managers/redisManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("card")
    .setDescription("🎴 Sistem Koleksi Kartu Anime & Minting Global")
    .addSubcommand((sub) =>
      sub
        .setName("drop")
        .setDescription("Munculkan 3 kartu anime untuk diperebutkan di chat!"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("daily")
        .setDescription("Buka 1 kartu gratis harianmu!"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("collection")
        .setDescription("Lihat daftar kartu anime milikmu"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat dan render visual kartu anime")
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("Kode unik kartu (misal: nra-7x9q)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("burn")
        .setDescription("Bakar kartu duplikat untuk mendapatkan Star Fragments")
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("Kode unik kartu yang ingin dibakar")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("dye")
        .setDescription("Warnai bingkai kartu dengan warna Hex pilihanmu (Biaya: 100 NSF)")
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("Kode unik kartu")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("hex")
            .setDescription("Kode warna hex (misal: #FFB6C1 atau #00FFFF)")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === "drop") {
      const dropSession = await CardEngine.createDropSession(interaction.channelId);

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("card_claim_0")
          .setLabel("1️⃣ Klaim Kartu 1")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("card_claim_1")
          .setLabel("2️⃣ Klaim Kartu 2")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("card_claim_2")
          .setLabel("3️⃣ Klaim Kartu 3")
          .setStyle(ButtonStyle.Primary),
      );

      const lines = dropSession.cards.map((c, i) => `**${i + 1}.** ${c.name}, *${c.series}*`);

      const payload = buildContainerV2({
        accentColorHex: "#C084FC",
        authorName: "🎴 Anime Card Drop!",
        title: "Tiga Kartu Telah Muncul di Chat!",
        description: [
          "Siapa cepat dia dapat! Tekan tombol di bawah untuk mengklaim kartu pilihanmu:",
          "",
          lines.join("\n"),
          "",
          "-# Kartu akan kadaluarsa dalam 60 detik bila tidak diklaim.",
        ].join("\n"),
        buttonsRow,
        footerText: "Naura Card Minting Engine",
      });

      return interaction.reply(payload);
    }

    if (subcommand === "daily") {
      await interaction.deferReply();

      // Check daily cooldown
      const cooldownKey = `card:daily_cooldown:${userId}`;
      if (redisManager.isReady) {
        const onCooldown = await redisManager.getCache(cooldownKey);
        if (onCooldown) {
          return interaction.editReply({
            ...buildErrorContainerV2({
              title: "Sudah Klaim Hari Ini",
              description: "Kamu sudah mengklaim booster pack harianmu hari ini. Kembali lagi besok ya!",
              footerText: ui.getFooter("core"),
            }),
          });
        }
        await redisManager.setCache(cooldownKey, "1", 86400); // 24 jam
      }

      const catalog = CardEngine.getCatalog();
      const randomChar = catalog[Math.floor(Math.random() * catalog.length)];
      const minted = await CardEngine.mintCard(randomChar.id, userId);

      const cardBuffer = await drawAnimeCard(minted);
      const attachment = new AttachmentBuilder(cardBuffer, { name: `${minted.cardCode}.png` });

      const payload = buildContainerV2({
        accentColorHex: "#FFD700",
        authorName: "🎁 Daily Free Booster Card",
        title: `✨ ${minted.characterName} (#${minted.printNumber})`,
        description: [
          `Selamat! Kartu harianmu berhasil dicetak:`,
          ``,
          `• **Karakter:** ${minted.characterName}`,
          `• **Seri:** ${minted.seriesName}`,
          `• **Nomor Cetak:** \`#${minted.printNumber}\``,
          `• **Kondisi:** \`${minted.quality}\``,
          `• **Kode Kartu:** \`${minted.cardCode}\``,
        ].join("\n"),
        files: [attachment],
        footerText: "Koleksi semua kartu anime favoritmu!",
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "collection") {
      await interaction.deferReply();
      const cards = await UserCard.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
        limit: 15,
      });

      if (cards.length === 0) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Koleksi Kosong",
            description: "Kamu belum memiliki kartu anime sama sekali. Gunakan `/card drop` atau `/card daily` untuk mulai mengoleksi!",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const lines = cards.map((c) => `• \`${c.cardCode}\` **${c.characterName}** (#${c.printNumber}), \`${c.quality}\``);

      const payload = buildContainerV2({
        accentColorHex: "#93C5FD",
        authorName: `🎴 Koleksi Kartu ${interaction.user.username}`,
        title: `Total Kartu: ${cards.length}`,
        description: lines.join("\n") + "\n\n*Gunakan `/card view code:<kode>` untuk melihat gambar kartu.*",
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "view") {
      const code = interaction.options.getString("code").trim();
      await interaction.deferReply();

      const card = await UserCard.findOne({ where: { cardCode: code } });
      if (!card) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Kartu Tidak Ditemukan",
            description: `Tidak ada kartu dengan kode \`${code}\`. Pastikan kodenya benar.`,
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const cardBuffer = await drawAnimeCard(card.toJSON());
      const attachment = new AttachmentBuilder(cardBuffer, { name: `${card.cardCode}.png` });

      const payload = buildContainerV2({
        accentColorHex: card.dyeColor || "#FFB6C1",
        authorName: "🎴 Visual Anime Card",
        title: `${card.characterName} (#${card.printNumber})`,
        description: [
          `• **Seri:** ${card.seriesName}`,
          `• **Kondisi:** \`${card.quality}\``,
          `• **Pemilik:** <@${card.userId}>`,
          `• **Kode Kartu:** \`${card.cardCode}\``,
        ].join("\n"),
        files: [attachment],
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "burn") {
      const code = interaction.options.getString("code").trim();
      await interaction.deferReply();

      const card = await UserCard.findOne({ where: { cardCode: code, userId } });
      if (!card) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Kartu Tidak Ditemukan",
            description: "Kartu tidak ditemukan atau bukan milikmu.",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const rewardFrag = card.burnValue || 100;
      await card.destroy();
      await cacheManager.incrementUserSurvival(userId, "starFragments", rewardFrag);

      const payload = buildContainerV2({
        accentColorHex: "#E74C3C",
        title: "🔥 Kartu Berhasil Dibakar",
        description: `Kartu **${card.characterName}** (\`${card.cardCode}\`) telah dilebur menjadi **+${rewardFrag} Star Fragments** 🌟`,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "dye") {
      const code = interaction.options.getString("code").trim();
      const hex = interaction.options.getString("hex").trim();
      await interaction.deferReply();

      const card = await UserCard.findOne({ where: { cardCode: code, userId } });
      if (!card) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Kartu Tidak Ditemukan",
            description: "Kartu tidak ditemukan atau bukan milikmu.",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      card.dyeColor = hex;
      await card.save();

      const payload = buildContainerV2({
        accentColorHex: hex,
        title: "🎨 Kartu Berhasil Diwarnai!",
        description: `Kartu **${card.characterName}** kini memancarkan aura warna \`${hex}\`!`,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }
  },
};
