"use strict";

const { MessageFlags } = require("discord.js");
const { logger } = require("../../managers/logger");
const languageManager = require("../../managers/languageManager");

function resolveComponentKind(interaction) {
  if (interaction.isButton()) return "buttons";
  if (interaction.isModalSubmit()) return "modals";
  if (interaction.isAnySelectMenu()) return "selects";
  return null;
}

function translateText(lang, key, placeholders) {
  return languageManager.translateSync(lang, key, placeholders);
}

function withEphemeralFlags(payload) {
  return {
    ...payload,
    flags:
      (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral,
  };
}

function wrapInteractionSafe(interaction) {
  if (!interaction) return interaction;
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
        (c) =>
          c &&
          (c.type === 17 ||
            c.data?.type === 17 ||
            (c.type !== 1 && c.data?.type !== 1)),
      );
      if (hasV2) {
        options.flags = (options.flags || 0) | MessageFlags.IsComponentsV2;
      }
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
        const nauraExpression = require("../../utils/nauraExpression");
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
      if (
        this.deferred &&
        !this.replied &&
        typeof this.editReply === "function"
      ) {
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
      if (
        (this.deferred || this.replied) &&
        typeof this.editReply === "function"
      ) {
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

function attachAutoAcknowledgeGuard(interaction, timeoutMs = 2200) {
  if (
    !interaction ||
    typeof interaction.deferReply !== "function" ||
    (typeof interaction.isAutocomplete === "function" &&
      interaction.isAutocomplete())
  ) {
    return () => {};
  }
  const timer = setTimeout(async () => {
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
    } catch (err) {
      if (
        err?.code &&
        [10008, 40060, 50027, 50013, 50007, 10062].includes(err.code)
      ) {
        // Intentional: abaikan error lifecycle Discord tanpa balasan } else {
        logger.debug(
          "[interactionCreate:attachAutoAcknowledgeGuard] Interaksi Discord lifecycle gagal: " +
            (err?.message || err),
        );
      }
    }
  }, timeoutMs);
  return () => clearTimeout(timer);
}

module.exports = {
  resolveComponentKind,
  translateText,
  withEphemeralFlags,
  wrapInteractionSafe,
  attachAutoAcknowledgeGuard,
};
