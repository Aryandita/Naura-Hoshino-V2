const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const UserFriend = require("../../src/models/UserFriend");
const { Op } = require("sequelize");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const { createCanvas, loadImage } = require("../../src/canvas/canvasRuntime");

const PROFILE_PALETTES = {
  neon_pink: {
    name: "Cyber Neon Pink",
    bg1: "#1a1a2e",
    bg2: "#16213e",
    glow1: "rgba(233, 69, 96, 0.25)",
    glow2: "rgba(15, 52, 96, 0.35)",
    accent: "#e94560",
  },
  cyber_blue: {
    name: "Stellar Cyber Blue",
    bg1: "#0b132b",
    bg2: "#1c2541",
    glow1: "rgba(56, 189, 248, 0.25)",
    glow2: "rgba(30, 58, 138, 0.35)",
    accent: "#38bdf8",
  },
  emerald_nature: {
    name: "Naura Wilds Emerald",
    bg1: "#062817",
    bg2: "#0f3d24",
    glow1: "rgba(52, 211, 153, 0.25)",
    glow2: "rgba(6, 78, 59, 0.4)",
    accent: "#34d399",
  },
  sunset_gold: {
    name: "Cosmic Solar Gold",
    bg1: "#2a1505",
    bg2: "#3b1e08",
    glow1: "rgba(251, 191, 36, 0.25)",
    glow2: "rgba(180, 83, 9, 0.35)",
    accent: "#fbbf24",
  },
  dark_obsidian: {
    name: "Midnight Obsidian",
    bg1: "#09090b",
    bg2: "#18181b",
    glow1: "rgba(161, 161, 170, 0.15)",
    glow2: "rgba(39, 39, 42, 0.3)",
    accent: "#e4e4e7",
  },
};

// Utility to create the Canvas Business Card
async function createBusinessCard(user, profile, topFriend, streak) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext("2d");

  const banners = typeof profile?.activeBanners === "string"
    ? JSON.parse(profile.activeBanners || "{}")
    : (profile?.activeBanners || {});
  const themeKey = banners.profile_theme || "neon_pink";
  const palette = PROFILE_PALETTES[themeKey] || PROFILE_PALETTES.neon_pink;

  // Background (Glassmorphism / Neon glow)
  const gradient = ctx.createLinearGradient(0, 0, 800, 400);
  gradient.addColorStop(0, palette.bg1);
  gradient.addColorStop(1, palette.bg2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 400);

  // Add some "glow" elements
  ctx.beginPath();
  ctx.arc(100, 100, 150, 0, Math.PI * 2);
  ctx.fillStyle = palette.glow1;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(700, 300, 200, 0, Math.PI * 2);
  ctx.fillStyle = palette.glow2;
  ctx.fill();

  // Glass panel
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(40, 40, 720, 320, 20);
  ctx.fill();
  ctx.stroke();

  // Avatar
  try {
    const avatarUrl = user.displayAvatarURL({
      extension: "png",
      size: 256,
      forceStatic: true,
    });
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(140, 140, 60, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 80, 80, 120, 120);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(140, 140, 60, 0, Math.PI * 2);
    ctx.strokeStyle = "#e94560";
    ctx.lineWidth = 4;
    ctx.stroke();
  } catch (e) {}

  // Username & Info
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(user.username, 230, 130);

  ctx.fillStyle = "#e94560";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(profile.isPremium ? "🌟 VIP Member" : "👑 Bot Owner", 230, 170);

  ctx.fillStyle = "#b2bec3";
  ctx.font = "20px sans-serif";
  ctx.fillText(
    `Saldo: ${profile.economy_wallet.toLocaleString("id-ID")} ${ui.currencySymbol || "NC"}`,
    230,
    210,
  );

  ctx.fillStyle = "#f39c12"; // gold/star color
  ctx.fillText(`Reputasi: ⭐ ${profile.reputation || 0}`, 230, 240);

  // Social Media Pills
  let yPos = 270;
  let xPos = 80;

  const drawPill = (text, color) => {
    if (!text) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(xPos, yPos, 180, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    // Center text in pill (roughly)
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, xPos + (180 - textWidth) / 2, yPos + 26);
    xPos += 200;
    if (xPos > 500) {
      xPos = 80;
      yPos += 50;
    }
  };

  if (profile.social_youtube) drawPill(profile.social_youtube, "#FF0000");
  if (profile.social_instagram) drawPill(profile.social_instagram, "#E1306C");
  if (profile.social_x) drawPill(profile.social_x, "#1DA1F2");
  if (profile.social_facebook) drawPill(profile.social_facebook, "#4267B2");

  // Top Friend Section (Right side)
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.roundRect(500, 80, 240, 150, 15);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("Top Streak", 520, 110);

  if (topFriend) {
    ctx.font = "16px sans-serif";
    ctx.fillText(topFriend.username, 520, 150);
    ctx.fillStyle = "#e94560";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`🔥 ${streak} Days`, 520, 190);
  } else {
    ctx.fillStyle = "#b2bec3";
    ctx.font = "14px sans-serif";
    ctx.fillText("No friends yet", 520, 150);
  }

  return canvas.toBuffer("image/png");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("👤 Lihat profil sosial media dan pertemananmu.")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat profil kamu atau orang lain.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Pilih user").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Isi data username sosial media milikmu."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("theme")
        .setDescription("🎨 Kustomisasi palet warna tema kartu profil Canvas kamu.")
        .addStringOption((opt) =>
          opt
            .setName("palette")
            .setDescription("Pilih tema palet warna")
            .setRequired(false)
            .addChoices(
              { name: "🌸 Cyber Neon Pink (Default)", value: "neon_pink" },
              { name: "🌊 Stellar Cyber Blue", value: "cyber_blue" },
              { name: "🌿 Naura Wilds Emerald", value: "emerald_nature" },
              { name: "🌟 Cosmic Solar Gold", value: "sunset_gold" },
              { name: "🌑 Midnight Obsidian", value: "dark_obsidian" },
            ),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand(false) || "view";

    const cacheManager = require("../../src/managers/cacheManager");

    if (subcommand === "theme") {
      const paletteChoice = interaction.options.getString("palette");
      if (paletteChoice && PROFILE_PALETTES[paletteChoice]) {
        await cacheManager.mutateUserProfileJson(interaction.user.id, "activeBanners", (raw) => {
          const banners = typeof raw === "string" ? JSON.parse(raw || "{}") : { ...(raw || {}) };
          banners.profile_theme = paletteChoice;
          return banners;
        });
        cacheManager.smartInvalidateUserCanvas(interaction.user.id);
        const themeInfo = PROFILE_PALETTES[paletteChoice];
        const payload = buildContainerV2({
          accentColorHex: themeInfo.accent || ui.getColor("primary"),
          authorName: "Naura Profile Studio",
          title: "🎨 Tema Kartu Profil Diperbarui!",
          description: [
            `Palet warna kartu profil kamu berhasil diubah ke: **${themeInfo.name}**!`,
            "",
            "Gunakan `/profile view` untuk melihat kartu profil barumu.",
          ].join("\n"),
          footerText: ui.getFooter("utility"),
        });
        return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("sel_profile_theme")
        .setPlaceholder("Pilih Palet Warna Tema Kartu Profil...")
        .addOptions(
          Object.entries(PROFILE_PALETTES).map(([key, pal]) => ({
            label: pal.name,
            value: key,
            description: `Aksen: ${pal.accent}`,
          })),
        );
      const row = new ActionRowBuilder().addComponents(selectMenu);
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Profile Studio",
        title: "🎨 Pilih Tema Palet Kartu Profil",
        description: "Pilih salah satu palet tema warna di bawah untuk mengubah visual kartu Canvas profilmu secara instan.",
        selectMenu: row,
        footerText: ui.getFooter("utility"),
      });
      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    if (subcommand === "setup") {
      const profile = await cacheManager.getUserProfile(interaction.user.id);

      const modal = new ModalBuilder()
        .setCustomId("profile_social_modal")
        .setTitle("Setup Sosial Media");

      const ytInput = new TextInputBuilder()
        .setCustomId("social_yt")
        .setLabel("Username YouTube (Kosongkan jika tidak ada)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(profile.social_youtube || "");
      const igInput = new TextInputBuilder()
        .setCustomId("social_ig")
        .setLabel("Username Instagram")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(profile.social_instagram || "");
      const xInput = new TextInputBuilder()
        .setCustomId("social_x")
        .setLabel("Username X / Twitter")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(profile.social_x || "");
      const fbInput = new TextInputBuilder()
        .setCustomId("social_fb")
        .setLabel("Username Facebook")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(profile.social_facebook || "");

      modal.addComponents(
        new ActionRowBuilder().addComponents(ytInput),
        new ActionRowBuilder().addComponents(igInput),
        new ActionRowBuilder().addComponents(xInput),
        new ActionRowBuilder().addComponents(fbInput),
      );

      await interaction.showModal(modal);

      // Wait for submit
      try {
        const submit = await interaction.awaitModalSubmit({
          filter: (i) =>
            i.customId === "profile_social_modal" &&
            i.user.id === interaction.user.id,
          time: 300000,
        });

        const updates = {
          social_youtube: submit.fields.getTextInputValue("social_yt") || null,
          social_instagram:
            submit.fields.getTextInputValue("social_ig") || null,
          social_x: submit.fields.getTextInputValue("social_x") || null,
          social_facebook: submit.fields.getTextInputValue("social_fb") || null,
        };

        await cacheManager.updateUserProfile(interaction.user.id, updates);
        await submit.reply({
          content: `${ui.getEmoji("check")} Profil sosial mediamu berhasil diperbarui!`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (e) {
        // Timeout or error
      }
    } else if (subcommand === "view") {
      await interaction.deferReply();
      const targetUser =
        interaction.options.getUser("user") || interaction.user;

      const profile = await cacheManager.getUserProfile(targetUser.id);
      const env = require("../../src/config/env");
      const isBotOwner = env.OWNER_IDS && env.OWNER_IDS.includes(targetUser.id);
      const isVIP =
        (profile.isPremium &&
          profile.premiumUntil &&
          new Date(profile.premiumUntil) > new Date()) ||
        isBotOwner;

      // Get friends & top streak
      const friends = await UserFriend.findAll({
        where: {
          [Op.or]: [{ user1Id: targetUser.id }, { user2Id: targetUser.id }],
          status: "accepted",
        },
        order: [["streak", "DESC"]],
      });

      let topFriendData = null;
      let topStreak = 0;
      if (friends.length > 0) {
        const topF = friends[0];
        const topFriendId =
          topF.user1Id === targetUser.id ? topF.user2Id : topF.user1Id;
        const topFriendUser = await interaction.client.users
          .fetch(topFriendId)
          .catch(() => null);
        if (topFriendUser) {
          topFriendData = topFriendUser;
          topStreak = topF.streak;
        }
      }

      // --- CANVAS UNTUK VIP / OWNER ---
      if (isVIP) {
        const buffer = await createBusinessCard(
          targetUser,
          profile,
          topFriendData,
          topStreak,
        );
        const attachment = new AttachmentBuilder(buffer, { name: "card.png" });

        const payload = buildContainerV2({
          accentColorHex: isBotOwner ? "#00FFFF" : "#FFD700",
          authorName: "Naura VIP Identity Card",
          title: `${ui.getEmoji("id") || "🪪"} ${targetUser.username}, Business Card`,
          iconURL: targetUser.displayAvatarURL(),
          description: `*Global Chat Network | ${friends.length} Teman*`,
          files: [attachment],
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      }

      const row = new ActionRowBuilder();
      if (profile.social_youtube)
        row.addComponents(
          new ButtonBuilder()
            .setLabel(profile.social_youtube)
            .setStyle(ButtonStyle.Link)
            .setURL(
              `https://youtube.com/@${profile.social_youtube.replace("@", "")}`,
            ),
        );
      if (profile.social_instagram)
        row.addComponents(
          new ButtonBuilder()
            .setLabel(profile.social_instagram)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://instagram.com/${profile.social_instagram}`),
        );
      if (profile.social_x)
        row.addComponents(
          new ButtonBuilder()
            .setLabel(profile.social_x)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://x.com/${profile.social_x}`),
        );
      if (profile.social_facebook)
        row.addComponents(
          new ButtonBuilder()
            .setLabel(profile.social_facebook)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://facebook.com/${profile.social_facebook}`),
        );

      const hasSocial = row.components.length > 0;

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary"),
        authorName: `Profil Pengguna Naura`,
        title: `${ui.getEmoji("about") || "👤"} ${targetUser.username}`,
        iconURL: targetUser.displayAvatarURL(),
        description: hasSocial
          ? undefined
          : "*User ini belum menautkan akun sosial media.*",
        fields: [
          {
            name: `${ui.getEmoji("wallet") || "💳"} Ekonomi`,
            value: `**Saldo Tunai:** ${ui.getEmoji("coin") || "🪙"} ${profile.economy_wallet.toLocaleString("id-ID")} ${ui.currencyName || "Naura Coin"}`,
          },
          {
            name: `${ui.getEmoji("handshake") || "🤝"} Sosial`,
            value: `**Total Teman:** ${friends.length}\n**${ui.getEmoji("fire") || "🔥"} Top Streak:** ${topFriendData ? `${topFriendData.username} (${topStreak} hari)` : "Belum ada"}`,
          },
        ],
        buttonsRow: hasSocial ? row : null,
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }
  },
};
