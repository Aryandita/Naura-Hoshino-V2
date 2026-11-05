"use strict";

const UserProfile = require("../../../src/models/UserProfile");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "leaderboard",
  async execute(interaction, context) {
    const { sendError } = context;
    const category = interaction.options.getString("kategori");

    const isMath = category === "math";
    const isTrivia = category === "trivia";
    const isDuel = category === "duel";

    let title = "";
    if (isMath) {
      title = `${ui.getEmoji("tools") || "🧮"} Top 10 GrandMaster Matematika`;
    } else if (isTrivia) {
      title = `${ui.getEmoji("intelligence") || "🧠"} Top 10 GrandMaster Trivia`;
    } else if (isDuel) {
      title = `${ui.getEmoji("battle") || "⚔️"} Top 10 Jawara Duel Naura`;
    }

    const allUsers = await UserProfile.findAll();
    const sortedUsers = allUsers
      .filter((u) => {
        if (isMath) return u.minigame_mathScore > 0;
        if (isTrivia) return u.minigame_triviaScore > 0;
        if (isDuel) return u.minigame_duelScore > 0;
        return false;
      })
      .sort((a, b) => {
        if (isMath) return b.minigame_mathScore - a.minigame_mathScore;
        if (isTrivia) return b.minigame_triviaScore - a.minigame_triviaScore;
        if (isDuel) return b.minigame_duelScore - a.minigame_duelScore;
        return 0;
      })
      .slice(0, 10);

    if (sortedUsers.length === 0) {
      return sendError("Belum ada yang mencetak skor di kategori kuis ini.");
    }

    let descString = `> Inilah daftar pemain kuis terbaik di server!\n\n`;
    sortedUsers.forEach((u, i) => {
      const medal =
        i === 0
          ? ui.getEmoji("badge_gold") || "🥇"
          : i === 1
            ? ui.getEmoji("badge_silver") || "🥈"
            : i === 2
              ? ui.getEmoji("badge_bronze") || "🥉"
              : "🏅";
      let score = 0;
      if (isMath) score = u.minigame_mathScore;
      else if (isTrivia) score = u.minigame_triviaScore;
      else if (isDuel) score = u.minigame_duelScore;

      descString += `${medal} **#${i + 1}** | <@${u.userId}>\n> ${ui.getEmoji("trophy") || "🏆"} Skor: **${score.toLocaleString()}** Poin\n\n`;
    });

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#00FFFF",
      authorName: "Naura Minigames Hall of Fame",
      title,
      iconURL: interaction.client.user.displayAvatarURL(),
      description: descString,
      footerText: ui.getFooter("core"),
    });

    return interaction.editReply(payload);
  },
};
