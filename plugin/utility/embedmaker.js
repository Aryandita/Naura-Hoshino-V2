const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

function ephemeral(payload) {
  return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embedmaker")
    .setDescription("Pembuat pesan visual Components V2 kustom dengan modal formulir interaktif")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Saluran tempat pesan akan dikirim (default: saluran saat ini)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply(
        ephemeral(
          buildErrorContainerV2({
            title: "Izin Tidak Cukup",
            description: "Kamu memerlukan izin **Manage Messages** untuk membuat pengumuman visual kustom.",
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }

    const targetChannel =
      interaction.options.getChannel("channel") || interaction.channel;

    const botMember = interaction.guild.members.me;
    const channelPerms = targetChannel.permissionsFor(botMember);
    if (!channelPerms.has(PermissionsBitField.Flags.SendMessages) || !channelPerms.has(PermissionsBitField.Flags.ViewChannel)) {
      return interaction.reply(
        ephemeral(
          buildErrorContainerV2({
            title: "Saluran Tidak Dapat Diakses",
            description: `Naura tidak memiliki izin mengirim pesan di channel <#${targetChannel.id}>.`,
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }

    const modalId = `embed_modal_${interaction.id}_${Date.now()}`;
    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle("Visual Container Studio");

    const titleInput = new TextInputBuilder()
      .setCustomId("embedTitle")
      .setLabel("Judul Pesan Container")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Contoh: Pengumuman Jadwal Turnamen Server")
      .setMaxLength(100)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId("embedDesc")
      .setLabel("Isi Lengkap Pesan")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Tulis isi informasi atau pengumuman yang ingin disampaikan...")
      .setMaxLength(3500)
      .setRequired(true);

    const colorInput = new TextInputBuilder()
      .setCustomId("embedColor")
      .setLabel("Warna Aksen Hex (Opsional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("#6366f1 (Kosongkan untuk warna default Naura)")
      .setMaxLength(7)
      .setRequired(false);

    const bannerInput = new TextInputBuilder()
      .setCustomId("embedBanner")
      .setLabel("URL Gambar / Banner (Opsional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://example.com/banner.png")
      .setMaxLength(500)
      .setRequired(false);

    const footerInput = new TextInputBuilder()
      .setCustomId("embedFooter")
      .setLabel("Teks Catatan Kaki / Footer (Opsional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Disampaikan oleh Manajemen Server")
      .setMaxLength(100)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(colorInput),
      new ActionRowBuilder().addComponents(bannerInput),
      new ActionRowBuilder().addComponents(footerInput),
    );

    await interaction.showModal(modal);

    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === modalId && i.user.id === interaction.user.id,
        time: 300000,
      });

      const title = modalSubmit.fields.getTextInputValue("embedTitle");
      const desc = modalSubmit.fields.getTextInputValue("embedDesc");
      const colorRaw = modalSubmit.fields.getTextInputValue("embedColor").trim();
      const bannerRaw = modalSubmit.fields.getTextInputValue("embedBanner").trim();
      const footerRaw = modalSubmit.fields.getTextInputValue("embedFooter").trim();

      const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
      const accentColorHex = hexRegex.test(colorRaw)
        ? colorRaw
        : (ui.getColor("primary") || "#6366f1");

      const validUrlRegex = /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i;
      const bannerUrl = validUrlRegex.test(bannerRaw) ? bannerRaw : null;

      const containerPayload = buildContainerV2({
        accentColorHex,
        title,
        expression: "happy",
        description: desc,
        bannerAttachmentName: bannerUrl || undefined,
        footerText: footerRaw || ui.getFooter("utility"),
      });

      await targetChannel.send(containerPayload);

      return modalSubmit.reply(
        ephemeral(
          buildContainerV2({
            accentColorHex: ui.getColor("success") || "#10b981",
            title: "Pesan Visual Berhasil Terkirim",
            expression: "success",
            description: `Pesan visual Components V2 berhasil dipublikasikan ke channel <#${targetChannel.id}>.`,
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    } catch (err) {
      // Modal timeout atau user batal submit, abaikan
    }
  },
};
