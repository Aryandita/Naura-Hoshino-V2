"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  SlashCommandBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ButtonBuilder,
} = require("discord.js");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");
const { buildErrorContainerV2, buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
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

  const profile = await cacheManager.getUserProfile(user.id);
  const survival = await cacheManager.getUserSurvival(user.id);

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
    .setDescription("🎮 [DEPRECATED] Gunakan /arcade untuk bermain game dengan Medali Permainan (MP)")
    .addSubcommand((sub) =>
      sub
        .setName("blackjack")
        .setDescription("🃏 [DEPRECATED] Bermain Blackjack - gunakan /arcade play blackjack")
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
        .setDescription("⌨️ [DEPRECATED] Type Race - gunakan /arcade play typerace")
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
    // Show deprecation notice and redirect to /arcade
    const payload = buildContainerV2({
      accentColorHex: "#F59E0B",
      authorName: "Naura Arcade",
      title: "⚠️ Perintah /minigame Telah Dipindahkan",
      iconURL: interaction.user.displayAvatarURL(),
      description: [
        `Halo **${interaction.user.displayName || interaction.user.username}**! 👋`,
        "",
        `Perintah \`/minigame\` telah **dikonsolidasikan** ke dalam sistem **Arcade** baru! 🎮`,
        "",
        `### ✨ Apa yang Baru?`,
        `- Semua game sekarang menggunakan **Medali Permainan (MP)** sebagai mata uang`,
        `- Biaya main: **5 MP** per game`,
        `- Menang: **+25 MP** | Seri: **+5 MP** | Kalah: **0 MP**`,
        `- Klaim **50 MP gratis** setiap hari dengan \`/arcade daily\``,
        "",
        `### 🎯 Cara Menggunakan`,
        `\`/arcade hub\`, Buka menu pilih game`,
        `\`/arcade play <game>\`, Main game langsung`,
        `\`/arcade daily\`, Klaim hadiah harian`,
        `\`/arcade leaderboard\`, Lihat peringkat`,
        `\`/arcade profile\`, Cek saldo & status`,
        "",
        `-# Command ini akan dihapus di versi mendatang. Segera beralih ke /arcade!`,
      ].join("\n"),
      buttonsRow: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("redirect_arcade_hub")
            .setLabel("🎮 Buka Arcade Hub")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🕹️"),
          new ButtonBuilder()
            .setCustomId("redirect_arcade_daily")
            .setLabel("🎁 Klaim Daily (+50 MP)")
            .setStyle(ButtonStyle.Success)
            .setEmoji("🏅"),
        ),
      ],
      footerText: "Naura Hoshino Ecosystem • Migrasi ke Arcade System v2",
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
