const { SlashCommandBuilder } = require("discord.js");
const { AttachmentBuilder } = require("discord.js");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../src/managers/cacheManager");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("User and profile management commands")
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("Menampilkan kartu profil terpadu Naura Hoshino V2")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("Pengguna yang ingin dilihat profilnya")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "info") {
      const targetUser = interaction.options.getUser("target") || interaction.user;

      try {
        // Fetch profiles
        const profile = await cacheManager.getUserProfile(targetUser.id);
        const survival = await cacheManager.getUserSurvival(targetUser.id).catch(() => null);

        // Calculate friends in voice
        let friendsInVoice = [];
        try {
          const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
          if (member && member.voice && member.voice.channel) {
            friendsInVoice = Array.from(member.voice.channel.members.values())
              .filter(m => m.id !== targetUser.id && !m.user.bot)
              .map(m => m.displayName || m.user.username);
          }
        } catch (e) {
          // Fallback if failed to fetch voice channel
        }

        const payload = {
          user: {
            id: targetUser.id,
            username: targetUser.username,
            avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 256 }),
          },
          profile: profile ? profile.toJSON ? profile.toJSON() : profile : {},
          survival: survival ? survival.toJSON ? survival.toJSON() : survival : {},
          extra: {
            friendsInVoice,
          },
        };

        const imageBuffer = await canvasWorkerPool.runTask(
          "renderUnifiedProfile",
          payload,
          10000
        );

        const attachment = new AttachmentBuilder(imageBuffer, {
          name: "unified-profile.png",
        });

        const replyPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#ff6b81",
          title: `Profil Terpadu: ${targetUser.username}`,
          description: "Data sinkron dengan ekosistem Naura Hoshino V2.",
          footerText: ui.getFooter("utility"),
          files: [attachment],
          imageAttachment: "attachment://unified-profile.png",
        });

        return interaction.editReply(replyPayload);
      } catch (error) {
        console.error("Unified Profile Error:", error);
        return interaction.editReply({
          content: "❌ Gagal memuat profil terpadu. Silakan coba lagi nanti.",
        });
      }
    }
  },
};
