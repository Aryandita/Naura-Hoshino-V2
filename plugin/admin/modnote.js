const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { sendModLog } = require("../../src/utils/modLogHelper");
const ModNote = require("../../src/models/mongo/ModNote");

function ephemeral(payload) {
  return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modnote")
    .setDescription("Kelola catatan rahasia dan riwayat anggota untuk staf/moderator")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Tambahkan catatan rahasia untuk seorang anggota")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang akan diberi catatan")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("catatan")
            .setDescription("Isi catatan rahasia moderator")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lihat semua catatan rahasia seorang anggota")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang ingin diperiksa")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Hapus catatan rahasia berdasarkan ID catatan")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("ID unik catatan yang ingin dihapus")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages,
      ) &&
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers,
      )
    ) {
      return interaction.reply(
        ephemeral(
          buildErrorContainerV2({
            title: "Izin Tidak Cukup",
            description:
              "Kamu membutuhkan izin **Manage Messages** atau **Moderate Members** untuk mengakses catatan moderasi.",
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const author = interaction.user;

    try {
      if (subcommand === "add") {
        const target = interaction.options.getUser("user", true);
        const noteText = interaction.options.getString("catatan", true).trim();

        if (noteText.length > 1000) {
          return interaction.reply(
            ephemeral(
              buildErrorContainerV2({
                title: "Catatan Terlalu Panjang",
                description: "Panjang catatan maksimal adalah 1000 karakter.",
                footerText: ui.getFooter("core"),
              }),
            ),
          );
        }

        const newNote = await ModNote.create({
          guildId: guild.id,
          targetId: target.id,
          targetTag: target.tag || target.username,
          moderatorId: author.id,
          moderatorTag: author.tag || author.username,
          note: noteText,
        });

        const replyPayload = buildContainerV2({
          accentColorHex: ui.getColor("info") || "#3b82f6",
          title: "Catatan Moderasi Disimpan",
          expression: "success",
          description: `Catatan rahasia untuk <@${target.id}> berhasil ditambahkan. Catatan ini hanya dapat dilihat oleh tim staf.`,
          fields: [
            { label: "Target", value: `<@${target.id}> (${target.id})`, inline: true },
            { label: "Moderator", value: `<@${author.id}>`, inline: true },
            { label: "ID Catatan", value: `\`${newNote._id.toString()}\``, inline: true },
            { label: "Isi Catatan", value: noteText, inline: false },
          ],
          footerText: ui.getFooter("core"),
        });

        await interaction.reply(ephemeral(replyPayload));

        // Kirim audit log ke channel yang disetup admin
        const logPayload = buildContainerV2({
          accentColorHex: ui.getColor("info") || "#3b82f6",
          title: "Audit Log: Catatan Moderasi Baru",
          expression: "neutral",
          description: `Moderator mencatat rekaman perilaku untuk anggota <@${target.id}>.`,
          fields: [
            { label: "Target", value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
            { label: "Moderator", value: `<@${author.id}>`, inline: true },
            { label: "ID", value: `\`${newNote._id.toString()}\``, inline: true },
            { label: "Catatan", value: noteText, inline: false },
          ],
          footerText: ui.getFooter("core"),
        });
        await sendModLog(guild, logPayload);
        return;
      }

      if (subcommand === "list") {
        const target = interaction.options.getUser("user", true);
        const notes = await ModNote.find({
          guildId: guild.id,
          targetId: target.id,
        })
          .sort({ createdAt: -1 })
          .limit(10);

        if (!notes || notes.length === 0) {
          return interaction.reply(
            ephemeral(
              buildContainerV2({
                accentColorHex: ui.getColor("primary") || "#6366f1",
                title: "Catatan Moderasi Bersih",
                expression: "happy",
                description: `Belum ada catatan moderasi rahasia untuk <@${target.id}> di server ini.`,
                footerText: ui.getFooter("core"),
              }),
            ),
          );
        }

        const fields = notes.map((n, idx) => {
          const timestamp = Math.floor(new Date(n.createdAt).getTime() / 1000);
          return {
            label: `#${idx + 1} ID: \`${n._id.toString()}\``,
            value: `**Waktu:** <t:${timestamp}:R>\n**Moderator:** <@${n.moderatorId}>\n**Catatan:** ${n.note}`,
            inline: false,
          };
        });

        const listPayload = buildContainerV2({
          accentColorHex: ui.getColor("warning") || "#f59e0b",
          title: `Catatan Moderasi: ${target.username}`,
          expression: "neutral",
          description: `Ditemukan **${notes.length}** catatan riwayat staf untuk <@${target.id}>.`,
          fields,
          footerText: ui.getFooter("core"),
        });

        return interaction.reply(ephemeral(listPayload));
      }

      if (subcommand === "delete") {
        const noteId = interaction.options.getString("id", true).trim();

        const existingNote = await ModNote.findOne({
          _id: noteId,
          guildId: guild.id,
        }).catch(() => null);

        if (!existingNote) {
          return interaction.reply(
            ephemeral(
              buildErrorContainerV2({
                title: "Catatan Tidak Ditemukan",
                description: `Catatan dengan ID \`${noteId}\` tidak ditemukan di server ini. Periksa kembali ID melalui \`/modnote list\`.`,
                footerText: ui.getFooter("core"),
              }),
            ),
          );
        }

        await ModNote.deleteOne({ _id: noteId, guildId: guild.id });

        const delReply = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#10b981",
          title: "Catatan Moderasi Dihapus",
          expression: "success",
          description: `Catatan ID \`${noteId}\` milik <@${existingNote.targetId}> berhasil dihapus dari arsip database.`,
          footerText: ui.getFooter("core"),
        });

        await interaction.reply(ephemeral(delReply));

        // Kirim audit log
        const logPayload = buildContainerV2({
          accentColorHex: ui.getColor("warning") || "#f59e0b",
          title: "Audit Log: Catatan Moderasi Dihapus",
          expression: "neutral",
          description: `Moderator <@${author.id}> telah menghapus catatan riwayat anggota.`,
          fields: [
            { label: "Target", value: `<@${existingNote.targetId}>`, inline: true },
            { label: "Dihapus Oleh", value: `<@${author.id}>`, inline: true },
            { label: "ID Terhapus", value: `\`${noteId}\``, inline: true },
            { label: "Isi Terhapus", value: existingNote.note, inline: false },
          ],
          footerText: ui.getFooter("core"),
        });
        await sendModLog(guild, logPayload);
        return;
      }
    } catch (err) {
      logger.error("[ModNote] Gagal mengeksekusi perintah modnote:", err);
      return interaction.reply(
        ephemeral(
          buildErrorContainerV2({
            title: "Kesalahan Sistem ModNote",
            description:
              "Terjadi kesalahan saat memproses data catatan moderasi. Pastikan koneksi database aktif.",
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }
  },
};
