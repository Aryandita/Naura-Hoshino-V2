"use strict";

// Fungsi bantu UI murni. Semua fungsi di sini tidak bergantung pada `this`,
// sehingga bisa diuji sendiri dan dipakai ulang di luar src/config/ui.js.

const fs = require("fs");
const path = require("path");
const { logger } = require("../../managers/logger");

const PERIODS = [
  { until: 5, name: "malam" },
  { until: 11, name: "pagi" },
  { until: 15, name: "siang" },
  { until: 18, name: "sore" },
];

const LOCATION_BG = {
  hutan: "hutan",
  tambang: "tambang",
  laut: "laut",
  kota: "kota",
  city: "kota",
  academy: "academy",
  park: "park",
  village: "desa",
  desa: "desa",
  jalanan: "desa",
};

// Kembalikan path bila berkasnya benar-benar ada, kalau tidak null.
function existingPath(target) {
  if (!target) return null;
  try {
    return fs.existsSync(target) ? target : null;
  } catch (e) {
    return null;
  }
}

// Bersihkan emoji kustom Discord dari judul dan footer.
function stripCustomEmojis(text) {
  if (!text) return "";
  return String(text)
    .replace(/<a?:\w+:\d+>/g, "")
    .trim();
}

// Ubah kode emoji menjadi objek yang bisa dipakai tombol dan select menu.
// Select menu Discord menolak emoji berbentuk teks, jadi bentuk objek ini wajib.
function parseEmoji(emojiStr) {
  if (!emojiStr) return null;
  const customMatch = String(emojiStr).match(/<(a)?:(\w+):(\d+)>/);
  if (customMatch) {
    return {
      animated: Boolean(customMatch[1]),
      name: customMatch[2],
      id: customMatch[3],
    };
  }
  return { name: emojiStr };
}

// Teks dua bahasa berdampingan, dipakai saat bahasa pengguna belum diketahui.
function hybrid(idText, enText) {
  if (!idText) return enText || "";
  if (!enText) return idText || "";
  return idText + " / " + enText;
}

// Pilih bahasa berdasarkan pilihan pengguna, dengan locale Discord sebagai cadangan.
function getLangText(interaction, idText, enText) {
  if (!interaction) return hybrid(idText, enText);

  let preferredLang = interaction.lang || null;
  if (!preferredLang) {
    const locale = interaction.locale || interaction.guildLocale || "";
    preferredLang = String(locale).startsWith("en") ? "en" : "id";
  }

  return preferredLang === "en" ? enText || idText : idText || enText;
}

// Bilah kemajuan berbasis emoji.
function progressBar(current, max, length, filledEmoji, emptyEmoji) {
  const span = Number(length) > 0 ? Number(length) : 10;
  const safeMax = Number(max) > 0 ? Number(max) : 1;
  const percent = Math.min(Math.max(Number(current) / safeMax, 0), 1);
  const filledLength = Math.round(span * percent);
  return (
    filledEmoji.repeat(filledLength) + emptyEmoji.repeat(span - filledLength)
  );
}

// Tentukan kunci latar survival dari lokasi dan jam dalam game.
function survivalBackgroundKey(lokasi, hour) {
  const loc = String(lokasi || "village").toLowerCase();
  const base = LOCATION_BG[loc] || "desa";

  let period = "siang";
  if (hour !== undefined && hour !== null) {
    const h = Number(hour);
    if (h >= 18 || h < 5) period = "malam";
    else {
      const found = PERIODS.find((p) => h < p.until);
      period = found ? found.name : "sore";
    }
  }

  return { key: base + "_" + period, fallbackKey: base + "_siang" };
}

// Path potret karakter NPC di assets/survival/characters.
function characterImagePath(imageFileName) {
  if (!imageFileName) return null;
  const charPath = path.join(
    __dirname,
    "../../../assets/survival/characters",
    imageFileName,
  );
  return existingPath(charPath);
}

const { MessageFlags } = require("discord.js");

// Pengirim pesan error standar (Components V2).
// Payload sudah membawa `files` sendiri termasuk wajah Naura, jadi jangan
// pernah dikosongkan paksa atau gambarnya tidak akan terkirim.
async function sendError(
  interaction,
  errorMessage,
  ephemeral = false,
  opts = {},
) {
  const {
    buildErrorContainerV2,
  } = require("../../utils/NauraContainerBuilder");
  const containerPayload = buildErrorContainerV2({
    errorMessage,
    lang: interaction?.localeLang || interaction?.lang || "id",
    withBanner: opts.withBanner !== undefined ? opts.withBanner : true,
    ...opts,
  });

  const finalFlags =
    (containerPayload.flags || MessageFlags.IsComponentsV2) |
    (ephemeral ? MessageFlags.Ephemeral : 0);

  try {
    let msg;
    if (interaction.deferred || interaction.replied) {
      msg = await interaction.editReply({
        ...containerPayload,
        flags: finalFlags,
      });
    } else if (typeof interaction.reply === "function") {
      msg = await interaction.reply({
        ...containerPayload,
        flags: finalFlags,
        fetchReply: !ephemeral,
      });
    } else if (typeof interaction.channel?.send === "function") {
      msg = await interaction.channel.send({
        ...containerPayload,
        flags: containerPayload.flags || MessageFlags.IsComponentsV2,
      });
    }

    if (!ephemeral && msg) {
      setTimeout(() => {
        if (interaction.deleteReply) {
          interaction.deleteReply().catch(() => {});
        } else if (msg.delete) {
          msg.delete().catch(() => {});
        }
      }, 15000);
    }

    return msg;
  } catch (e) {
    logger.error("[UI SendError]", e);
  }
}

// Pengirim pesan maintenance mode standar (Components V2).
async function sendMaintenance(
  interaction,
  maintenanceMessage,
  ephemeral = false,
  opts = {},
) {
  const {
    buildMaintenanceContainerV2,
  } = require("../../utils/NauraContainerBuilder");
  const containerPayload = buildMaintenanceContainerV2({
    maintenanceMessage,
    lang: interaction?.localeLang || interaction?.lang || "id",
    withBanner: opts.withBanner !== false,
    ...opts,
  });

  const finalFlags =
    (containerPayload.flags || MessageFlags.IsComponentsV2) |
    (ephemeral ? MessageFlags.Ephemeral : 0);

  try {
    let msg;
    if (interaction.deferred || interaction.replied) {
      msg = await interaction.editReply({
        ...containerPayload,
        flags: finalFlags,
      });
    } else if (typeof interaction.reply === "function") {
      msg = await interaction.reply({
        ...containerPayload,
        flags: finalFlags,
        fetchReply: !ephemeral,
      });
    } else if (typeof interaction.channel?.send === "function") {
      msg = await interaction.channel.send({
        ...containerPayload,
        flags: containerPayload.flags || MessageFlags.IsComponentsV2,
      });
    }

    return msg;
  } catch (e) {
    logger.error("[UI SendMaintenance]", e);
  }
}

// Pengirim pesan loading state standar (Components V2).
async function sendLoading(
  interaction,
  loadingMessage,
  ephemeral = false,
  opts = {},
) {
  const {
    buildLoadingContainerV2,
  } = require("../../utils/NauraContainerBuilder");
  const containerPayload = buildLoadingContainerV2({
    loadingMessage,
    lang: interaction?.localeLang || interaction?.lang || "id",
    withBanner: opts.withBanner !== undefined ? opts.withBanner : true,
    ...opts,
  });

  const finalFlags =
    (containerPayload.flags || MessageFlags.IsComponentsV2) |
    (ephemeral ? MessageFlags.Ephemeral : 0);

  try {
    let msg;
    if (interaction.deferred || interaction.replied) {
      msg = await interaction.editReply({
        ...containerPayload,
        flags: finalFlags,
      });
    } else if (typeof interaction.reply === "function") {
      msg = await interaction.reply({
        ...containerPayload,
        flags: finalFlags,
        fetchReply: !ephemeral,
      });
    } else if (typeof interaction.channel?.send === "function") {
      msg = await interaction.channel.send({
        ...containerPayload,
        flags: containerPayload.flags || MessageFlags.IsComponentsV2,
      });
    }

    return msg;
  } catch (e) {
    logger.error("[UI SendLoading]", e);
  }
}

module.exports = {
  existingPath,
  stripCustomEmojis,
  parseEmoji,
  hybrid,
  getLangText,
  progressBar,
  survivalBackgroundKey,
  characterImagePath,
  sendError,
  sendMaintenance,
  sendLoading,
  LOCATION_BG,
};
