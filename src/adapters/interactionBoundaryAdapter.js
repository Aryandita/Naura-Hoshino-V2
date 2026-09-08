// Lokasi: src/adapters/interactionBoundaryAdapter.js
// Implementasi Law 3: Keep external systems behind a boundary & Law 2: Name things by meaning
// Mengisolasi struktur raw Discord Interaction ke dalam domain model yang bersih.

"use strict";

const { ValidationError } = require("../errors/DomainError");

/**
 * Mengekstrak seluruh opsi CommandInteraction ke dalam Map/Object datar
 * @param {import('discord.js').CommandInteraction} interaction
 * @returns {Record<string, any>}
 */
function extractOptionsMap(interaction) {
  if (
    !interaction ||
    !interaction.options ||
    !Array.isArray(interaction.options.data)
  ) {
    return Object.freeze({});
  }

  const extracted = {};

  function traverseOptions(optionsList) {
    for (const opt of optionsList) {
      if (opt.type === 1 || opt.type === 2) {
        // Subcommand atau SubcommandGroup
        if (Array.isArray(opt.options)) {
          traverseOptions(opt.options);
        }
      } else if (typeof opt.name === "string") {
        extracted[opt.name] = opt.value;
      }
    }
  }

  traverseOptions(interaction.options.data);
  return Object.freeze(extracted);
}

/**
 * Mengekstrak field input dari ModalSubmitInteraction
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 * @returns {Record<string, string>}
 */
function extractModalFields(interaction) {
  if (
    !interaction ||
    !interaction.fields ||
    typeof interaction.fields.getTextInputValue !== "function"
  ) {
    return Object.freeze({});
  }

  const fieldsData = {};
  if (
    interaction.fields.fields &&
    typeof interaction.fields.fields.forEach === "function"
  ) {
    interaction.fields.fields.forEach((component, customId) => {
      try {
        fieldsData[customId] = interaction.fields.getTextInputValue(customId);
      } catch {
        // Abaikan jika bukan text input
      }
    });
  }

  return Object.freeze(fieldsData);
}

/**
 * Mengurai string customId menjadi komponen terstruktur (format prefix:action:targetId)
 * @param {string} customId
 * @param {string} [delimiter=":"]
 * @returns {{ prefix: string, action: string, targetId: string, tokens: string[] }}
 */
function parseCustomId(customId, delimiter = ":") {
  if (!customId || typeof customId !== "string") {
    return Object.freeze({ prefix: "", action: "", targetId: "", tokens: [] });
  }

  const tokens = customId.split(delimiter);
  return Object.freeze({
    prefix: tokens[0] || "",
    action: tokens[1] || "",
    targetId: tokens.slice(2).join(delimiter) || "",
    tokens,
  });
}

/**
 * Menormalisasi payload Discord Interaction ke boundary domain object
 * @param {any} rawInteraction
 * @returns {Record<string, any>}
 */
function extractInteractionBoundary(rawInteraction) {
  if (!rawInteraction || typeof rawInteraction !== "object") {
    throw new ValidationError("Interaction tidak valid atau bernilai null.", {
      rawInteraction,
    });
  }

  const interactionUser = rawInteraction.user || rawInteraction.member?.user;
  const userId = interactionUser?.id || null;
  const username = interactionUser?.username || "UnknownUser";
  const displayName =
    rawInteraction.member?.displayName ||
    interactionUser?.globalName ||
    username;
  const guildId = rawInteraction.guildId || rawInteraction.guild?.id || null;
  const channelId =
    rawInteraction.channelId || rawInteraction.channel?.id || null;

  let subcommandName = null;
  if (
    rawInteraction.options &&
    typeof rawInteraction.options.getSubcommand === "function"
  ) {
    try {
      subcommandName = rawInteraction.options.getSubcommand(false) || null;
    } catch {
      subcommandName = null;
    }
  }

  const selectedValues = Array.isArray(rawInteraction.values)
    ? Object.freeze([...rawInteraction.values])
    : Object.freeze([]);

  return Object.freeze({
    interactionId: rawInteraction.id,
    interactionType: rawInteraction.type,
    userId,
    username,
    displayName,
    guildId,
    channelId,
    isGuildContext: Boolean(guildId),
    commandName: rawInteraction.commandName || null,
    subcommandName,
    customId: rawInteraction.customId || null,
    selectedValues,
    modalFields: extractModalFields(rawInteraction),
    options: extractOptionsMap(rawInteraction),
  });
}

/**
 * Memastikan interaksi dijalankan di konteks server (guild)
 * @param {ReturnType<typeof extractInteractionBoundary>} boundary
 * @throws {ValidationError}
 */
function ensureGuildContext(boundary) {
  if (!boundary || !boundary.isGuildContext) {
    throw new ValidationError(
      "Perintah ini hanya dapat dijalankan di dalam server Discord.",
      {
        interactionId: boundary?.interactionId,
        userId: boundary?.userId,
      },
    );
  }
}

module.exports = {
  extractInteractionBoundary,
  extractOptionsMap,
  extractModalFields,
  parseCustomId,
  ensureGuildContext,
};
