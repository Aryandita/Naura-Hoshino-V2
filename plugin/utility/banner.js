"use strict";

const {
  SlashCommandBuilder,
  MessageFlags,
  AttachmentBuilder,
} = require("discord.js");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription(
      "🖼️ Atur banner kosmetik atau generate Dynamic Motion Banner AI.",
    )
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Pasang banner yang kamu miliki.")
        .addStringOption((opt) =>
          opt
            .setName("tipe")
            .setDescription("Tipe banner yang mau diubah (Profile/Music)")
            .setRequired(true)
            .addChoices(
              { name: "Profile", value: "profile" },
              { name: "Music (Now Playing)", value: "music" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("banner_id")
            .setDescription(
              "ID Banner (contoh: banner_sakura) atau ketik 'default' untuk reset.",
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("motion")
        .setDescription(
          "✨ Generate AI Dynamic Motion Banner untuk profil dan kartu kelulusan.",
        )
        .addStringOption((opt) =>
          opt
            .setName("tema")
            .setDescription("Pilihan tema visual banner")
            .setRequired(false)
            .addChoices(
              { name: "Cyberpunk Neon", value: "cyberpunk" },
              { name: "Celestial Cosmos", value: "celestial" },
              { name: "Abyss Deep", value: "abyss" },
              { name: "Hoshino Aura", value: "hoshino_aura" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("judul")
            .setDescription("Gelar kehormatan atau judul custom pada banner")
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    const subCmd = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subCmd === "motion") {
      await interaction.deferReply();
      const theme = interaction.options.getString("tema") || "cyberpunk";
      const customTitle =
        interaction.options.getString("judul") || "SEASON PASS GRADUATE";

      const survival = await cacheManager.getUserSurvival(userId);

      const avatarUrl = interaction.user.displayAvatarURL({
        extension: "png",
        forceStatic: true,
        size: 256,
      });

      const bannerBuffer = await canvasWorkerPool.execute(
        "renderDynamicBanner",
        {
          username: interaction.user.username,
          avatarUrl,
          theme,
          seasonTier: survival?.seasonTier || 30,
          title: customTitle,
          quote: "Echoes of stellar journeys resonate forever in the cosmos.",
          stats: {
            level: survival?.level || 1,
            power: Math.round(
              (survival?.statAttack || 10) * 15 + (survival?.level || 1) * 100,
            ),
            prestige: survival?.starFragments || 500,
          },
        },
      );

      const attachment = new AttachmentBuilder(bannerBuffer, {
        name: `dynamic_banner_${userId}.png`,
      });

      const payload = buildContainerV2({
        accentColorHex:
          theme === "cyberpunk"
            ? "#00F0FF"
            : theme === "celestial"
              ? "#A78BFA"
              : "#EC4899",
        authorName: "Naura Motion Studio",
        title: `✨ Dynamic Motion Banner [${theme.toUpperCase()}]`,
        description: [
          `Dynamic Motion Banner untuk **${interaction.user.username}** telah berhasil digenerate!`,
          "",
          `> 🎨 **Tema:** \`${theme}\``,
          `> 🎖️ **Badge:** \`${customTitle}\``,
          `> ⚡ **Rendering Engine:** Dedicated Canvas Worker Threads (Non-blocking)`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({
        ...payload,
        files: [attachment],
      });
    }

    // --- Subcommand SET ---
    const type = interaction.options.getString("tipe");
    const bannerId = interaction.options.getString("banner_id").toLowerCase();

    const profile = await cacheManager.getUserProfile(userId);

    const activeBanners = profile.activeBanners || {
      profile: null,
      music: null,
    };

    if (bannerId === "default") {
      activeBanners[type] = null;
    } else {
      const inventory =
        typeof profile.inventory === "string"
          ? JSON.parse(profile.inventory)
          : profile.inventory;

      const hasBanner = inventory.some(
        (item) => item.id === bannerId || item.id === `item_${bannerId}`,
      );
      if (!hasBanner) {
        return interaction.reply({
          content: `${ui.getEmoji("cross") || "❌"} Kamu tidak memiliki banner ini! Dapatkan dari Gacha Banner.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      activeBanners[type] = bannerId.replace("item_", "");
    }

    const mutator = await cacheManager.mutateUserProfileJson(userId);
    if (mutator) {
      mutator.activeBanners = activeBanners;
      await mutator.save({ fields: ["activeBanners"] });
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      title: "🖼️ Banner Diperbarui",
      description: `Banner untuk **${type.toUpperCase()}** berhasil diubah menjadi: \`${bannerId}\`.`,
      footerText: ui.getFooter("utility"),
    });

    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  },
};
