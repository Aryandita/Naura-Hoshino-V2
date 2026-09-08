const { SlashCommandBuilder } = require("discord.js");
const ms = require("ms");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("time")
    .setDescription("Waktu dunia dan Pengaturan Timer")
    .addSubcommand((sub) =>
      sub
        .setName("world")
        .setDescription("Lihat waktu saat ini di berbagai zona waktu dunia"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("timer")
        .setDescription("Pasang timer/pengingat untuk dirimu sendiri")
        .addStringOption((opt) =>
          opt
            .setName("durasi")
            .setDescription("Durasi timer (contoh: 15m, 1h, 30s)")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Pesan pengingat saat timer habis")
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "world") {
      const now = new Date();

      const timezones = [
        { name: "🇮🇩 Jakarta (WIB)", tz: "Asia/Jakarta" },
        { name: "🇯🇵 Tokyo (JST)", tz: "Asia/Tokyo" },
        { name: "🇬🇧 London (GMT)", tz: "Europe/London" },
        { name: "🇺🇸 New York (EST)", tz: "America/New_York" },
        { name: "🌐 UTC", tz: "UTC" },
      ];

      let desc = "";
      for (const tz of timezones) {
        const timeString = now.toLocaleString("id-ID", {
          timeZone: tz.tz,
          dateStyle: "full",
          timeStyle: "medium",
        });
        desc += `**${tz.name}**\n> ${timeString}\n\n`;
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `${ui.getEmoji("clock") || "🌍"} Jam Dunia (World Clock)`,
        description: desc.trim(),
        footerText: ui.getFooter("utility"),
      });

      await interaction.reply(payload);
    } else if (subcommand === "timer") {
      const durasiStr = interaction.options.getString("durasi");
      const alasan =
        interaction.options.getString("alasan") || "Waktunya habis!";

      const durationMs = ms(durasiStr);

      if (
        !durationMs ||
        isNaN(durationMs) ||
        durationMs < 1000 ||
        durationMs > ms("24h")
      ) {
        return ui.sendError(
          interaction,
          "Durasi timer tidak valid. Gunakan format seperti `15m`, `1h`, atau `30s` (maks 24 jam).",
          true,
        );
      }

      const endTime = Date.now() + durationMs;

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#00FF00",
        title: "⏱️ Timer Diaktifkan",
        description: `Timer dipasang selama **${durasiStr}**.\nSaya akan mengingatkanmu pada <t:${Math.floor(endTime / 1000)}:T>.`,
        fields: [{ name: "Pengingat", value: alasan }],
        footerText: ui.getFooter("utility"),
      });

      await interaction.reply(payload);

      setTimeout(async () => {
        try {
          const donePayload = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFB6C1",
            title: "⏰ WAKTU HABIS!",
            description: `**${interaction.user.username}**, timer untuk **${durasiStr}** sudah habis!`,
            fields: [{ name: "Pengingat", value: alasan }],
            footerText: ui.getFooter("utility"),
          });

          await interaction.channel.send({
            content: `<@${interaction.user.id}>`,
            ...donePayload,
          });
        } catch (error) {
          // Ignored if channel is deleted or bot lacks permissions
        }
      }, durationMs);
    }
  },

  async autocomplete(interaction) {
    const {
      choice,
      safeRespond,
      fuzzyFilter,
    } = require("../../src/utils/autocompleteHelper");
    const focusedValue = interaction.options.getFocused().toLowerCase();

    const presets = [
      { name: "🍅 25 Menit (Sesi Fokus Pomodoro)", value: "25m" },
      { name: "☕ 5 Menit (Istirahat Pendek)", value: "5m" },
      { name: "🛋️ 15 Menit (Istirahat Panjang)", value: "15m" },
      { name: "⚡ 1 Menit (Quick Timer)", value: "1m" },
      { name: "⏱️ 10 Menit", value: "10m" },
      { name: "⏱️ 30 Menit", value: "30m" },
      { name: "⏱️ 45 Menit", value: "45m" },
      { name: "⏰ 1 Jam", value: "1h" },
      { name: "⏰ 2 Jam", value: "2h" },
      { name: "⏰ 4 Jam", value: "4h" },
      { name: "⏰ 8 Jam", value: "8h" },
      { name: "⏰ 12 Jam", value: "12h" },
      { name: "⏰ 24 Jam (Maksimal)", value: "24h" },
    ];

    const choices = presets.map((p) => choice(p.name, p.value));
    return safeRespond(interaction, fuzzyFilter(choices, focusedValue, 25));
  },
};
