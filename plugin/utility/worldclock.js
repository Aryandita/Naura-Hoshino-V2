const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

const TIMEZONES = [
  { code: "WIB", name: "🇮🇩 WIB (Indonesia Barat / Jakarta)", tz: "Asia/Jakarta" },
  { code: "WITA", name: "🇮🇩 WITA (Indonesia Tengah / Bali, Makassar)", tz: "Asia/Makassar" },
  { code: "WIT", name: "🇮🇩 WIT (Indonesia Timur / Jayapura)", tz: "Asia/Jayapura" },
  { code: "JST", name: "🇯🇵 JST (Jepang / Tokyo)", tz: "Asia/Tokyo" },
  { code: "SGT", name: "🇸🇬 SGT (Singapura / Singapore)", tz: "Asia/Singapore" },
  { code: "UTC", name: "🌐 UTC (Universal Time Coordinated)", tz: "UTC" },
  { code: "GMT", name: "🇬🇧 GMT / BST (Inggris / London)", tz: "Europe/London" },
  { code: "EST", name: "🇺🇸 EST / EDT (AS Timur / New York)", tz: "America/New_York" },
  { code: "PST", name: "🇺🇸 PST / PDT (AS Pasifik / Los Angeles)", tz: "America/Los_Angeles" },
];

const ZONE_CHOICES = TIMEZONES.map((z) => ({
  name: `${z.code} - ${z.name.replace(/[^\x00-\x7F]/g, "").trim()}`,
  value: z.code,
}));

function convertTimezone(timeStr, fromTz, toTz) {
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: fromTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parseInt(parts.find((p) => p.type === "year").value, 10);
  const mo = parseInt(parts.find((p) => p.type === "month").value, 10);
  const d = parseInt(parts.find((p) => p.type === "day").value, 10);

  let guess = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
  for (let i = 0; i < 3; i++) {
    const fParts = new Intl.DateTimeFormat("en-US", {
      timeZone: fromTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(guess);

    const fh = parseInt(fParts.find((p) => p.type === "hour").value, 10) % 24;
    const fm = parseInt(fParts.find((p) => p.type === "minute").value, 10);
    const diffMs = ((h - fh) * 60 + (m - fm)) * 60 * 1000;
    if (diffMs === 0) break;
    guess = new Date(guess.getTime() + diffMs);
  }

  const resultTime = guess.toLocaleTimeString("id-ID", {
    timeZone: toTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const resultDate = guess.toLocaleDateString("id-ID", {
    timeZone: toTz,
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return { time: resultTime, date: resultDate };
}

module.exports = {
  isSubcommand: true,
  data: new SlashCommandBuilder()
    .setName("worldclock")
    .setDescription("Jam dunia terpadu & konversi waktu antar zona internasional")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat waktu saat ini di berbagai zona waktu utama dunia"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("convert")
        .setDescription("Konversi jam tertentu dari satu zona waktu ke zona lain")
        .addStringOption((opt) =>
          opt
            .setName("jam")
            .setDescription("Jam yang ingin dikonversi format 24 jam (contoh: 14:30 atau 09:15)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("dari")
            .setDescription("Zona waktu asal")
            .setRequired(true)
            .addChoices(...ZONE_CHOICES),
        )
        .addStringOption((opt) =>
          opt
            .setName("ke")
            .setDescription("Zona waktu tujuan")
            .setRequired(true)
            .addChoices(...ZONE_CHOICES),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const now = new Date();

    if (subcommand === "view") {
      const fields = TIMEZONES.map((z) => {
        const timeStr = now.toLocaleTimeString("id-ID", {
          timeZone: z.tz,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        const dateStr = now.toLocaleDateString("id-ID", {
          timeZone: z.tz,
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        return {
          name: z.name,
          value: `⏰ **${timeStr}** (${dateStr})`,
          inline: true,
        };
      });

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("info") || "#3b82f6",
        title: "Jam Dunia (World Clock)",
        expression: "happy",
        description: "Berikut adalah waktu lokal saat ini di berbagai zona waktu utama dunia.",
        fields,
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply(payload);
    }

    if (subcommand === "convert") {
      const jamInput = interaction.options.getString("jam", true).trim();
      const fromCode = interaction.options.getString("dari", true);
      const toCode = interaction.options.getString("ke", true);

      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(jamInput)) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Format Jam Salah",
            description: "Masukkan jam dengan format 24 jam yang valid, contoh: `14:30` atau `08:00`.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const fromZone = TIMEZONES.find((z) => z.code === fromCode);
      const toZone = TIMEZONES.find((z) => z.code === toCode);

      if (!fromZone || !toZone) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Zona Tidak Valid",
            description: "Zona waktu yang dipilih tidak dikenali sistem.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const converted = convertTimezone(jamInput, fromZone.tz, toZone.tz);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#10b981",
        title: "Konversi Zona Waktu",
        expression: "success",
        description: `Hasil konversi waktu dari **${fromZone.code}** ke **${toZone.code}**:`,
        fields: [
          {
            name: `Asal (${fromZone.code})`,
            value: `**${jamInput}**\n${fromZone.name}`,
            inline: true,
          },
          {
            name: `Tujuan (${toZone.code})`,
            value: `**${converted.time}** (${converted.date})\n${toZone.name}`,
            inline: true,
          },
        ],
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply(payload);
    }
  },
};
