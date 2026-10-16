"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { logger } = require("../../../src/managers/logger");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const geminiClient = require("../../../src/ai/geminiClient");

module.exports = {
  name: "tod",
  async execute(interaction) {
    const opponent = interaction.options.getUser("teman");
    const initiator = interaction.user;
    let currentPlayer = initiator;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tod_truth")
        .setLabel("Truth (Jujur)")
        .setStyle(ButtonStyle.Success)
        .setEmoji(ui.getEmoji("tod_truth") || "📝"),
      new ButtonBuilder()
        .setCustomId("tod_dare")
        .setLabel("Dare (Tantangan)")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(ui.getEmoji("tod_dare") || "😈"),
      new ButtonBuilder()
        .setCustomId("tod_spin")
        .setLabel("Putar Botol 🔄")
        .setStyle(ButtonStyle.Primary),
    );

    const todPayload = buildContainerV2({
      accentColorHex: ui.colors.primary || "#FFB6C1",
      title: `${ui.getEmoji("setup_autorole") || "🎭"} TRUTH OR DARE ${ui.getEmoji("setup_autorole") || "🎭"}`,
      description: `Sekarang giliran <@${currentPlayer.id}> untuk memilih!\n\nApakah kamu memilih **Truth** (Jujur) atau **Dare** (Tantangan)?`,
      iconURL: currentPlayer.displayAvatarURL(),
      buttonsRow: row,
      footerText: ui.getFooter("core"),
    });

    const msg = await interaction.editReply({
      ...todPayload,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 180000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== currentPlayer.id) {
        return i.reply({
          content: `❌ Ini giliran <@${currentPlayer.id}> untuk memilih!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await i.deferUpdate();

      if (i.customId === "tod_spin") {
        let chosenUser = initiator;
        if (opponent) {
          chosenUser =
            currentPlayer.id === initiator.id ? opponent : initiator;
        } else {
          try {
            const members = await interaction.guild.members.fetch();
            const activeMembers = members.filter(
              (m) => !m.user.bot && m.user.id !== currentPlayer.id,
            );
            if (activeMembers.size > 0) {
              chosenUser = activeMembers.random().user;
            }
          } catch (e) {
            logger.error("[TOD SPIN ERROR]", e);
          }
        }

        currentPlayer = chosenUser;

        const spinPayload = buildContainerV2({
          accentColorHex: ui.colors.primary || "#FFB6C1",
          title: `${ui.getEmoji("trade") || "🔄"} BOTOL BERPUTAR... ${ui.getEmoji("trade") || "🔄"}`,
          description: `Botol menunjuk ke <@${currentPlayer.id}>!\n\nSekarang giliran <@${currentPlayer.id}> untuk memilih **Truth** atau **Dare**!`,
          iconURL: currentPlayer.displayAvatarURL(),
          buttonsRow: row,
          footerText: ui.getFooter("core"),
        });

        return i.editReply(spinPayload);
      }

      if (i.customId === "tod_truth" || i.customId === "tod_dare") {
        const isTruth = i.customId === "tod_truth";
        const actionText = isTruth
          ? "Truth (Pertanyaan)"
          : "Dare (Tantangan)";
        const actionEmoji = isTruth
          ? ui.getEmoji("tod_truth") || "📝"
          : ui.getEmoji("tod_dare") || "😈";

        const loadingPayload = buildContainerV2({
          accentColorHex: ui.colors.primary || "#FFB6C1",
          description: `${ui.getEmoji("loading") || "⏳"} Naura sedang mencari inspirasi ${actionText} yang menarik untukmu... ✨`,
          footerText: ui.getFooter("core"),
        });

        await i.editReply(loadingPayload);

        let promptAI = "";
        if (isTruth) {
          promptAI = `Buatkan 1 pertanyaan Truth (jujur) yang sangat memalukan, lucu, seru, dan menantang untuk dijawab di depan teman-teman. Jawab hanya berupa teks pertanyaan dalam Bahasa Indonesia murni tanpa tambahan apa pun.`;
        } else {
          promptAI = `Buatkan 1 tantangan Dare (tantangan) yang lucu, konyol, menantang, aman, dan menghibur untuk dilakukan. Jawab hanya berupa teks tantangan dalam Bahasa Indonesia murni tanpa tambahan apa pun.`;
        }

        let generatedChallenge = "";
        try {
          const rawText = await geminiClient.generate({
            model: "gemini-2.5-flash",
            parts: [{ text: promptAI }],
          });
          generatedChallenge = (rawText || "").trim();
        } catch (err) {
          logger.error("[TOD GEMINI ERROR]", err);
          if (isTruth) {
            const fallbackTruths = [
              "Apa rahasia terbesar yang belum pernah kamu ceritakan kepada siapa pun di server ini?",
              "Kapan terakhir kali kamu menangis dan apa alasannya?",
              "Siapa orang yang paling kamu sukai diam-diam di server Discord ini?",
              "Apa hal terkonyol yang pernah kamu lakukan demi menarik perhatian seseorang?",
              "Jika kamu bisa bertukar tubuh dengan salah satu temanmu selama sehari, siapa yang akan kamu pilih dan mengapa?",
            ];
            generatedChallenge =
              fallbackTruths[
                Math.floor(Math.random() * fallbackTruths.length)
              ];
          } else {
            const fallbackDares = [
              "Kirim voice note bernyanyi bagian chorus dari lagu favoritmu di chat umum saat ini juga!",
              "Ubah nickname Discord-mu menjadi 'Hamba Sahaya Naura' selama 24 jam ke depan!",
              "Gunakan foto profil badut lucu selama 3 hari berturut-turut!",
              "Kirim pesan cinta acak ke salah satu bot di server ini dan screenshot balasannya!",
              "Tirukan suara hewan (seperti kucing manja atau bebek) lewat voice note dan kirim ke grup!",
            ];
            generatedChallenge =
              fallbackDares[Math.floor(Math.random() * fallbackDares.length)];
          }
        }

        const doneRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("tod_done")
            .setLabel("Selesai")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("tod_next_turn")
            .setLabel("Giliran Baru")
            .setStyle(ButtonStyle.Primary),
        );

        const challengePayload = buildContainerV2({
          accentColorHex: isTruth ? "#2ecc71" : "#e74c3c",
          authorName: `Tantangan ${actionText} untuk ${currentPlayer.username}`,
          iconURL: currentPlayer.displayAvatarURL(),
          description: `### ${actionEmoji} ${actionText}\n\n> **${generatedChallenge}**`,
          buttonsRow: doneRow,
          footerText:
            "Klik tombol di bawah jika kamu sudah menyelesaikannya!",
        });

        await i.editReply(challengePayload);
      }
    });

    collector.on("collect", async (i) => {
      if (i.customId === "tod_done" || i.customId === "tod_next_turn") {
        if (i.user.id !== currentPlayer.id) {
          return i.reply({
            content: `${ui.getEmoji("error") || "❌"} Hanya pemain aktif yang bisa menekan tombol ini!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await i.deferUpdate();

        if (i.customId === "tod_done") {
          const nextRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("tod_next_turn")
              .setLabel("Main Lagi")
              .setStyle(ButtonStyle.Primary),
          );
          const donePayload = buildContainerV2({
            accentColorHex: "#2ecc71",
            title: `${ui.getEmoji("celebrate") || "🎉"} TANTANGAN SELESAI ${ui.getEmoji("celebrate") || "🎉"}`,
            description: `Hebat! <@${currentPlayer.id}> berhasil menyelesaikan tantangan mereka!\n\nApakah kalian ingin bermain lagi?`,
            buttonsRow: nextRow,
            footerText: ui.getFooter("core"),
          });
          await i.editReply(donePayload);
        } else if (i.customId === "tod_next_turn") {
          if (opponent) {
            currentPlayer =
              currentPlayer.id === initiator.id ? opponent : initiator;
          }

          const nextPayload = buildContainerV2({
            accentColorHex: ui.colors.primary || "#FFB6C1",
            title: `${ui.getEmoji("setup_autorole") || "🎭"} TRUTH OR DARE ${ui.getEmoji("setup_autorole") || "🎭"}`,
            description: `Sekarang giliran <@${currentPlayer.id}> untuk memilih!\n\nApakah kamu memilih **Truth** (Jujur) atau **Dare** (Tantangan)?`,
            iconURL: currentPlayer.displayAvatarURL(),
            buttonsRow: row,
            footerText: ui.getFooter("core"),
          });

          await i.editReply(nextPayload);
        }
      }
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
