"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { SlashCommandBuilder, ButtonStyle } = require("discord.js");
const UserProfile = require("../../src/models/UserProfile");
const UserSurvival = require("../../src/models/UserSurvival");
const ui = require("../../src/config/ui");
const { buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const {
  getUserPremiumTier,
  getMinigameMultiplier,
} = require("../../src/premium/premiumHelper");
const { showMinigameIntro } = require("./helpers/minigameShared");

const subcommands = new Map();
const subcommandsPath = path.join(__dirname, "subcommands");
if (fs.existsSync(subcommandsPath)) {
  const files = fs
    .readdirSync(subcommandsPath)
    .filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const sub = require(path.join(subcommandsPath, file));
    if (sub && sub.name && typeof sub.execute === "function") {
      subcommands.set(sub.name, sub);
    }
  }
}

async function runMinigameLogic(interaction) {
  const subcommandName = interaction.options.getSubcommand();
  const user = interaction.user;

  const [profile] = await UserProfile.findOrCreate({
    where: { userId: user.id },
  });
  const [survival] = await UserSurvival.findOrCreate({
    where: { userId: user.id },
  });

  const premiumTier = getUserPremiumTier(profile);
  const nsfMultiplier = getMinigameMultiplier(premiumTier);

  const nsfEmoji = ui.getEmoji("nsf") || ui.getEmoji("star_fragment") || "⭐";
  const coinEmoji = `${nsfEmoji} NSF`;
  const errorEmoji = ui.emojis.error || "❌";
  const sendError = (msg) => {
    const errPayload = buildErrorContainerV2({
      title: "Gagal",
      description: `${errorEmoji} ${msg}`,
      footerText: ui.getFooter("core"),
    });
    return interaction.editReply(errPayload);
  };

  const context = {
    user,
    profile,
    survival,
    premiumTier,
    nsfMultiplier,
    nsfEmoji,
    coinEmoji,
    sendError,
  };

  const sub = subcommands.get(subcommandName);
  if (!sub) {
    return sendError(`Minigame '${subcommandName}' tidak ditemukan.`);
  }

  const executeGame = () => sub.execute(interaction, context);

  if (subcommandName === "leaderboard") {
    return executeGame();
  }

  return showMinigameIntro(interaction, subcommandName, executeGame);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("minigame")
    .setDescription("🎮 Buka Arena Minigame dan Arcade interaktif Naura Hoshino")
    .addSubcommand((sub) =>
      sub
        .setName("blackjack")
        .setDescription("🃏 Bermain Blackjack 21 kartu standar melawan dealer Naura")
        .addIntegerOption((opt) =>
          opt
            .setName("taruhan")
            .setDescription("Jumlah Star Fragments (NSF) yang dipertaruhkan")
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(50000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("typerace")
        .setDescription("⌨️ Uji kecepatan mengetik WPM berbatas waktu")
        .addStringOption((opt) =>
          opt
            .setName("kesulitan")
            .setDescription("Tingkat kesulitan teks")
            .addChoices(
              { name: "Mudah (Kalimat Pendek)", value: "easy" },
              { name: "Sedang (Paragraf Standar)", value: "medium" },
              { name: "Sulit (Kutipan Tantangan)", value: "hard" },
            ),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("taruhan")
            .setDescription("Jumlah NSF yang dipertaruhkan (opsional)")
            .setRequired(false)
            .setMinValue(10)
            .setMaxValue(10000),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options?.getSubcommand?.(false);
    if (subcommand) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
      return runMinigameLogic(interaction);
    }

    const { buildInteractiveHubPayload } = require("../../src/utils/hubMenuHelper");
    const payload = buildInteractiveHubPayload({
      title: "🎮 Naura Arcade dan Minigame Arena",
      authorName: "Naura Minigames Hub",
      description: [
        "Selamat datang di **Arena Minigame Naura**! ✨",
        "Pilih tantangan asah otak, game refleks, atau adu insting bersama pemain lain untuk memenangkan hadiah **NSF** dan skor peringkat.",
        "",
        "💡 *Gunakan tombol pintas atau pilih game dari menu dropdown di bawah untuk mulai bermain.*",
      ].join("\n"),
      accentColorHex: "#9B59B6",
      quickButtons: [
        { id: "minesweeper", label: "Minesweeper", emoji: "💣", style: ButtonStyle.Danger },
        { id: "arcade", label: "Arcade Games", emoji: "🕹️", style: ButtonStyle.Primary },
        { id: "math", label: "Kuis Matematika", emoji: "🧮", style: ButtonStyle.Success },
      ],
      selectOptions: [
        { value: "blackjack", label: "Blackjack 21", emoji: "🃏", description: "Bermain kartu 21 melawan dealer Naura" },
        { value: "typerace", label: "TypeRacer", emoji: "⌨️", description: "Uji kecepatan mengetik WPM berbatas waktu" },
        { value: "minesweeper", label: "Minesweeper", emoji: "💣", description: "Bongkar papan ranjau klasik tanpa meledak" },
        { value: "arcade", label: "Arcade Suite", emoji: "🕹️", description: "Kumpulan mini games seru dan refleks cepat" },
        { value: "math", label: "Matematika Cepat", emoji: "🧮", description: "Uji kecepatan berhitung di bawah tekanan waktu" },
        { value: "trivia", label: "Kuis Trivia AI", emoji: "🧠", description: "Kuis pengetahuan umum dari berbagai topik" },
        { value: "akinator", label: "Akinator AI", emoji: "🧞", description: "Tebak karakter yang sedang kamu pikirkan" },
        { value: "hangman", label: "Hangman", emoji: "🔤", description: "Tebak kata huruf per huruf sebelum tali terpasang" },
        { value: "memory", label: "Memory Match", emoji: "🎴", description: "Cocokkan pasangan emoji yang tersembunyi" },
        { value: "tebakkata", label: "Tebak Kata Anagram", emoji: "🔠", description: "Susun kembali huruf yang teracak menjadi kata benar" },
        { value: "rps", label: "Batu Gunting Kertas", emoji: "✂️", description: "Adu insting klasik melawan AI atau teman" },
        { value: "tictactoe", label: "Tic-Tac-Toe", emoji: "❌", description: "Adu taktik 3x3 PvP atau lawan Bot" },
        { value: "tod", label: "Truth or Dare", emoji: "🎭", description: "Permainan kejujuran dan tantangan seru" },
        { value: "leaderboard", label: "Papan Peringkat", emoji: "🏆", description: "Lihat pemain terbaik di server" },
      ],
      category: "minigame",
      userId: interaction.user.id,
      lang: interaction.localeLang,
    });
    return interaction.reply(payload);
  },

  async launchSubgame(interaction, gameName) {
    const mockInteraction = {
      ...interaction,
      options: {
        getSubcommand: () => gameName,
        getString: (name) => {
          if (name === "kesulitan") return "pemula";
          if (name === "kategori") return "math";
          return null;
        },
        getInteger: () => 50,
        getUser: () => null,
      },
      deferReply: async () => {},
      editReply: async (payload) => {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply(payload);
        }
        return interaction.reply(payload);
      },
      reply: async (payload) => {
        if (interaction.deferred || interaction.replied) {
          return interaction.followUp(payload);
        }
        return interaction.reply(payload);
      },
      followUp: async (payload) => interaction.followUp(payload),
    };
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    await runMinigameLogic(mockInteraction);
  },

  async executePrefix(message, args, client) {
    if (!args || args.length === 0) {
      return ui.sendError(message, "err_sys_2");
    }

    const subcommandName = args.shift().toLowerCase();

    const mockInteraction = {
      client: client,
      user: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      options: {
        getSubcommand: () => subcommandName,
        getUser: () => message.mentions.users.first() || null,
        getString: () => args[0] || null,
        getInteger: () => parseInt(args[0]) || 0,
      },
      deferReply: async () => {},
      editReply: async (payload) => {
        const msgPayload =
          typeof payload === "string"
            ? { content: payload, embeds: [], components: [], files: [] }
            : {
                content: null,
                embeds: [],
                components: [],
                files: [],
                ...payload,
              };
        delete msgPayload.ephemeral;
        return await message.reply(msgPayload);
      },
      reply: async (payload) => {
        const msgPayload =
          typeof payload === "string"
            ? { content: payload, embeds: [], components: [], files: [] }
            : {
                content: null,
                embeds: [],
                components: [],
                files: [],
                ...payload,
              };
        delete msgPayload.ephemeral;
        return await message.reply(msgPayload);
      },
      followUp: async (payload) => {
        const msgPayload =
          typeof payload === "string"
            ? { content: payload, embeds: [], components: [], files: [] }
            : {
                content: null,
                embeds: [],
                components: [],
                files: [],
                ...payload,
              };
        delete msgPayload.ephemeral;
        return await message.channel.send(msgPayload);
      },
      fetchReply: async () => {
        const sentMsg = await message.reply({
          content: "⏳ Memproses minigame...",
        });
        return sentMsg;
      },
    };

    let lastMsg = null;
    mockInteraction.editReply = async (payload) => {
      const msgPayload =
        typeof payload === "string"
          ? { content: payload, embeds: [], components: [], files: [] }
          : {
              content: null,
              embeds: [],
              components: [],
              files: [],
              ...payload,
            };
      delete msgPayload.ephemeral;
      if (lastMsg) return await lastMsg.edit(msgPayload);
      lastMsg = await message.reply(msgPayload);
      return lastMsg;
    };
    mockInteraction.fetchReply = async () => lastMsg;

    await runMinigameLogic(mockInteraction);
  },
};
