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
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");

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
        const banners = typeof profile?.activeBanners === "string"
          ? JSON.parse(profile.activeBanners || "{}")
          : (profile?.activeBanners || {});
        const themeKey = banners.profile_theme || "neon_pink";
        const palette = PROFILE_PALETTES[themeKey] || PROFILE_PALETTES.neon_pink;

        const canvasPayload = {
          user: {
            username: targetUser.username,
            avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 256, forceStatic: true })
          },
          profile,
          topFriend: topFriendData ? { username: topFriendData.username } : null,
          streak: topStreak,
          palette,
          currencySymbol: ui.currencySymbol || "NC"
        };
        const buffer = await canvasWorkerPool.execute("renderBusinessCard", canvasPayload);
        const attachment = new AttachmentBuilder(buffer, { name: "card.png" });

        const row = new ActionRowBuilder();
        if (profile.social_youtube) {
          row.addComponents(
            new ButtonBuilder()
              .setLabel("YouTube")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://youtube.com/@${profile.social_youtube.replace("@", "")}`),
          );
        }
        if (profile.social_instagram) {
          row.addComponents(
            new ButtonBuilder()
              .setLabel("Instagram")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://instagram.com/${profile.social_instagram}`),
          );
        }
        if (profile.social_x) {
          row.addComponents(
            new ButtonBuilder()
              .setLabel("X (Twitter)")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://x.com/${profile.social_x}`),
          );
        }

        const rows = [];
        if (row.components.length > 0) {
          rows.push(row);
        }
        if (isBotOwner && env.OWNER_IDS && env.OWNER_IDS.includes(interaction.user.id)) {
          rows.push(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("owner_profile_panel")
                .setLabel("👑 Panel Command Owner")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("🔒"),
            ),
          );
        }

        const payload = buildContainerV2({
          accentColorHex: isBotOwner ? "#38BDF8" : "#FBBF24",
          authorName: "Naura VIP Identity",
          title: `Kartu Profil Eksklusif: ${targetUser.username}`,
          iconURL: targetUser.displayAvatarURL(),
          description: isBotOwner
            ? "Status Keanggotaan: **Bot Developer & Architect**\n-# 👑 *Gunakan tombol di bawah untuk membuka direktori perintah khusus Owner.*"
            : "Status Keanggotaan: **VIP Patron Member**",
          fields: [
            {
              name: "Dompet & Bank",
              value: `${(profile.economy_wallet || 0).toLocaleString("id-ID")} NC (Tunai) / ${(profile.economy_bank || 0).toLocaleString("id-ID")} NC (Bank)`,
              inline: true,
            },
            {
              name: "Reputasi Komunitas",
              value: `⭐ ${profile.reputation || 0} Poin Reputasi`,
              inline: true,
            },
            {
              name: "Jejaring Sosial",
              value: `${friends.length} Teman ${topFriendData ? `(Top Streak: ${topFriendData.username} - ${topStreak} Hari)` : ""}`,
              inline: false,
            },
          ],
          files: [attachment],
          buttonsRow: rows.length > 0 ? rows : null,
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      }

      const row = new ActionRowBuilder();
      if (profile.social_youtube)
        row.addComponents(
          new ButtonBuilder()
            .setLabel("YouTube")
            .setStyle(ButtonStyle.Link)
            .setURL(
              `https://youtube.com/@${profile.social_youtube.replace("@", "")}`,
            ),
        );
      if (profile.social_instagram)
        row.addComponents(
          new ButtonBuilder()
            .setLabel("Instagram")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://instagram.com/${profile.social_instagram}`),
        );
      if (profile.social_x)
        row.addComponents(
          new ButtonBuilder()
            .setLabel("X (Twitter)")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://x.com/${profile.social_x}`),
        );
      if (profile.social_facebook)
        row.addComponents(
          new ButtonBuilder()
            .setLabel("Facebook")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://facebook.com/${profile.social_facebook}`),
        );

      const hasSocial = row.components.length > 0;
      const rows = [];
      if (hasSocial) {
        rows.push(row);
      }
      if (isBotOwner && env.OWNER_IDS && env.OWNER_IDS.includes(interaction.user.id)) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("owner_profile_panel")
              .setLabel("👑 Panel Command Owner")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("🔒"),
          ),
        );
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary"),
        authorName: "Profil Anggota Komunitas",
        title: `Identitas Pengguna: ${targetUser.username}`,
        iconURL: targetUser.displayAvatarURL(),
        description: hasSocial
          ? undefined
          : "*Pengguna ini belum menghubungkan akun media sosial.*",
        fields: [
          {
            name: "Ekonomi & Keuangan",
            value: `**Tunai:** ${(profile.economy_wallet || 0).toLocaleString("id-ID")} NC\n**Bank:** ${(profile.economy_bank || 0).toLocaleString("id-ID")} NC`,
            inline: true,
          },
          {
            name: "Reputasi & Hubungan",
            value: `**Reputasi:** ⭐ ${profile.reputation || 0}\n**Teman:** ${friends.length} Orang`,
            inline: true,
          },
          {
            name: "Top Pertemanan",
            value: topFriendData
              ? `🔥 Bersama <@${topFriendData.id}> selama **${topStreak} hari berturut-turut**`
              : "Belum memiliki catatan streak aktif bersama teman",
            inline: false,
          },
        ],
        buttonsRow: rows.length > 0 ? rows : null,
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }
  },
};
