"use strict";

const { MessageFlags } = require("discord.js");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");

const SUBCOMMAND_LOADERS = {
  // Pengumpulan & Sumber Daya Alam
  chop: () => require("../../../plugin/survival/subcommands/chop"),
  mine: () => require("../../../plugin/survival/subcommands/mine"),
  fish: () => require("../../../plugin/survival/subcommands/fish"),
  gather: () => require("../../../plugin/survival/subcommands/collect"),
  collect: () => require("../../../plugin/survival/subcommands/collect"),
  farm: () => require("../../../plugin/survival/subcommands/farm"),

  // Kerajinan & Penempaan
  craft: () => require("../../../plugin/survival/subcommands/craft"),
  forge: () => require("../../../plugin/survival/subcommands/forge"),
  enchant: () => require("../../../plugin/survival/subcommands/enchant"),

  // Pertarungan & Penjelajahan
  dungeon: () => require("../../../plugin/survival/subcommands/dungeon"),
  abyss: () => require("../../../plugin/survival/subcommands/abyss"),
  arena: () => require("../../../plugin/survival/subcommands/arena"),
  duel: () => require("../../../plugin/survival/subcommands/duel"),
  raid: () => require("../../../plugin/survival/subcommands/raid"),

  // Vitalitas & Pemulihan
  consume: () => require("../../../plugin/survival/subcommands/consume"),
  rest: () => require("../../../plugin/survival/subcommands/rest"),
  cafe: () => require("../../../plugin/survival/subcommands/cafe"),

  // Desa, Sosial & Navigasi
  town: () => require("../../../plugin/survival/subcommands/town"),
  travel: () => require("../../../plugin/survival/subcommands/travel"),
  npc: () => require("../../../plugin/survival/subcommands/npc"),
  date: () => require("../../../plugin/survival/subcommands/date"),

  // Ekonomi & Perdagangan
  shop: () => require("../../../plugin/survival/subcommands/shop"),
  market: () => require("../../../plugin/survival/subcommands/market"),
  bank: () => require("../../../plugin/survival/subcommands/bank"),
  wallet: () => require("../../../plugin/survival/subcommands/wallet"),
  work: () => require("../../../plugin/survival/subcommands/work"),

  // Profil & Perkembangan RPG
  inventory: () => require("../../../plugin/survival/subcommands/inventory"),
  info: () => require("../../../plugin/survival/subcommands/info"),
  skill: () => require("../../../plugin/survival/subcommands/skill"),
  pass: () => require("../../../plugin/survival/subcommands/pass"),
  pet: () => require("../../../plugin/survival/subcommands/pet"),
};

/**
 * Handler bersama untuk tombol aksi petualangan dan profil Naura Wilds.
 */
async function handleSurvivalAction(interaction, prefix) {
  const rawId = interaction.customId;
  const [actionPart, ownerId] = rawId.split(":");
  const action = actionPart.replace(prefix, "").trim().toLowerCase();

  // Guard kepemilikan sesi (Anti-Hijack) dengan nada khas Naura
  if (ownerId && ownerId !== interaction.user.id) {
    return interaction.followUp({
      ...buildErrorContainerV2({
        authorName: "Naura Survival Guard",
        title: "Eh, Ini Milik Petualang Lain!",
        errorMessage:
          "Jangan usil ya! Tombol ini tersambung ke tas dan langkah petualang milik temanmu. Ketik perintah **/survival** untuk membuka petualanganmu sendiri, Naura siap temani kamu kok!",
        lang: interaction.localeLang,
        expression: "denied",
      }),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  }

  const loader = SUBCOMMAND_LOADERS[action];
  if (!loader) {
    logger.warn(`[SURVIVAL CTA] Aksi tidak dikenal: ${action}`);
    return interaction.followUp({
      ...buildErrorContainerV2({
        authorName: "Peta Petualangan Naura",
        title: "Langkah Belum Terbuka",
        errorMessage:
          "Naura belum menemukan jalan untuk aksi ini di peta. Coba pilih menu lain atau buka **/survival** ya!",
        lang: interaction.localeLang,
        expression: "confused",
      }),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  }

  try {
    const subModule = loader();
    if (typeof subModule.execute !== "function") {
      throw new Error(`Modul sub-perintah ${action} tidak memiliki fungsi execute`);
    }
    return await subModule.execute(interaction);
  } catch (err) {
    logger.error(`[SURVIVAL CTA ERROR] Gagal mengeksekusi ${action}:`, err);
    return interaction.followUp({
      ...buildErrorContainerV2({
        authorName: "Naura Penyelamat",
        title: `${ui.getEmoji("naura_cry") || "😭"} Langkahmu Terantuk Batu!`,
        errorMessage:
          "Aduh, ada sedikit kendala saat memuat aksi ini. Jangan cemas, coba klik sekali lagi atau panggil Naura lewat **/survival** ya!",
        lang: interaction.localeLang,
        expression: "cry",
      }),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  }
}

module.exports = [
  {
    prefix: "info_cta_",
    label: "survival-profile-cta",
    defer: "update",
    async handler(interaction) {
      return handleSurvivalAction(interaction, "info_cta_");
    },
  },
  {
    prefix: "survival_act_",
    label: "survival-action-cta",
    defer: "update",
    async handler(interaction) {
      return handleSurvivalAction(interaction, "survival_act_");
    },
  },
];
