"use strict";

const google = require("googlethis");

const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const MAX_RESULTS = 3;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

module.exports = async function search(interaction) {
  const query = interaction.options.getString("kueri");
  const hasil = await google.search(query, { safe: false });
  const results = hasil.results || [];

  let description;
  if (results.length > 0) {
    const lines = results
      .slice(0, MAX_RESULTS)
      .map(
        (res, index) =>
          `**${index + 1}. [${res.title}](${res.url})**\n> ${res.description}`,
      );
    description = `Naura sudah keliling internet sebentar, ini yang Naura temukan buat kamu!\n\n${lines.join("\n\n")}`;
  } else {
    description = `${e("akward", "\uD83D\uDE22")} Aduh, Naura nggak menemukan apa pun soal itu. Coba pakai kata kunci yang lain, yaa?`;
  }

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura Search Protocol",
    title: `${e("read", "\uD83D\uDD0D")} Hasil pencarian: ${query}`,
    iconURL: interaction.client.user.displayAvatarURL(),
    description,
    footerText: `Naura Search Protocol \u2022 Diminta oleh ${interaction.user.username}`,
  });

  return interaction.editReply(payload);
};
