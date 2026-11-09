"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { logger } = require("../../../src/managers/logger");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const geminiClient = require("../../../src/ai/geminiClient");
const { genGameId, cid, parseCid, setState, States, rewardOnce, tryReset } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "tod",
  async execute(interaction, context) {
    const opponent = (context && context.teman) || (context && context.lawan) || interaction.options?.getUser?.("teman") || null;
    const initiator = interaction.user;
    const gameId = genGameId("tod", initiator.id);
    setState(gameId, States.WAITING_INPUT);
    let currentPlayer = initiator;
    let processed = false;

    const row = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(cid(gameId, "tod_truth")).setLabel("Truth (Jujur)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(cid(gameId, "tod_dare")).setLabel("Dare (Tantangan)").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cid(gameId, "tod_spin")).setLabel("Putar Botol").setStyle(ButtonStyle.Primary),
    );

    const todPayload = buildContainerV2({ accentColorHex: ui.colors.primary || "#FFB6C1", title: "TRUTH OR DARE", description: "Sekarang giliran <@" + currentPlayer.id + "> untuk memilih!\n\nApakah kamu memilih **Truth** (Jujur) atau **Dare** (Tantangan)?", iconURL: currentPlayer.displayAvatarURL(), buttonsRow: row(), footerText: ui.getFooter("core") });
    const msg = await interaction.editReply({ ...todPayload, fetchReply: true });
    const collector = msg.createMessageComponentCollector({ time: 180000 });
    let validAnswers = 0;

    collector.on("collect", async (i) => {
      if (processed) return;
      const parsed = parseCid(i.customId);
      if (!parsed || parsed.gameId !== gameId) return;
      if (i.user.id !== currentPlayer.id) {
        return i.reply({ content: "Ini giliran <@" + currentPlayer.id + "> untuk memilih!", flags: MessageFlags.Ephemeral });
      }
      validAnswers++;
      if (validAnswers > 1) tryReset(collector, gameId);
      const action = parsed.action;
      if (action === "tod_spin") {
        processed = true;
        await i.deferUpdate();
        let chosenUser = initiator;
        if (opponent) chosenUser = currentPlayer.id === initiator.id ? opponent : initiator;
        else {
          try {
            const members = await interaction.guild.members.fetch();
            const activeMembers = members.filter((m) => !m.user.bot && m.user.id !== currentPlayer.id);
            if (activeMembers.size > 0) chosenUser = activeMembers.random().user;
          } catch (e) { logger.error("[TOD SPIN ERROR]", e); }
        }
        currentPlayer = chosenUser;
        processed = false;
        const spinPayload = buildContainerV2({ accentColorHex: ui.colors.primary || "#FFB6C1", title: "BOTOL BERPUTAR...", description: "Botol menunjuk ke <@" + currentPlayer.id + ">!\n\nSekarang giliran <@" + currentPlayer.id + "> untuk memilih **Truth** atau **Dare**!", iconURL: currentPlayer.displayAvatarURL(), buttonsRow: row(), footerText: ui.getFooter("core") });
        return i.editReply(spinPayload);
      }
      if (action === "tod_truth" || action === "tod_dare") {
        processed = true;
        const isTruth = action === "tod_truth";
        const actionText = isTruth ? "Truth (Pertanyaan)" : "Dare (Tantangan)";
        await i.deferUpdate();
        const loadingPayload = buildContainerV2({ accentColorHex: ui.colors.primary || "#FFB6C1", description: "Naura sedang mencari inspirasi " + actionText + " yang menarik untukmu...", footerText: ui.getFooter("core") });
        await i.editReply(loadingPayload);
        let promptAI = isTruth ? "Buatkan 1 pertanyaan Truth yang sangat memalukan, lucu, seru, dan menantang untuk dijawab di depan teman-teman. Jawab hanya berupa teks pertanyaan dalam Bahasa Indonesia murni tanpa tambahan apa pun." : "Buatkan 1 tantangan Dare yang lucu, konyol, menantang, aman, dan menghibur untuk dilakukan. Jawab hanya berupa teks tantangan dalam Bahasa Indonesia murni tanpa tambahan apa pun.";
        let generatedChallenge = "";
        try {
          const rawText = await geminiClient.generate({ model: "gemini-2.5-flash", parts: [{ text: promptAI }] });
          generatedChallenge = (rawText || "").trim();
        } catch (err) {
          logger.error("[TOD GEMINI ERROR]", err);
          if (isTruth) {
            const fallbackTruths = ["Apa rahasia terbesar yang belum pernah kamu ceritakan kepada siapa pun di server ini?","Kapan terakhir kali kamu menangis dan apa alasannya?","Siapa orang yang paling kamu sukai diam-diam di server Discord ini?","Apa hal terkonyol yang pernah kamu lakukan demi menarik perhatian seseorang?","Jika kamu bisa bertukar tubuh dengan salah satu temanmu selama sehari, siapa yang akan kamu pilih dan mengapa?"];
            generatedChallenge = fallbackTruths[Math.floor(Math.random() * fallbackTruths.length)];
          } else {
            const fallbackDares = ["Kirim voice note bernyanyi bagian chorus dari lagu favoritmu di chat umum saat ini juga!","Ubah nickname Discord-mu menjadi Hamba Sahaya Naura selama 24 jam ke depan!","Gunakan foto profil badut lucu selama 3 hari berturut-turut!","Kirim pesan cinta acak ke salah satu bot di server ini dan screenshot balasannya!","Tirukan suara hewan (seperti kucing manja atau bebek) lewat voice note dan kirim ke grup!"];
            generatedChallenge = fallbackDares[Math.floor(Math.random() * fallbackDares.length)];
          }
        }
        const doneRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(cid(gameId, "tod_done")).setLabel("Selesai").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(cid(gameId, "tod_next_turn")).setLabel("Giliran Baru").setStyle(ButtonStyle.Primary),
        );
        const challengePayload = buildContainerV2({ accentColorHex: isTruth ? "#2ecc71" : "#e74c3c", authorName: "Tantangan " + actionText + " untuk " + currentPlayer.username, iconURL: currentPlayer.displayAvatarURL(), description: "### " + actionText + "\n\n> **" + generatedChallenge + "**", buttonsRow: doneRow, footerText: "Klik tombol di bawah jika kamu sudah menyelesaikannya!" });
        processed = false;
        await i.editReply(challengePayload);
        return;
      }
      if (action === "tod_done" || action === "tod_next_turn") {
        await i.deferUpdate();
        if (action === "tod_done") {
          const nextRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(cid(gameId, "tod_next_turn")).setLabel("Main Lagi").setStyle(ButtonStyle.Primary));
          const donePayload = buildContainerV2({ accentColorHex: "#2ecc71", title: "TANTANGAN SELESAI", description: "Hebat! <@" + currentPlayer.id + "> berhasil menyelesaikan tantangan mereka!\n\nApakah kalian ingin bermain lagi?", buttonsRow: nextRow, footerText: ui.getFooter("core") });
          await i.editReply(donePayload);
        } else {
          if (opponent) currentPlayer = currentPlayer.id === initiator.id ? opponent : initiator;
          const nextPayload = buildContainerV2({ accentColorHex: ui.colors.primary || "#FFB6C1", title: "TRUTH OR DARE", description: "Sekarang giliran <@" + currentPlayer.id + "> untuk memilih!\n\nApakah kamu memilih **Truth** (Jujur) atau **Dare** (Tantangan)?", iconURL: currentPlayer.displayAvatarURL(), buttonsRow: row(), footerText: ui.getFooter("core") });
          await i.editReply(nextPayload);
        }
        return;
      }
    });

    collector.on("end", () => { msg.edit({ components: [] }).catch(() => {}); });
  },
};
