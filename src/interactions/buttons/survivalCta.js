"use strict";

const fs = require("fs");
const path = require("path");
const { MessageFlags } = require("discord.js");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");
const ui = require("../../config/ui");
const { safeParseInventory } = require("../../survival/engines/inventoryHelper");
const {
  adaptSurvivalInteraction,
  stopMessageCollector,
} = require("../../survival/helpers/survivalContext");

const SUBCOMMANDS_DIR = path.join(
  __dirname,
  "../../../plugin/survival/subcommands",
);
const SUBCOMMAND_FILES = new Set(
  fs
    .readdirSync(SUBCOMMANDS_DIR)
    .filter((f) => f.endsWith(".js"))
    .map((f) => f.replace(".js", "").toLowerCase()),
);

const ALIAS_MAP = {
  gather: "collect",
  w: "work",
  f: "fish",
  m: "mine",
  c: "chop",
  i: "inventory",
  inv: "inventory",
  bag: "inventory",
  stat: "info",
  profile: "info",
  hunt: "dungeon",
  store: "shop",
  custom_dungeon: "customdungeon",
};

function resolveSubcommand(action) {
  const resolved = (ALIAS_MAP[action] || action).toLowerCase();
  for (const name of SUBCOMMAND_FILES) {
    if (name === resolved) {
      return require(path.join(SUBCOMMANDS_DIR, name));
    }
  }
  return null;
}

/**
 * Handler bersama untuk tombol aksi petualangan dan profil Naura Wilds.
 */
async function handleSurvivalAction(interaction, prefix) {
  const rawId = interaction.customId;
  const [actionPart, ownerId] = rawId.split(":");
  const actionRaw = actionPart.replace(prefix, "").trim().toLowerCase();
  const action = ALIAS_MAP[actionRaw] || actionRaw;

  // 1. Guard kepemilikan sesi (Anti-Hijack) dengan nada khas Naura
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

  // 2. Bersihkan collector lama dari pesan yang sedang diedit agar tidak menimpa UI baru
  if (interaction.message?.id) {
    stopMessageCollector(interaction.message.id, "navigated");
  }

  // 3. Adaptasi interaksi dengan adapter seragam
  adaptSurvivalInteraction(interaction, action);

  // 4. Pemeriksaan pendaftaran (starter kit) jika bukan aksi start
  if (action !== "start") {
    try {
      const profile = await cacheManager.getUserProfile(interaction.user.id);
      const inv = safeParseInventory(profile?.inventory);
      const hasStarted = inv.some(
        (item) => item && item.id === "survival_started",
      );

      if (!hasStarted) {
        const {
          renderOnboardingPrompt,
        } = require("../../survival/engines/playerOnboardingEngine");
        const onboardingPayload = renderOnboardingPrompt(
          interaction.user,
          interaction.localeLang,
        );
        return interaction.editReply(onboardingPayload);
      }
    } catch (onboardErr) {
      logger.warn("[SURVIVAL CTA ONBOARDING CHECK]", onboardErr.message);
    }
  }

  const subModule = resolveSubcommand(action);
  if (!subModule || typeof subModule.execute !== "function") {
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
    return await subModule.execute(interaction, interaction.client);
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
  {
    prefix: "dungeon_cta_",
    label: "survival-dungeon-cta",
    defer: "update",
    async handler(interaction) {
      return handleSurvivalAction(interaction, "dungeon_cta_");
    },
  },
  {
    prefix: "empty_cta_",
    label: "survival-empty-cta",
    defer: "update",
    async handler(interaction) {
      return handleSurvivalAction(interaction, "empty_cta_");
    },
  },
];
