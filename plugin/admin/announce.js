const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription(
      "Kirim pengumuman terstruktur dengan kategori, gambar, dan opsi sematan.",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Pilih channel tujuan pengumuman")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("kategori")
        .setDescription("Pilih kategori pengumuman")
        .setRequired(true)
        .addChoices(
          { name: "Pembaruan (Update)", value: "update" },
          { name: "Perbaikan (Maintenance)", value: "mt" },
          { name: "Acara (Event)", value: "event" },
          { name: "Peringatan (Warning)", value: "warn" },
          { name: "Informasi Umum", value: "info" },
        ),
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("gambar")
        .setDescription("Unggah gambar pendukung pengumuman (opsional)")
        .setRequired(false),
    )
    .addRoleOption((opt) =>
      opt
        .setName("mention_role")
        .setDescription("Role yang ingin dimention (opsional)")
        .setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("mention_everyone")
        .setDescription("Mention @everyone untuk pengumuman darurat")
        .setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("pin")
        .setDescription("Sematkan pesan di channel tujuan (opsional)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel("channel");
    const kategori = interaction.options.getString("kategori");
    const attachment = interaction.options.getAttachment("gambar");
    const mentionRole = interaction.options.getRole("mention_role");
    const mentionEveryone =
      interaction.options.getBoolean("mention_everyone") || false;
    const shouldPin = interaction.options.getBoolean("pin") || false;

    // Pre-check permission
    const botPermissions = targetChannel.permissionsFor(
      interaction.guild.members.me,
    );
    if (
      !botPermissions.has(PermissionFlagsBits.ViewChannel) ||
      !botPermissions.has(PermissionFlagsBits.SendMessages)
    ) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `Naura tidak memiliki izin melihat atau mengirim pesan di saluran <#${targetChannel.id}>.`,
          footerText: ui.getFooter("core"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const modalId = `announceModal_${interaction.id}`;

    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle("Format Pengumuman");

    const titleInput = new TextInputBuilder()
      .setCustomId("announceTitle")
      .setLabel("Judul Pengumuman")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Tuliskan judul utama pengumuman...")
      .setMaxLength(256)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId("announceDesc")
      .setLabel("Isi Pesan")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Tuliskan detail pengumuman secara lengkap dan jelas...")
      .setMaxLength(4000)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
    );

    await interaction.showModal(modal);

    const filter = (i) =>
      i.customId === modalId && i.user.id === interaction.user.id;

    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        filter,
        time: 300000,
      });

      const title = modalSubmit.fields.getTextInputValue("announceTitle");
      const desc = modalSubmit.fields.getTextInputValue("announceDesc");

      let categoryEmoji = "";
      let categoryLabel = "Informasi";
      let embedColor = ui.getColor("primary");

      switch (kategori) {
        case "update":
          categoryEmoji = "📢";
          categoryLabel = "Pembaruan";
          embedColor = ui.getColor("announce_update");
          break;
        case "mt":
          categoryEmoji = "🛠️";
          categoryLabel = "Pemeliharaan";
          embedColor = ui.getColor("announce_mt");
          break;
        case "event":
          categoryEmoji = "🎉";
          categoryLabel = "Acara Komunitas";
          embedColor = ui.getColor("announce_event");
          break;
        case "warn":
          categoryEmoji = "⚠️";
          categoryLabel = "Peringatan";
          embedColor = ui.getColor("announce_warn");
          break;
        case "info":
        default:
          categoryEmoji = "ℹ️";
          categoryLabel = "Informasi Umum";
          embedColor = ui.getColor("announcement");
          break;
      }

      const finalTitle = `${categoryEmoji} ${title}`;

      const files = [];
      let bannerAttachmentName = null;
      if (attachment?.url) {
        files.push(attachment);
        bannerAttachmentName = attachment.name;
      }

      const announcePayload = buildContainerV2({
        accentColorHex: embedColor || ui.getColor("announcement"),
        authorName: interaction.guild.name,
        title: finalTitle,
        description: desc,
        bannerAttachmentName,
        files,
        footerText: `Pengumuman oleh ${interaction.user.tag}`,
      });

      const embedCharCount = title.length + desc.length;
      if (embedCharCount > 5500) {
        const errPayload = buildErrorContainerV2({
          title: "Karakter Melebihi Batas",
          description: "Jumlah teks judul dan deskripsi terlalu panjang (maksimum 5500 karakter).",
          footerText: ui.getFooter("core"),
        });
        return modalSubmit.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      const mentions = [];
      if (mentionEveryone) mentions.push("@everyone");
      if (mentionRole) mentions.push(`<@&${mentionRole.id}>`);
      const contentPayload = mentions.length > 0 ? mentions.join(" ") : null;

      try {
        const sentMessage = await targetChannel.send({
          content: contentPayload,
          ...announcePayload,
        });

        if (shouldPin && sentMessage.pin) {
          await sentMessage.pin().catch((pinErr) => {
            logger.warn("[Announce] Gagal menyematkan pesan:", pinErr.message);
          });
        }

        const successFields = [
          { name: "Saluran Tujuan", value: `<#${targetChannel.id}>`, inline: true },
          { name: "Kategori", value: `${categoryEmoji} ${categoryLabel}`, inline: true },
          { name: "Penyebutan", value: mentions.length > 0 ? mentions.join(", ") : "Tidak Ada", inline: true },
          { name: "Status Sematan", value: shouldPin ? "Ya (Disematkan)" : "Tidak", inline: true },
          { name: "Lampiran Gambar", value: attachment ? "Tersedia" : "Tidak Ada", inline: true },
        ];

        const successPayload = buildContainerV2({
          title: "Pengumuman Berhasil Diterbitkan",
          description: `Pengumuman telah dikirimkan ke saluran <#${targetChannel.id}>.`,
          fields: successFields,
          footerText: ui.getFooter("core"),
        });

        await modalSubmit.reply({
          ...successPayload,
          flags: MessageFlags.Ephemeral,
        });
      } catch (sendError) {
        logger.error("[Announce Send Error]:", sendError.message);
        await modalSubmit.reply({
          ...buildErrorContainerV2({
            title: "Pengiriman Gagal",
            description: "Pesan tidak dapat dikirim ke saluran target. Pastikan bot memiliki izin yang cukup.",
            footerText: ui.getFooter("core"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (err) {
      if (err.code !== "InteractionCollectorError") {
        logger.error("[Announce Error]:", err);
      }
    }
  },
};
