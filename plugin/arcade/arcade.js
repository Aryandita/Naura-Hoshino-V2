"use strict";

const path = require("node:path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const arcadeContract = require("../../src/domain/contracts/arcadeContract");
const ArcadeEngine = require("../../src/survival/engines/arcadeEngine");
const ui = require("../../src/config/ui");
const languageManager = require("../../src/managers/languageManager");
const { logger } = require("../../src/managers/logger");

function n(num) {
  return (Number(num) || 0).toLocaleString("id-ID");
}

function t(lang, key, params = {}) {
  return languageManager.translateSync(lang, key, params);
}

async function respond(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

// Semua game yang tersedia di arcade
const ALL_GAMES = {
  blackjack: { label: "Blackjack 21", emoji: "🃏", desc: "Bermain kartu 21 melawan dealer Naura" },
  typerace: { label: "Type Race", emoji: "⌨️", desc: "Uji kecepatan mengetik WPM berbatas waktu" },
  tictactoe: { label: "Tic Tac Toe", emoji: "❌", desc: "Adu taktik 3x3 PvP atau lawan Bot" },
  rps: { label: "Batu Gunting Kertas", emoji: "✂️", desc: "Adu insting klasik melawan AI atau teman" },
  trivia: { label: "Trivia", emoji: "🧠", desc: "Kuis pengetahuan umum dari berbagai topik" },
  math: { label: "Matematika Cepat", emoji: "🧮", desc: "Uji kecepatan berhitung di bawah tekanan waktu" },
  hangman: { label: "Hangman", emoji: "🔤", desc: "Tebak kata huruf per huruf sebelum tali terpasang" },
  memory: { label: "Memory Match", emoji: "🎴", desc: "Cocokkan pasangan emoji yang tersembunyi" },
  wordle: { label: "Wordle", emoji: "📝", desc: "Tebak kata 5 huruf dalam 6 kesempatan" },
  minesweeper: { label: "Minesweeper", emoji: "💣", desc: "Bongkar papan ranjau klasik tanpa meledak" },
  akinator: { label: "Akinator AI", emoji: "🧞", desc: "Tebak karakter yang sedang kamu pikirkan" },
  tod: { label: "Truth or Dare", emoji: "🎭", desc: "Permainan kejujuran dan tantangan seru" },
  tebakkata: { label: "Tebak Kata Anagram", emoji: "🔠", desc: "Susun kembali huruf yang teracak menjadi kata benar" },
  tebakgambar: { label: "Tebak Gambar", emoji: "🖼️", desc: "Tebak nama benda dari gambar yang ditampilkan" },
  duel: { label: "Duel PvP", emoji: "⚔️", desc: "Tantang pemain lain dalam pertarungan strategis" },
};

// Build game choices for slash command option
const GAME_CHOICES = Object.entries(ALL_GAMES).map(([key, game]) => ({
  name: `${game.emoji} ${game.label}`,
  value: key,
}));

module.exports = {
  ALL_GAMES,
  respond,

  data: new SlashCommandBuilder()
    .setName("arcade")
    .setDescription("🎮 Naura Arcade - Main game dengan Medali Permainan (MP)")
    .addSubcommand((sub) =>
      sub
        .setName("hub")
        .setDescription("🕹️ Buka menu pilih game dengan dropdown interaktif"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("🎮 Main game langsung (biaya 5 MP)")
        .addStringOption((opt) =>
          opt
            .setName("game")
            .setDescription("Pilih game yang ingin dimainkan")
            .setRequired(true)
            .addChoices(...GAME_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("daily")
        .setDescription("🎁 Klaim 50 MP gratis setiap hari"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("leaderboard")
        .setDescription("🏆 Lihat peringkat pemain terbaik")
        .addStringOption((opt) =>
          opt
            .setName("scope")
            .setDescription("Cakupan leaderboard")
            .addChoices(
              { name: "Server (Guild)", value: "guild" },
              { name: "Global", value: "global" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("profile")
        .setDescription("👤 Cek saldo MP dan status harian"),
    ),

  async execute(interaction) {
    const user = interaction.user;
    const lang = (await require("../../src/models/UserProfile").findByPk(user.id, { attributes: ["language"] }))?.language || "id";
    const subcommand = (interaction.options && typeof interaction.options.getSubcommand === "function")
      ? interaction.options.getSubcommand()
      : "hub";

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (subcommand === "profile") {
      return this.showProfile(interaction, user, lang);
    }
    if (subcommand === "daily") {
      return this.claimDaily(interaction, user, lang);
    }
    if (subcommand === "leaderboard") {
      return this.showLeaderboard(interaction, user, lang);
    }
    if (subcommand === "play") {
      return this.playGame(interaction, user, lang);
    }
    if (subcommand === "hub") {
      return this.showHub(interaction, user, lang);
    }
    return this.showHub(interaction, user, lang);
  },

  async showHub(interaction, user, lang) {
    const mp = await arcadeContract.getBalance(user.id);
    const hasClaimed = await arcadeContract.hasClaimedDaily(user.id);
    const emoji = ui.getEmoji("medali_permainan") || "🏅";

    // Build select menu options for all games
    const gameOptions = Object.entries(ALL_GAMES).map(([key, game]) => ({
      label: game.label,
      value: key,
      emoji: game.emoji,
      description: game.desc,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("arcade_select_game")
      .setPlaceholder("Pilih game untuk dimainkan...")
      .addOptions(gameOptions.slice(0, 25)); // Max 25 options

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("arcade_daily")
        .setLabel(hasClaimed ? "Sudah Diklaim" : "Klaim Harian (+50 MP)")
        .setStyle(ButtonStyle.Success)
        .setDisabled(hasClaimed)
        .setEmoji("🎁"),
      new ButtonBuilder()
        .setCustomId("arcade_profile")
        .setLabel("Profil & Saldo")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("👤"),
      new ButtonBuilder()
        .setCustomId("arcade_leaderboard")
        .setLabel("Leaderboard")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏆"),
    );

    const desc = [
      `### 🎮 Naura Arcade Hub`,
      "",
      `${emoji} **Saldo MP:** \`${n(mp)}\``,
      `**Daily:** ${hasClaimed ? "✅ Sudah Diklaim" : "🎁 Tersedia (+50 MP)"}`,
      "",
      `**Cara Bermain:**`,
      `1. Pilih game dari menu dropdown di bawah`,
      `2. Biaya **5 MP** dipotong otomatis`,
      `3. Menang: **+25 MP** | Seri: **+5 MP** | Kalah: **0 MP**`,
      "",
      `-# Gunakan \`/arcade daily\` untuk klaim 50 MP gratis setiap hari!`,
    ].join("\n");

    const payload = buildContainerV2({
      accentColorHex: "#9B59B6",
      authorName: "Naura Arcade",
      title: "🕹️ Selamat datang di Naura Arcade!",
      iconURL: user.displayAvatarURL(),
      description: desc,
      buttonsRow: [buttonsRow],
      components: [row],
      footerText: "Naura Hoshino Ecosystem • Arcade System v2",
    });

    return respond(interaction, payload);
  },

  async showProfile(interaction, user, lang) {
    const mp = await arcadeContract.getBalance(user.id);
    const hasClaimed = await arcadeContract.hasClaimedDaily(user.id);

    const emoji = ui.getEmoji("medali_permainan") || "🏅";

    const desc = [
      `### 🎮 Profil Arcade: ${user.displayName || user.username}`,
      "",
      `${emoji} **Medali Permainan (MP):** \`${n(mp)}\``,
      "",
      `**Hadiah Harian:** ${hasClaimed ? "✅ Sudah Diklaim" : "🎁 Tersedia (+50 MP)"}`,
      "",
      `**Game Tersedia (${Object.keys(ALL_GAMES).length}):**`,
      ...Object.entries(ALL_GAMES).slice(0, 8).map(([k, g]) => `> ${g.emoji} **${g.label}** - ${g.desc}`),
      `> ...dan ${Object.keys(ALL_GAMES).length - 8} game lainnya!`,
      "",
      `-# Setiap game: Biaya 5 MP | Menang +25 MP | Seri +5 MP | Kalah 0 MP`,
    ].join("\n");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("arcade_daily")
        .setLabel(hasClaimed ? "Sudah Diklaim" : "Klaim Harian (+50 MP)")
        .setStyle(ButtonStyle.Success)
        .setDisabled(hasClaimed)
        .setEmoji("🎁"),
      new ButtonBuilder()
        .setCustomId("arcade_hub")
        .setLabel("Main Game")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎮"),
      new ButtonBuilder()
        .setCustomId("arcade_leaderboard")
        .setLabel("Leaderboard")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏆"),
    );

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura Arcade",
      title: "🎮 Profil Arcade & Medali Permainan",
      iconURL: user.displayAvatarURL(),
      description: desc,
      buttonsRow: [row],
      footerText: "Naura Hoshino Ecosystem • Arcade System",
    });

    return respond(interaction, payload);
  },

  async claimDaily(interaction, user, lang) {
    const result = await arcadeContract.claimDaily(user.id);

    if (!result.ok) {
      const messages = {
        ALREADY_CLAIMED: t(lang, "arcade.daily.already_claimed"),
        INVALID_USER: t(lang, "arcade.daily.invalid_user"),
      };
      return respond(interaction, {
        ...buildContainerV2({
          accentColorHex: ui.getColor("error") || "#EF4444",
          authorName: "Naura Arcade",
          title: t(lang, "arcade.daily.failed"),
          description: messages[result.reason] || t(lang, "arcade.daily.error"),
          footerText: "Naura Hoshino Ecosystem • Arcade System",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const emoji = ui.getEmoji("medali_permainan") || "🏅";

    return respond(interaction, {
      ...buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        authorName: "Naura Arcade",
        title: t(lang, "arcade.daily.success"),
        description: [
          `${emoji} **Berhasil klaim hadiah harian!**`,
          "",
          `> **+${n(result.amount)} MP** ditambahkan ke saldo`,
          `> **Saldo sekarang:** \`${n(result.balance)}\` MP`,
          "",
          `-# Hadiah harian: 50 MP • Reset tiap hari jam 07:00 UTC`,
        ].join("\n"),
        footerText: "Naura Hoshino Ecosystem • Arcade System",
      }),
    });
  },

  async showLeaderboard(interaction, user, lang) {
    const scope = (interaction.options && typeof interaction.options.getString === "function"
      ? interaction.options.getString("scope")
      : null) || "guild";
    const isGlobal = scope === "global";

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const leaderboard = isGlobal
      ? await arcadeContract.getGlobalLeaderboard(10)
      : await arcadeContract.getLeaderboard(interaction.guildId, 10);

    if (!leaderboard || leaderboard.length === 0) {
      return respond(interaction, {
        ...buildContainerV2({
          accentColorHex: ui.getColor("warning") || "#F59E0B",
          authorName: "Naura Arcade",
          title: t(lang, "arcade.leaderboard.empty"),
          description: t(lang, "arcade.leaderboard.no_data"),
          footerText: "Naura Hoshino Ecosystem • Arcade System",
        }),
      });
    }

    const lines = leaderboard.map((entry, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      return `${medal} <@${entry.userId}>, \`${n(entry.mp)}\` MP`;
    });

    const emoji = ui.getEmoji("medali_permainan") || "🏅";

    return respond(interaction, {
      ...buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Arcade",
        title: `${emoji} Leaderboard ${isGlobal ? "Global" : "Server"}`,
        description: lines.join("\n"),
        footerText: "Naura Hoshino Ecosystem • Arcade System",
      }),
    });
  },

  async playGame(interaction, user, lang, chosenGame = null) {
    const gameType = chosenGame ||
      (interaction.options && typeof interaction.options.getString === "function"
        ? interaction.options.getString("game")
        : null);

    const gameInfo = ALL_GAMES[gameType];

    if (!gameInfo) {
      return respond(interaction, {
        ...buildContainerV2({
          accentColorHex: ui.getColor("error") || "#EF4444",
          authorName: "Naura Arcade",
          title: "❌ Game Tidak Ditemukan",
          description: `Game \`${gameType || "tidak diketahui"}\` tidak tersedia. Gunakan \`/arcade hub\` untuk melihat daftar game.`,
          footerText: "Naura Hoshino Ecosystem • Arcade System",
        }),
      });
    }

    const preGame = await ArcadeEngine.preGame(user.id, gameType);
    if (!preGame.ok) {
      return respond(interaction, {
        ...buildContainerV2({
          accentColorHex: ui.getColor("error") || "#EF4444",
          authorName: "Naura Arcade",
          title: t(lang, "arcade.play.insufficient"),
          description: [
            `MP kamu tidak cukup untuk bermain **${gameInfo.label}**.`,
            "",
            `> **Biaya:** 5 MP`,
            `> **Saldo kamu:** \`${n(preGame.balance)}\` MP`,
            `> **Butuh:** \`${n(preGame.need || 5)}\` MP`,
            "",
            `-# Klaim daily (+50 MP) atau main game lain untuk dapat MP.`,
          ].join("\n"),
          footerText: "Naura Hoshino Ecosystem • Arcade System",
        }),
      });
    }

    try {
      const subcommandFile = path.join(__dirname, "subcommands", `${gameType}.js`);
      let subcommandModule;

      try {
        subcommandModule = require(subcommandFile);
      } catch (e) {
        logger.error(`[Arcade] Failed to require ${subcommandFile}:`, e.message);
        return respond(interaction, {
          ...buildContainerV2({
            accentColorHex: ui.getColor("error") || "#EF4444",
            authorName: "Naura Arcade",
            title: "❌ Game Engine Tidak Ditemukan",
            description: `Engine untuk **${gameInfo.label}** belum tersedia. Coba game lain!`,
            footerText: "Naura Hoshino Ecosystem • Arcade System",
          }),
        });
      }

      if (!subcommandModule || typeof subcommandModule.execute !== "function") {
        return respond(interaction, {
          ...buildContainerV2({
            accentColorHex: ui.getColor("error") || "#EF4444",
            authorName: "Naura Arcade",
            title: "❌ Game Engine Invalid",
            description: `Engine untuk **${gameInfo.label}** tidak valid. Hubungi developer.`,
            footerText: "Naura Hoshino Ecosystem • Arcade System",
          }),
        });
      }

      const cacheManager = require("../../src/managers/cacheManager");
      const { getUserPremiumTier, getMinigameMultiplier } = require("../../src/premium/premiumHelper");

      const profile = await cacheManager.getUserProfile(user.id);
      const survival = await cacheManager.getUserSurvival(user.id);
      const premiumTier = getUserPremiumTier(profile);
      const nsfMultiplier = getMinigameMultiplier(premiumTier);
      const nsfEmoji = ui.getEmoji("nsf") || ui.getEmoji("star_fragment") || "⭐";

      const context = {
        user,
        profile,
        survival,
        premiumTier,
        nsfMultiplier,
        nsfEmoji,
        coinEmoji: `${nsfEmoji} MP`,
        sendError: (msg) => {
          return respond(interaction, {
            ...buildContainerV2({
              accentColorHex: ui.getColor("error") || "#EF4444",
              authorName: "Naura Arcade",
              title: "❌ Error",
              description: msg,
              footerText: "Naura Hoshino Ecosystem • Arcade System",
            }),
          });
        },
      };

      await subcommandModule.execute(interaction, context);
    } catch (err) {
      logger.error(`[Arcade] Error launching game ${gameType}:`, err.message);
      return respond(interaction, {
        ...buildContainerV2({
          accentColorHex: ui.getColor("error") || "#EF4444",
          authorName: "Naura Arcade",
          title: "❌ Gagal Memulai Game",
          description: `Terjadi kesalahan saat memulai **${gameInfo.label}**. Fee 5 MP telah dipotong.`,
          footerText: "Naura Hoshino Ecosystem • Arcade System",
        }),
      });
    }
  },
};
