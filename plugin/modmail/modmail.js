const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const ModMail = require("../../src/models/ModMail");
const GuildSettings = require("../../src/models/GuildSettings");
const ui = require("../../src/config/ui");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { logger } = require("../../src/managers/logger");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

const TRANSCRIPT_LIMIT = 100;
const DELETE_DELAY_MS = 10000;

// Nama berkas memuat penanda waktu supaya dua tiket yang ditutup berdekatan
// tidak saling menimpa transkrip.
function transcriptPath(channelId) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return path.join(os.tmpdir(), `transcript-${channelId}-${stamp}.txt`);
}

async function buildTranscript(channel, ticket, closer, reason, user) {
  const messages = await channel.messages.fetch({ limit: TRANSCRIPT_LIMIT });
  const ordered = Array.from(messages.values()).reverse();

  const header =
    "=== TRANSKRIP MODMAIL ===\n" +
    `Pengguna: ${user ? user.tag : "Tidak diketahui"}\n` +
    `Ditutup oleh: ${closer.tag}\n` +
    `Alasan: ${reason}\n` +
    `Catatan: hanya ${TRANSCRIPT_LIMIT} pesan terakhir yang terekam.\n\n`;

  const body = ordered
    .map(
      (m) =>
        `[${new Date(m.createdTimestamp).toUTCString()}] ${m.author.tag}: ${m.content}`,
    )
    .join("\n");

  const file = transcriptPath(ticket.channelId);
  await fs.writeFile(file, header + body, "utf8");
  return file;
}

async function cleanup(file) {
  if (!file) return;
  try {
    await fs.unlink(file);
  } catch (e) {
    // Berkas sementara mungkin sudah hilang, itu bukan masalah.
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modmail")
    .setDescription("Kelola tiket Modmail bersama Naura")
    .addSubcommand((sub) =>
      sub
        .setName("reply")
        .setDescription("Balas pesan pengguna di tiket ini")
        .addStringOption((opt) =>
          opt
            .setName("pesan")
            .setDescription("Isi pesan balasan")
            .setRequired(true),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("anonim")
            .setDescription("Sembunyikan namamu?")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Tutup tiket modmail ini")
        .addStringOption((opt) =>
          opt.setName("alasan").setDescription("Alasan penutupan tiket"),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    const ticket = await ModMail.findOne({
      where: { channelId: interaction.channel.id, closed: false },
    });

    if (!ticket) return ui.sendError(interaction, "err_sys_10", true);

    const user = await interaction.client.users
      .fetch(ticket.userId)
      .catch(() => null);

    if (subcommand === "reply") {
      const replyText = interaction.options.getString("pesan");
      const isAnon = interaction.options.getBoolean("anonim") || false;

      if (!user) return ui.sendError(interaction, "err_sys_11", true);

      const replyPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary"),
        authorName: "Staf Server",
        iconURL: interaction.guild.iconURL(),
        expression: "info",
        description: replyText,
        footerText: isAnon
          ? "Dibalas oleh: Staf Server"
          : `Dibalas oleh: ${interaction.user.tag}`,
      });

      try {
        await user.send(replyPayload);
      } catch (err) {
        logger.error("[Modmail] Gagal mengirim balasan: " + err.message);
        return ui.sendError(interaction, "err_sys_12", true);
      }

      const logPayload = buildContainerV2({
        accentColorHex: "#5865F2",
        authorName: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
        expression: "success",
        description: `Naura sudah menyampaikan balasanmu ya!\n\n${replyText}`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply(logPayload);
    }

    const reason =
      interaction.options.getString("alasan") || "Tidak ada alasan";

    // Status basis data didahulukan supaya tetap benar walau pengarsipan gagal.
    ticket.closed = true;
    await ticket.save({ fields: ["closed"] });

    let transcriptFile = null;
    try {
      transcriptFile = await buildTranscript(
        interaction.channel,
        ticket,
        interaction.user,
        reason,
        user,
      );

      if (user) {
        await user
          .send({
            content:
              `Tiket kamu sudah ditutup oleh **${interaction.user.tag}** ya.\n` +
              `Alasannya: ${reason}\n` +
              "Naura lampirkan riwayat percakapannya di bawah, semoga membantu!",
            files: [new AttachmentBuilder(transcriptFile)],
          })
          .catch(() => null);
      }

      await interaction.channel.send({
        content: "Transkrip percakapan sudah Naura arsipkan.",
        files: [new AttachmentBuilder(transcriptFile)],
      });
    } catch (e) {
      logger.error("[Modmail] Gagal mengarsipkan transkrip: " + e.message);
      if (user) {
        await user
          .send({
            content: `Tiket kamu sudah ditutup ya.\nAlasannya: ${reason}`,
          })
          .catch(() => null);
      }
    } finally {
      await cleanup(transcriptFile);
    }

    if (user) {
      const closePayload = buildContainerV2({
        accentColorHex: "#ED4245",
        title: "Tiket Ditutup",
        expression: "info",
        description: `Tiketmu sudah ditutup oleh staf ya.\n**Alasan:** ${reason}\n\nKalau masih ada yang mau ditanyakan, Naura selalu siap membantu!`,
        footerText: ui.getFooter("core"),
      });
      await user.send(closePayload).catch(() => {});
    }

    const successPayload = buildContainerV2({
      accentColorHex: ui.getColor("success"),
      title: "Tiket Ditutup",
      expression: "success",
      description:
        "Tiketnya sudah Naura tutup. Channel ini akan dihapus sepuluh detik lagi ya!",
      footerText: ui.getFooter("core"),
    });

    await interaction.reply(successPayload);

    try {
      const settings = await GuildSettings.findOne({
        where: { guildId: interaction.guild.id },
      });
      const logChannelId =
        settings && settings.settings && settings.settings.modmail
          ? settings.settings.modmail.logChannelId
          : null;

      if (logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          await logChannel.send(
            `Tiket <@${ticket.userId}> ditutup oleh <@${interaction.user.id}>.\n**Alasan:** ${reason}`,
          );
        }
      }
    } catch (e) {
      logger.error("[Modmail] Gagal menulis log penutupan: " + e.message);
    }

    setTimeout(
      () => interaction.channel.delete().catch(() => {}),
      DELETE_DELAY_MS,
    );
  },
};
