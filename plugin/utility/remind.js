const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const UserReminder = require("../../src/models/UserReminder");
const ui = require("../../src/config/ui");
const parseDuration = require("parse-duration");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("⏰ Atur pengingat agar Naura mengingatkanmu nanti.")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Buat pengingat baru.")
        .addStringOption((opt) =>
          opt
            .setName("durasi")
            .setDescription("Contoh: 1h, 30m, 1d")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("pesan")
            .setDescription("Pesan yang ingin diingatkan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lihat daftar pengingatmu yang sedang aktif."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Hapus pengingat berdasarkan ID.")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID Pengingat").setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const durasi = interaction.options.getString("durasi");
      const pesan = interaction.options.getString("pesan");

      const ms = parseDuration(durasi);
      if (!ms || ms < 10000 || ms > 365 * 24 * 60 * 60 * 1000) {
        const errPayload = buildErrorContainerV2({
          title: "Format Waktu Tidak Sesuai",
          description:
            "Format durasi tidak valid atau di luar batas wajar (minimal 10 detik, maksimal 1 tahun). Contoh format: `10m`, `2h`, `1d`.",
          footerText: ui.getFooter("utility"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      const remindAt = new Date(Date.now() + ms);
      const unixTime = Math.floor(remindAt.getTime() / 1000);

      const created = await UserReminder.create({
        userId: interaction.user.id,
        channelId: interaction.channel.id,
        message: pesan,
        remindAt: remindAt,
      });

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#38BDF8",
        authorName: "Sistem Pengingat Jadwal",
        title: "Pengingat Berhasil Disetel",
        description: `Naura akan mengirimkan pengingat untukmu di saluran ini.\n\n` +
          `• **Pesan:** ${pesan}\n` +
          `• **Waktu:** <t:${unixTime}:F> (<t:${unixTime}:R>)\n` +
          `• **ID Pengingat:** \`#${created.id}\``,
        footerText: ui.getFooter("utility"),
      });

      await interaction.reply(payload);
    } else if (subcommand === "list") {
      const reminders = await UserReminder.findAll({
        where: { userId: interaction.user.id },
        order: [["remindAt", "ASC"]],
        limit: 10,
      });

      if (reminders.length === 0) {
        return interaction.reply({
          ...buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#38BDF8",
            authorName: "Sistem Pengingat Jadwal",
            title: "Daftar Pengingat Kosong",
            description: "Kamu belum memiliki catatan pengingat yang sedang aktif saat ini.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      let desc = "Berikut adalah daftar agenda pengingat aktif milikmu:\n\n";
      for (const rem of reminders) {
        const remUnix = Math.floor(new Date(rem.remindAt).getTime() / 1000);
        desc += `**\`#${rem.id}\` • <t:${remUnix}:R>** (<t:${remUnix}:d>)\n> ${rem.message}\n\n`;
      }
      desc += "-# Gunakan `/remind delete id:<nomor>` untuk membatalkan pengingat.";

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#38BDF8",
        authorName: "Sistem Pengingat Jadwal",
        title: `Daftar Pengingat Aktif (${reminders.length})`,
        description: desc.trim(),
        footerText: ui.getFooter("utility"),
      });

      await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    } else if (subcommand === "delete") {
      const id = interaction.options.getInteger("id");
      const reminder = await UserReminder.findOne({
        where: { id: id, userId: interaction.user.id },
      });

      if (!reminder) {
        const errPayload = buildErrorContainerV2({
          title: "Pengingat Tidak Ditemukan",
          description:
            "Pengingat dengan ID tersebut tidak ditemukan atau telah kadaluwarsa.",
          footerText: ui.getFooter("utility"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      const deletedMessage = reminder.message;
      await reminder.destroy();

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#34D399",
        authorName: "Sistem Pengingat Jadwal",
        title: "Pengingat Dibatalkan",
        description: `Pengingat **\`#${id}\`** dengan pesan "${deletedMessage}" berhasil dihapus dari jadwal.`,
        footerText: ui.getFooter("utility"),
      });

      await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
  },
};
