"use strict";

/**
 * Router interaksi Discord.
 * Mengimplementasikan:
 * - Law 1: Keep the main path easy to follow (Guard Clauses / Flat flow)
 * - Law 2: Name things by meaning (Intent-revealing Domain Naming)
 * - Law 6: Make errors useful (Dukungan DomainError)
 * - Law 7: Keep changes focused (Routing murni, delegasi ke safeExecute)
 */

const { Events, MessageFlags } = require("discord.js");
const { logger } = require("../managers/logger");
const languageManager = require("../managers/languageManager");
const rateLimiter = require("../utils/rateLimiter");
const registry = require("../interactions/registry");
const handleAutocomplete = require("../interactions/autocomplete");
const { safeExecute, respondError } = require("../interactions/safeExecute");
const { isDomainError } = require("../errors/DomainError");
const {
  buildErrorContainerV2,
  buildMaintenanceContainerV2,
} = require("../utils/NauraContainerBuilder");
const env = require("../config/env");
const {
  isGlobalMaintenanceActive,
  getGlobalMaintenance,
  isModuleKilled,
} = require("../services/incidentService");

// Batas laju perintah slash
const SLASH_LIMIT = Object.freeze({ max: 5, seconds: 5 });

// Batas laju komponen default
const COMPONENT_LIMIT = Object.freeze({ max: 8, seconds: 5 });

/**
 * Mendeteksi jenis interaksi berbasis komponen
 * @param {import('discord.js').Interaction} interaction
 * @returns {'buttons'|'modals'|'selects'|null}
 */
function resolveComponentKind(interaction) {
  if (interaction.isButton()) return "buttons";
  if (interaction.isModalSubmit()) return "modals";
  if (interaction.isAnySelectMenu()) return "selects";
  return null;
}

function translateText(lang, key, placeholders) {
  return languageManager.translateSync(lang, key, placeholders);
}

/**
 * Memastikan flag IsComponentsV2 tetap terpasang bersama Ephemeral
 * agar Discord API tidak menolak payload Container V2.
 */
function withEphemeralFlags(payload) {
  return {
    ...payload,
    flags:
      (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral,
  };
}

/**
 * Menangani routing Slash Command (ChatInputCommand)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleSlashCommand(interaction, client) {
  const targetCommand = client.commands.get(interaction.commandName);
  // Guard Clause: Command tidak terdaftar
  if (!targetCommand) return undefined;

  const isOwnerUser = Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(interaction.user.id);

  // Guard Clause: Pemeliharaan Darurat Global (Bypass khusus Owner)
  if (isGlobalMaintenanceActive() && !isOwnerUser) {
    let maintInfo;
    try {
      maintInfo = await getGlobalMaintenance();
    } catch (error) {
      logger.error(
        "[INTERAKSI] Gagal mengambil informasi pemeliharaan global:",
        error,
      );
      maintInfo = { reason: "Pemeliharaan sistem sedang berlangsung." };
    }
    return interaction
      .reply(
        withEphemeralFlags(
          buildMaintenanceContainerV2({
            title: "Pemeliharaan Sistem Terpadu",
            reason:
              maintInfo.reason ||
              "Pembaruan arsitektur dan penanganan keamanan berkala",
            lang: interaction.localeLang,
          }),
        ),
      )
      .catch(() => {});
  }

  // Guard Clause: Module Kill-Switch Darurat (Bypass khusus Owner)
  if (isModuleKilled(interaction.commandName) && !isOwnerUser) {
    return interaction
      .reply(
        withEphemeralFlags(
          buildErrorContainerV2({
            authorName: "Naura Incident Guard",
            title: "Modul Dinonaktifkan Sementara",
            errorMessage: `Perintah **/${interaction.commandName}** sedang dinonaktifkan sementara oleh pengembang untuk investigasi kendala teknis.`,
            lang: interaction.localeLang,
            expression: "denied",
          }),
        ),
      )
      .catch(() => {});
  }

  // Guard Clause: Rate limit per pengguna
  let isCommandRateLimited = false;
  try {
    isCommandRateLimited = await rateLimiter.isRateLimited(
      interaction.user.id,
      `slash_${interaction.commandName}`,
      SLASH_LIMIT.max,
      SLASH_LIMIT.seconds,
    );
  } catch (error) {
    logger.error(
      "[INTERAKSI] Gagal mengecek rate limit perintah:",
      error,
    );
  }

  if (isCommandRateLimited) {
    return interaction
      .reply({
        ...buildErrorContainerV2({
          authorName: "Naura Rate Limit",
          title: "Slow Down!",
          errorMessage:
            "Kamu mengirim perintah terlalu cepat. Harap tunggu beberapa detik ya!",
          lang: interaction.localeLang,
          expression: "sleepy",
        }),
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }

  // Guard Clause: Periksa apakah fitur terkait dinonaktifkan di server
  const {
    COMMAND_FEATURE_MAP,
    isFeatureEnabled,
  } = require("../config/features");
  const featureId = COMMAND_FEATURE_MAP[interaction.commandName];
  if (featureId && interaction.guildId) {
    let isModuleEnabled = true;
    try {
      isModuleEnabled = await isFeatureEnabled(
        interaction.guildId,
        featureId,
      );
    } catch (error) {
      logger.error(
        "[INTERAKSI] Gagal mengecek status fitur command:",
        error,
      );
    }
    if (!isModuleEnabled) {
      return interaction
        .reply(
          withEphemeralFlags(
            buildErrorContainerV2({
              authorName: "Naura Feature Guard",
              title: "Fitur Dinonaktifkan",
              errorMessage: `Command ini adalah bagian dari modul **${featureId}**, yang saat ini dimatikan oleh Admin server.`,
              lang: interaction.localeLang,
              expression: "denied",
            }),
          ),
        )
        .catch(() => {});
    }
  }

  try {
    // Metrik: Catat penggunaan command di Redis Hash tanpa memblokir
    try {
      const metricsManager = require("../managers/metricsManager");
      metricsManager.logCommand(interaction.commandName);
      const trafficMonitor = require("../managers/trafficMonitor");
      trafficMonitor.recordCommand(interaction.commandName, interaction.user.id);
    } catch (err) {
      if (err?.code && [10008, 40060, 50027, 50013, 50007, 10062].includes(err.code)) {
        // Intentional: Abaikan error siklus interaksi / izin Discord yang sudah diketahui
      } else {
        logger.debug("[interactionCreate:handleSlashCommand] Interaksi Discord lifecycle gagal: " + (err?.message || err));
      }
    }

    await targetCommand.execute(interaction, client);
  } catch (error) {
    if (isDomainError(error)) {
      logger.warn(
        `[COMMAND DOMAIN ERROR] /${interaction.commandName}: [${error.code}] ${error.message}`,
        error.context,
      );
      await respondError(interaction, error.userMessage);
      return undefined;
    }

    logger.error(
      `[COMMAND ERROR] Galat saat mengeksekusi /${interaction.commandName}:`,
      error,
    );
    await respondError(
      interaction,
      "Terjadi kesalahan sistem saat memproses perintah ini.",
      "Terjadi kesalahan saat memproses perintah ini.",
    );
  }

  return undefined;
}

/**
 * Memasang wrapper defensif pada interaction.reply, interaction.update, interaction.editReply,
 * dan interaction.followUp agar:
 * 1. Otomatis dialihkan bila sudah di-defer atau terbalas (mencegah InteractionAlreadyReplied).
 * 2. Memastikan MessageFlags.IsComponentsV2 tidak hilang saat payload memiliki kontainer V2.
 * 3. Menyediakan options resolver cadangan yang aman untuk interaksi non-slash (button, select, modal).
 * @param {import('discord.js').Interaction} interaction
 * @returns {import('discord.js').Interaction}
 */
function wrapInteractionSafe(interaction) {
  if (!interaction) return interaction;

  // Polyfill options resolver cadangan agar pemanggilan get* tidak melempar TypeError
  if (!interaction.options) {
    interaction.options = {
      getString: () => null,
      getInteger: () => null,
      getNumber: () => null,
      getBoolean: () => null,
      getUser: () => null,
      getMember: () => null,
      getChannel: () => null,
      getRole: () => null,
      getMentionable: () => null,
      getAttachment: () => null,
      getSubcommand: () => null,
      getSubcommandGroup: () => null,
    };
  }

  function ensureComponentsV2Flags(options) {
    if (!options || typeof options !== "object") return options;
    const comps = options.components;
    if (Array.isArray(comps) && comps.length > 0) {
      const hasV2 = comps.some(
        (c) => c && (c.type === 17 || c.data?.type === 17 || (c.type !== 1 && c.data?.type !== 1)),
      );
      if (hasV2) {
        options.flags = (options.flags || 0) | MessageFlags.IsComponentsV2;
      }

      // Pastikan semua attachment:// yang dirujuk oleh accessory/media ada di options.files
      try {
        if (!options.files) options.files = [];
        const attachedNames = new Set(
          (Array.isArray(options.files) ? options.files : [])
            .map((f) => {
              if (!f) return "";
              if (typeof f === "string") return require("path").basename(f);
              return f.name || f.attachment?.name || "";
            })
            .filter(Boolean),
        );

        const nauraExpression = require("../utils/nauraExpression");

        const auditItem = (node) => {
          if (!node || typeof node !== "object") return;
          const url =
            node.accessory?.media?.url ||
            node.accessory?.data?.media?.url ||
            node.media?.url;
          if (typeof url === "string" && url.startsWith("attachment://")) {
            const fileName = url.slice("attachment://".length);
            if (!attachedNames.has(fileName)) {
              const mood = fileName
                .replace(/^naura_/i, "")
                .replace(/\.[^.]+$/, "");
              const expObj = nauraExpression.getAttachment(mood);
              if (expObj && expObj.attachment) {
                options.files.push(expObj.attachment);
                attachedNames.add(fileName);
              } else if (node.accessory) {
                delete node.accessory;
              }
            }
          }
          if (Array.isArray(node.components)) {
            for (const child of node.components) auditItem(child);
          }
        };

        for (const comp of comps) {
          auditItem(comp);
          if (comp.data) auditItem(comp.data);
        }
      } catch (_) {}
    }
    return options;
  }

  const originalReply = interaction.reply?.bind(interaction);
  const originalUpdate = interaction.update?.bind(interaction);
  const originalEditReply = interaction.editReply?.bind(interaction);
  const originalFollowUp = interaction.followUp?.bind(interaction);

  if (originalReply) {
    interaction.reply = async function (options) {
      options = ensureComponentsV2Flags(options);
      if (this.deferred && !this.replied && typeof this.editReply === "function") {
        return await this.editReply(options);
      }
      if (this.replied && typeof this.followUp === "function") {
        return await this.followUp(options);
      }
      return await originalReply(options);
    };
  }

  if (originalUpdate) {
    interaction.update = async function (options) {
      options = ensureComponentsV2Flags(options);
      if ((this.deferred || this.replied) && typeof this.editReply === "function") {
        return await this.editReply(options);
      }
      return await originalUpdate(options);
    };
  }

  if (originalEditReply) {
    interaction.editReply = async function (options) {
      options = ensureComponentsV2Flags(options);
      if (!this.deferred && !this.replied && typeof this.reply === "function") {
        return await this.reply(options);
      }
      return await originalEditReply(options);
    };
  }

  if (originalFollowUp) {
    interaction.followUp = async function (options) {
      options = ensureComponentsV2Flags(options);
      return await originalFollowUp(options);
    };
  }

  return interaction;
}

/**
 * Memasang guard auto-deferral defensif 2.2 detik untuk mencegah error 10062 (Interaction Not Acknowledged).
 * @param {import('discord.js').Interaction} interaction
 * @param {number} [timeoutMs=2200]
 * @returns {() => void} Fungsi pembersih timer
 */
function attachAutoAcknowledgeGuard(interaction, timeoutMs = 2200) {
  if (
    !interaction ||
    typeof interaction.deferReply !== "function" ||
    (typeof interaction.isAutocomplete === "function" && interaction.isAutocomplete())
  ) {
    return () => {};
  }

  const timer = setTimeout(async () => {
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
    } catch (err) {
      if (err?.code && [10008, 40060, 50027, 50013, 50007, 10062].includes(err.code)) {
        // Intentional: Abaikan error siklus interaksi / izin Discord yang sudah diketahui
      } else {
        logger.debug("[interactionCreate:attachAutoAcknowledgeGuard] Interaksi Discord lifecycle gagal: " + (err?.message || err));
      }
    }
  }, timeoutMs);

  return () => clearTimeout(timer);
}

module.exports = {
  name: Events.InteractionCreate,
  attachAutoAcknowledgeGuard,
  wrapInteractionSafe,

  async execute(interaction, client) {
    // Guard Clause 1: Autocomplete didahulukan tanpa delay (batas keras 3 detik)
    if (interaction.isAutocomplete()) {
      return handleAutocomplete(interaction, client).catch((error) => {
        logger.error("[INTERAKSI] Galat pada autocomplete:", error);
      });
    }

    wrapInteractionSafe(interaction);

    const cleanupGuard = attachAutoAcknowledgeGuard(interaction);

    try {
      // Resolusi bahasa pengguna
      interaction.localeLang = await languageManager
        .getUserLanguage(interaction.user.id, interaction.guildId)
        .catch(() => "id");

      // Guard Clause 2: Bot sedang dalam proses shutdown/maintenance
      const isOwnerUser = env.OWNER_IDS && env.OWNER_IDS.includes(interaction.user.id);
      if (client.isShuttingDown || (client.isMaintenance && !isOwnerUser)) {
        const msg = client.isShuttingDown
          ? "Naura sedang dalam proses shutdown / restart server. Mohon tunggu beberapa saat ya!"
          : (client.maintenanceReason || "Naura sedang dalam mode pemeliharaan sistem. Hanya Developer yang dapat berinteraksi saat ini.");
        return interaction
          .reply(
            withEphemeralFlags(
              buildMaintenanceContainerV2({
                authorName: "Naura System Status",
                title: client.isShuttingDown ? "Sedang Restart / Shutdown" : "Mode Pemeliharaan Sistem",
                maintenanceMessage: msg,
                lang: interaction.localeLang,
                withBanner: true,
              }),
            ),
          )
          .catch(() => {});
      }

      // Guard Clause 3: Delegasi Slash Command
      if (interaction.isChatInputCommand()) {
        return await handleSlashCommand(interaction, client);
      }

      // Guard Clause 4: Delegasi Context Menu Command
      if (interaction.isContextMenuCommand()) {
        let isContextRateLimited = false;
        try {
          isContextRateLimited = await rateLimiter.isRateLimited(
            interaction.user.id,
            `ctx_${interaction.commandName}`,
            4,
            10,
          );
        } catch (error) {
          logger.error(
            "[INTERAKSI] Gagal mengecek rate limit context menu:",
            error,
          );
        }
        if (isContextRateLimited) {
          return interaction
            .reply(
              withEphemeralFlags(
                buildErrorContainerV2({
                  authorName: "Naura Rate Limit",
                  title: "Slow Down!",
                  errorMessage:
                    "Kamu menggunakan context menu terlalu cepat. Harap tunggu beberapa detik ya!",
                  lang: interaction.localeLang,
                  expression: "sleepy",
                }),
              ),
            )
            .catch(() => {});
        }

        const { resolveContextMenu } = require("../interactions/contextMenus");
        const contextMenuHandler = resolveContextMenu(interaction.commandName);
        if (!contextMenuHandler) return undefined;

        try {
          return await contextMenuHandler.execute(interaction, client);
        } catch (error) {
          logger.error(
            `[CONTEXT MENU ERROR] Galat saat mengeksekusi ${interaction.commandName}:`,
            error,
          );
          return await respondError(
            interaction,
            "Terjadi kesalahan saat memproses context menu ini.",
          );
        }
      }

      // Resolusi tipe interaksi komponen (button, modal, select)
      const componentKind = resolveComponentKind(interaction);

      // Guard Clause 5: Bukan komponen yang didukung
      if (!componentKind) return undefined;

      const registeredComponentHandler = registry.resolve(
        componentKind,
        interaction.customId,
      );

      // Guard Clause 6: Komponen tanpa handler di registry permanen
      // Beri kesempatan kolektor lokal (message collector) untuk merespons (misal deferUpdate/reply).
      // Bila setelah 2.65 detik belum ditanggapi (kolektor kedaluwarsa, bot restart, atau pesan lama),
      // kirim balasan ramah stale_component agar interaksi tidak berakhir timeout di Discord (batas keras 3 detik).
      if (!registeredComponentHandler) {
        setTimeout(async () => {
          if (!interaction.deferred && !interaction.replied) {
            logger.warn(
              `[INTERAKSI EXPIRED] Komponen tidak ditanggapi penangan aktif: ${componentKind}:${interaction.customId}`,
            );
            await interaction
              .reply(
                withEphemeralFlags(
                  buildErrorContainerV2({
                    lang: interaction.localeLang,
                    title: translateText(
                      interaction.localeLang,
                      "interaction.stale_component.title",
                    ),
                    errorMessage: translateText(
                      interaction.localeLang,
                      "interaction.stale_component.body",
                    ),
                    expressionImage: false,
                  }),
                ),
              )
              .catch(() => {});
          }
        }, 2650);
        return undefined;
      }

      // Guard Clause 7: Rate limit komponen tombol/select/modal
      const componentRateLimitPolicy =
        registeredComponentHandler.cooldown || COMPONENT_LIMIT;
      let isComponentRateLimited = false;
      try {
        isComponentRateLimited = await rateLimiter.isRateLimited(
          interaction.user.id,
          `component_${registeredComponentHandler.label}`,
          componentRateLimitPolicy.max,
          componentRateLimitPolicy.seconds,
        );
      } catch (error) {
        logger.error(
          "[INTERAKSI] Gagal mengecek rate limit komponen:",
          error,
        );
      }

      if (isComponentRateLimited) {
        return interaction
          .reply(
            withEphemeralFlags(
              buildErrorContainerV2({
                authorName: "Naura Action Guard",
                title: "Pelan-Pelan Ya!",
                errorMessage:
                  "Kamu menekan tombol terlalu cepat. Harap berikan jeda sebentar ya!",
                lang: interaction.localeLang,
                expression: "sleepy",
              }),
            ),
          )
          .catch(() => {});
      }

      // Jalur Utama (Happy Path): Eksekusi melalui wrapper safeExecute
      return await safeExecute(interaction, registeredComponentHandler, client);
    } catch (error) {
      logger.error(
        "[INTERAKSI CREATE] Galat tak tertangani pada interaksi:",
        error,
      );
      try {
        await respondError(
          interaction,
          "Terjadi kesalahan sistem saat memproses interaksi ini.",
        );
      } catch (respondErr) {
        logger.debug(
          "[INTERAKSI CREATE] Tidak dapat mengirim balasan galat: " +
            (respondErr?.message || respondErr),
        );
      }
    } finally {
      cleanupGuard();
    }
  },
};
