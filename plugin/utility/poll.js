const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("📊 Buat sistem voting interaktif.")
    .addStringOption((opt) =>
      opt
        .setName("pertanyaan")
        .setDescription("Pertanyaan untuk polling")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("pilihan_1")
        .setDescription("Pilihan pertama")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("pilihan_2")
        .setDescription("Pilihan kedua")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("pilihan_3")
        .setDescription("Pilihan ketiga")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("pilihan_4")
        .setDescription("Pilihan keempat")
        .setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("multi_vote")
        .setDescription("Boleh memilih lebih dari satu? (Default: False)")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("durasi")
        .setDescription("Durasi polling dalam menit (Default: 60)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const question = interaction.options.getString("pertanyaan");
    const multiVote = interaction.options.getBoolean("multi_vote") || false;
    const durationMin = interaction.options.getInteger("durasi") || 60;

    const options = [];
    for (let i = 1; i <= 4; i++) {
      const opt = interaction.options.getString(`pilihan_${i}`);
      if (opt) options.push(opt);
    }

    const endUnix = Math.floor(Date.now() / 1000) + durationMin * 60;
    const votes = new Map();

    const renderDescription = (activeVotes = 0, isClosed = false) => {
      let desc = isClosed
        ? `**Sesi Voting Telah Ditutup**\nTotal Partisipasi: **${activeVotes} Suara**\n\n`
        : `Tentukan pilihanmu melalui tombol di bawah.\nAturan: ${multiVote ? "**Pilihan Ganda (Bisa memilih lebih dari satu)**" : "**Pilihan Tunggal (Hanya satu opsi)**"}\nBatas Waktu: <t:${endUnix}:R> (<t:${endUnix}:T>)\n\n`;

      const results = new Array(options.length).fill(0);
      let total = 0;
      for (const uVotes of votes.values()) {
        for (const idx of uVotes) {
          results[idx]++;
          total++;
        }
      }

      options.forEach((opt, index) => {
        const count = results[index];
        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
        const filled = Math.round(percentage / 10);
        const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
        desc += `**${index + 1}. ${opt}** (${count} suara • ${percentage}%)\n\`${bar}\`\n\n`;
      });

      return desc;
    };

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#38BDF8",
      authorName: "Sistem Pemungutan Suara",
      iconURL: interaction.user.displayAvatarURL(),
      title: question,
      description: renderDescription(0, false),
      footerText: `Inisiator: ${interaction.user.username}`,
    });

    const rows = [];
    let currentRow = new ActionRowBuilder();
    const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

    options.forEach((opt, index) => {
      if (currentRow.components.length === 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_opt_${index}`)
          .setLabel(opt.length > 70 ? opt.slice(0, 67) + "..." : opt)
          .setEmoji(numberEmojis[index] || "🔹")
          .setStyle(ButtonStyle.Secondary),
      );
    });
    if (currentRow.components.length > 0) rows.push(currentRow);

    const pollMessage = await interaction.reply({
      ...payload,
      components: rows,
      fetchReply: true,
    });

    const collector = pollMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: durationMin * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      const optIndex = parseInt(i.customId.split("_")[2], 10);
      const userId = i.user.id;

      if (!votes.has(userId)) {
        votes.set(userId, new Set());
      }

      const userVotes = votes.get(userId);

      if (!multiVote && userVotes.size > 0 && !userVotes.has(optIndex)) {
        return i.reply({
          content: "Kamu hanya dapat memilih satu opsi pada polling ini. Batalkan opsi sebelumnya terlebih dahulu jika ingin berganti pilihan.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (userVotes.has(optIndex)) {
        userVotes.delete(optIndex);
        await i.reply({
          content: `Pilihan untuk opsi **"${options[optIndex]}"** telah dibatalkan.`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        userVotes.add(optIndex);
        await i.reply({
          content: `Suaramu berhasil disimpan untuk opsi **"${options[optIndex]}"**.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      let totalVotes = 0;
      for (const uVotes of votes.values()) {
        totalVotes += uVotes.size;
      }

      const updatePayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#38BDF8",
        authorName: "Sistem Pemungutan Suara",
        iconURL: interaction.user.displayAvatarURL(),
        title: question,
        description: renderDescription(totalVotes, false),
        footerText: `Inisiator: ${interaction.user.username} • Total Partisipasi: ${totalVotes} Suara`,
      });

      await interaction
        .editReply({ ...updatePayload, components: rows })
        .catch(() => {});
    });

    collector.on("end", async () => {
      let totalVotes = 0;
      for (const userVotes of votes.values()) {
        totalVotes += userVotes.size;
      }

      const resultPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#34D399",
        authorName: "Hasil Akhir Pemungutan Suara",
        iconURL: interaction.user.displayAvatarURL(),
        title: question,
        description: renderDescription(totalVotes, true),
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply({ ...resultPayload, components: [] }).catch(() => {});
    });
  },
};
