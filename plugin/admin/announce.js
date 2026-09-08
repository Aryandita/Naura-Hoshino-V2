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
      "📢 [ADMIN] Kirim pengumuman dengan Embed, Kategori, dan Gambar Lokal.",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Pilih channel tempat pengumuman akan dikirim")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("kategori")
        .setDescription("Pilih kategori pengumuman")
        .setRequired(true)
        .addChoices(
          { name: "📢 Update / Pembaruan", value: "update" },
          { name: "🛠️ Maintenance / Perbaikan", value: "mt" },
          { name: "🎉 Event / Acara", value: "event" },
          { name: "🚨 Warning / Peringatan", value: "warn" },
          { name: "ℹ️ Info Umum", value: "info" },
        ),
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("gambar")
        .setDescription("Unggah gambar dari perangkat/komputermu (Opsional)")
        .setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("mention_everyone")
        .setDescription("Ping @everyone? (Hati-hati menggunakannya)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel("channel");
    const kategori = interaction.options.getString("kategori");
    const attachment = interaction.options.getAttachment("gambar"); // Mengambil file lokal
    const mentionEveryone =
      interaction.options.getBoolean("mention_everyone") || false;

    // 🛡️ PRE-CHECK PERMISSION
    const botPermissions = targetChannel.permissionsFor(
      interaction.guild.members.me,
    );
    if (
      !botPermissions.has(PermissionFlagsBits.ViewChannel) ||
      !botPermissions.has(PermissionFlagsBits.SendMessages)
    ) {
      return interaction.reply({
        content: `${ui.getEmoji("error") || "❌"} **Akses Ditolak:** Aku tidak memiliki izin melihat/mengirim pesan di <#${targetChannel.id}>.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Buat Form Modal
    // Menyisipkan Kategori dan ID Gambar (jika ada) ke customId agar bisa dilacak
    const imageId = attachment ? attachment.id : "no_image";
    const mentionBit = mentionEveryone ? "1" : "0";
    const modalId = `announceModal_${targetChannel.id}_${kategori}_${imageId}_${mentionBit}`;

    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle("Detail Pengumuman");

    const titleInput = new TextInputBuilder()
      .setCustomId("announceTitle")
      .setLabel("Judul Pengumuman")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Judul utama pesan...")
      .setMaxLength(256)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId("announceDesc")
      .setLabel("Isi Pengumuman")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Ketik deskripsi lengkap di sini...")
      .setMaxLength(4000)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(titleInput);
    const row2 = new ActionRowBuilder().addComponents(descInput);

    modal.addComponents(row1, row2);
    await interaction.showModal(modal);

    // Tunggu Admin Submit (5 Menit)
    // Kita hanya memfilter berdasarkan command user ini
    const filter = (i) =>
      i.customId === modalId && i.user.id === interaction.user.id;

    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        filter,
        time: 300000,
      });

      const title = modalSubmit.fields.getTextInputValue("announceTitle");
      const desc = modalSubmit.fields.getTextInputValue("announceDesc");

      // Set Emoji dan Warna Berdasarkan Kategori dari ui.js
      let categoryEmoji = "";
      let embedColor = ui.getColor("primary"); // Default

      switch (kategori) {
        case "update":
          categoryEmoji = ui.getEmoji("announce_update") || "📢";
          embedColor = ui.getColor("announce_update");
          break;
        case "mt":
          categoryEmoji = ui.getEmoji("announce_mt") || "🛠️";
          embedColor = ui.getColor("announce_mt");
          break;
        case "event":
          categoryEmoji = ui.getEmoji("announce_event") || "🎉";
          embedColor = ui.getColor("announce_event");
          break;
        case "warn":
          categoryEmoji = ui.getEmoji("announce_warn") || "⚠️";
          embedColor = ui.getColor("announce_warn");
          break;
        case "info":
          categoryEmoji = ui.getEmoji("announce_info") || "ℹ️";
          embedColor = ui.getColor("announcement");
          break;
      }

      // Rangkai Embed
      const finalTitle = `${categoryEmoji} | ${title}`;

      const announcePayload = buildContainerV2({
        accentColorHex: embedColor || ui.getColor("announcement"),
        authorName: interaction.guild.name,
        title: finalTitle,
        description: desc,
        footerText: `Announcement by ${interaction.user.tag}`,
      });

      const embedCharCount = title.length + desc.length;
      if (embedCharCount > 5500) {
        const errPayload = buildErrorContainerV2({
          title: "Teks Terlalu Panjang",
          description: `${ui.getEmoji("error") || "❌"} Gagal: Panjang judul dan deskripsi terlalu besar! (Max 5500 karakter).`,
          footerText: ui.getFooter("core"),
        });
        return interaction.followUp({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Jika ada gambar yang diunggah dari command awal, pasang di embed
      const contentPayload = mentionEveryone ? "@everyone" : null;

      // 🛡️ KIRIM PESAN
      try {
        await targetChannel.send({
          content: contentPayload,
          ...announcePayload,
        });
        const successPayload = buildContainerV2({
          title: "Pengumuman Terkirim",
          description: `${ui.getEmoji("success") || "✅"} Pengumuman berhasil dikirimkan ke channel <#${targetChannel.id}>!`,
          footerText: ui.getFooter("core"),
        });
        await modalSubmit.reply({
          ...successPayload,
          flags: MessageFlags.Ephemeral,
        });
      } catch (sendError) {
        logger.error("[Announce Send Error]:", sendError.message);
        await modalSubmit.reply({
          content: `${ui.getEmoji("error") || "❌"} **Gagal mengirim!** Pastikan bot punya izin Embed Links.`,
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
