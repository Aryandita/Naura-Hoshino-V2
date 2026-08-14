"use strict";

const translate = require("@iamtraction/google-translate");

const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

module.exports = async function translateText(interaction) {
  const teks = interaction.options.getString("teks");
  const targetLang = interaction.options.getString("ke_bahasa").toLowerCase();

  const hasil = await translate(teks, { to: targetLang });

  const description = [
    `Sudah Naura terjemahkan ke **${targetLang.toUpperCase()}**, semoga pas yaa!`,
    "",
    `**${e("read", "\uD83D\uDCDD")} Teks asli:**`,
    "```",
    teks,
    "```",
    "",
    `**${e("cheers", "\u2705")} Hasil terjemahan:**`,
    "```",
    hasil.text,
    "```",
  ].join("\n");

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura Global Translator",
    title: `${e("read", "\uD83C\uDF10")} Terjemahan selesai`,
    iconURL: interaction.client.user.displayAvatarURL(),
    description,
    footerText: `Powered by Advanced Neural Translation \u2022 Diminta oleh ${interaction.user.username}`,
  });

  return interaction.editReply(payload);
};
