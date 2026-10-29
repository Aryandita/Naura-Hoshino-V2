"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const mysteryEngine = require("../../src/ai/mysteryEngine");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mystery")
    .setDescription("🕵️‍♂️ Game Deduksi Sosial & AI Murder Mystery Game Master")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Mulai penyelidikan kasus pembunuhan baru di server"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clue")
        .setDescription(
          "Buka petunjuk forensik berikutnya dari tempat kejadian",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("interrogate")
        .setDescription("Interogasi salah satu tersangka menggunakan AI")
        .addStringOption((opt) =>
          opt
            .setName("tersangka")
            .setDescription("ID Tersangka yang ingin diinterogasi")
            .addChoices(
              { name: "Dr. Ren (Asisten Peneliti)", value: "dr_ren" },
              {
                name: "Klaus (Kepala Keamanan Cyber)",
                value: "security_klaus",
              },
              { name: "Chloe (Spesialis Enkripsi)", value: "hacker_chloe" },
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("pertanyaan")
            .setDescription("Pertanyaan yang ingin kamu ajukan ke tersangka")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("accuse")
        .setDescription(
          "Ajukan tuduhan vonis pelaku utama di ruang sidang (Trial)",
        )
        .addStringOption((opt) =>
          opt
            .setName("tersangka")
            .setDescription("Pilih siapa pelaku pembunuhan sebenarnya")
            .addChoices(
              { name: "Dr. Ren (Asisten Peneliti)", value: "dr_ren" },
              {
                name: "Klaus (Kepala Keamanan Cyber)",
                value: "security_klaus",
              },
              { name: "Chloe (Spesialis Enkripsi)", value: "hacker_chloe" },
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription(
          "Lihat status penyelidikan dan daftar bukti yang sudah ditemukan",
        ),
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content:
          "❌ Command ini hanya dapat digunakan di dalam server Discord.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const username = interaction.user.displayName || interaction.user.username;

    // 1. START CASE
    if (subcommand === "start") {
      await interaction.deferReply();
      const session = await mysteryEngine.createGameSession(guildId, userId, [
        interaction.user,
      ]);

      const suspectsList = session.scenario.suspects
        .map(
          (s, idx) =>
            `**${idx + 1}. ${s.name}**\n- *Motif:* ${s.motive}\n- *Alibi:* "${s.alibi}"`,
        )
        .join("\n\n");

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("mystery_btn_clue")
          .setLabel("🔍 Buka Petunjuk")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("mystery_btn_status")
          .setLabel("📋 Status Kasus")
          .setStyle(ButtonStyle.Secondary),
      );

      const payload = buildContainerV2({
        accentColorHex: "#EF4444",
        authorName: "🕵️‍♂️ Neo-Hoshino Detective Bureau",
        title: `🚨 Kasus Terbuka: ${session.scenario.title}`,
        description: [
          `Kasus kriminal baru telah dilaporkan kepada Game Master Naura!`,
          ``,
          `👤 **Korban:** \`${session.scenario.victim}\``,
          `📍 **Lokasi:** \`${session.scenario.location}\``,
          `🔎 **Tempat Kejadian:** *${session.scenario.crimeScene}*`,
          ``,
          `👥 **Daftar Tersangka Utama:**`,
          suspectsList,
          ``,
          `-# 💡 *Gunakan \`/mystery interrogate\` untuk menanyai alibi tersangka atau tekan tombol di bawah!*`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
        buttonsRow,
      });

      return interaction.editReply(payload);
    }

    // 2. REVEAL CLUE
    if (subcommand === "clue") {
      await interaction.deferReply();
      const res = await mysteryEngine.revealNextClue(guildId);

      if (!res.success) {
        let msg = "Gagal membuka petunjuk.";
        if (res.reason === "NO_ACTIVE_INVESTIGATION")
          msg =
            "Tidak ada kasus aktif di server ini! Mulai dengan `/mystery start`.";
        if (res.reason === "ALL_CLUES_REVEALED")
          msg =
            "Seluruh petunjuk forensik di TKP sudah terbuka! Saatnya sidang `/mystery accuse`.";

        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Petunjuk Tidak Tersedia",
            description: msg,
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "🔍 Laporan Forensik Cyber-Police",
        title: `Bukti Forensik Terungkap (${res.clueNumber}/${res.totalClues})`,
        description: [
          `Tim investigasi berhasil mengamankan barang bukti baru dari TKP:`,
          ``,
          res.clue,
          ``,
          `-# 💡 *Analisis bukti ini bersama alibi tersangka sebelum mengajukan vonis!*`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }

    // 3. INTERROGATE SUSPECT
    if (subcommand === "interrogate") {
      await interaction.deferReply();
      const suspectId = interaction.options.getString("tersangka");
      const question = interaction.options.getString("pertanyaan");

      const res = await mysteryEngine.interrogateSuspect(
        guildId,
        suspectId,
        question,
        username,
      );

      if (!res.success) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Interogasi Gagal",
            description:
              "Tidak ada penyelidikan aktif atau tersangka tidak valid! Mulai dengan `/mystery start`.",
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#F59E0B",
        authorName: "🎙️ Ruang Interogasi AI",
        title: `Tersangka: ${res.suspectName}`,
        description: [
          `Detektif **${username}** mengajukan pertanyaan:`,
          `> *"${question}"*`,
          ``,
          `**Jawaban Tersangka:**`,
          `💬 *"${res.answer}"*`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }

    // 4. ACCUSE CULPRIT (TRIAL)
    if (subcommand === "accuse") {
      await interaction.deferReply();
      const accusedId = interaction.options.getString("tersangka");
      const res = await mysteryEngine.submitAccusation(
        guildId,
        userId,
        accusedId,
      );

      if (!res.success) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Sidang Tidak Dapat Dimulai",
            description: "Tidak ada penyelidikan aktif yang dapat disidangkan!",
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      if (res.isCorrect) {
        const payload = buildContainerV2({
          accentColorHex: "#86EFAC",
          authorName: "⚖️ Putusan Sidang Neo-Hoshino",
          title: "🎉 KASUS DIPECAHKAN! VONIS BENAR!",
          description: [
            `Luar biasa! Detektif <@${userId}> berhasil mengungkap pelaku pembunuhan sebenarnya: **${res.culpritName}**!`,
            ``,
            `🔍 **Bukti Kontradiksi yang Mematahkan Alibi:**`,
            `> ${res.flaw}`,
            ``,
            `💰 **Hadiah Penyelidik:** \`+${res.reward.toLocaleString("id-ID")} Star Fragments\``,
            ``,
            `Pelaku telah ditahan oleh Cyber-Police dan ketertiban kota Neo-Hoshino kembali terjaga!`,
          ].join("\n"),
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      } else {
        const payload = buildContainerV2({
          accentColorHex: "#EF4444",
          authorName: "⚖️ Putusan Sidang Neo-Hoshino",
          title: "❌ VONIS SALAH! TUDUHAN GAGAL!",
          description: [
            `Kamu menuduh **${res.accusedName}**, namun alibi mereka terbukti sah dan tidak bersalah!`,
            ``,
            `Pelaku sebenarnya (**${res.culpritName}**) berhasil melarikan diri dari kota Neo-Hoshino.`,
            ``,
            `-# 💡 *Mulai kasus baru kapan saja dengan perintah \`/mystery start\`!*`,
          ].join("\n"),
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      }
    }

    // 5. STATUS
    if (subcommand === "status") {
      await interaction.deferReply();
      const session = await mysteryEngine.getSession(guildId);

      if (!session) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Tidak Ada Kasus",
            description:
              "Belum ada kasus aktif di server ini. Gunakan `/mystery start` untuk memulai.",
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      const suspectsList = session.scenario.suspects
        .map((s, idx) => `**${idx + 1}. ${s.name}** (\`${s.id}\`)`)
        .join("\n");

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "📋 Berkas Kasus Aktif",
        title: session.scenario.title,
        description: [
          `👤 **Korban:** \`${session.scenario.victim}\``,
          `📍 **Lokasi:** \`${session.scenario.location}\``,
          `🔍 **Petunjuk Terbuka:** \`${session.currentClueIndex} / ${session.scenario.clues.length}\``,
          `🎙️ **Total Interogasi:** \`${session.interrogations.length} Tanya Jawab\``,
          ``,
          `👥 **Tersangka:**\n${suspectsList}`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }
  },
};
