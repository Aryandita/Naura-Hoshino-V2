const {
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("data")
    .setDescription(
      "🛡️ [PRIVACY] Kelola data personal kamu yang disimpan oleh bot.",
    )
    .addSubcommand((sub) =>
      sub
        .setName("export")
        .setDescription(
          "📥 Ekspor seluruh data profil & survival kamu dalam bentuk JSON.",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription(
          "🗑️ Hapus SELURUH data personal kamu dari database (TIDAK BISA KEMBALI).",
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === "export") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const profile = await cacheManager.getUserProfile(userId);
      const survival = await cacheManager.getUserSurvival(userId);

      const exportedData = {
        exportedAt: new Date().toISOString(),
        user: {
          id: userId,
          tag: interaction.user.tag,
        },
        profile: profile ? profile.toJSON() : null,
        survival: survival ? survival.toJSON() : null,
      };

      const buffer = Buffer.from(
        JSON.stringify(exportedData, null, 2),
        "utf-8",
      );
      const attachment = new AttachmentBuilder(buffer, {
        name: `naura_data_${userId}.json`,
      });

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success"),
        authorName: "Naura Privacy Center",
        title: "📥 Data Ekspor Selesai",
        description:
          "Seluruh data profil dan RPG/Survival kamu berhasil dikumpulkan. Silakan unduh file `.json` yang terlampir pada pesan ini.\n\n*Data ini hanya dikirimkan kepada kamu secara privat (ephemeral).*",
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply({ ...payload, files: [attachment] });
    }

    if (sub === "delete") {
      const btnConfirm = new ButtonBuilder()
        .setCustomId("btn_data_confirm_delete")
        .setLabel("Ya, Hapus Dataku")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger);

      const btnCancel = new ButtonBuilder()
        .setCustomId("btn_data_cancel_delete")
        .setLabel("Batal")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(btnConfirm, btnCancel);

      const payload = buildContainerV2({
        accentColorHex: "#FF0000",
        authorName: "Naura Privacy Center",
        title: "⚠️ Konfirmasi Penghapusan Data",
        description:
          "Kamu yakin ingin menghapus **SELURUH** datamu?\n\nIni akan menghapus secara permanen:\n- Seluruh level, balance (koin/kupon)\n- Inventaris RPG, pet, farm\n- Pengaturan profil & history premium\n\n**Tindakan ini tidak bisa dibatalkan!**",
        buttonsRow: row,
        footerText: ui.getFooter("core"),
      });

      const reply = await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
        fetchReply: true,
      });

      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== userId) return;

        if (i.customId === "btn_data_confirm_delete") {
          // Flush first
          await cacheManager.flushUser(userId);

          const UserProfile = require("../../src/models/UserProfile");
          const UserSurvival = require("../../src/models/UserSurvival");

          await UserProfile.destroy({ where: { userId } }).catch(() => {});
          await UserSurvival.destroy({ where: { userId } }).catch(() => {});

          await cacheManager.invalidateUserProfile(userId);
          await cacheManager.invalidateUserSurvival(userId);

          await i.update(
            buildContainerV2({
              accentColorHex: ui.getColor("success"),
              title: "✅ Data Berhasil Dihapus",
              description:
                "Seluruh datamu telah dihapus secara permanen dari database Naura.",
              footerText: ui.getFooter("core"),
            }),
          );
        } else {
          await i.update(
            buildContainerV2({
              accentColorHex: ui.getColor("utility"),
              title: "❌ Penghapusan Dibatalkan",
              description: "Penghapusan data dibatalkan. Datamu tetap aman.",
              footerText: ui.getFooter("core"),
            }),
          );
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          interaction.editReply({ components: [] }).catch(() => {});
        }
      });
      return;
    }
  },
};
