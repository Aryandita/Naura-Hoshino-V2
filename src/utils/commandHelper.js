"use strict";

const { ComponentType, MessageFlags } = require("discord.js");
const ui = require("../config/ui");
const {
  buildLoadingContainerV2,
  buildErrorContainerV2,
  disableContainerV2,
} = require("./NauraContainerBuilder");
const telemetryMetrics = require("../services/telemetryMetrics");

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {object} opts
 * @param {string} opts.authorName
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} [opts.expression]
 * @param {string} [opts.footerText]
 */
async function sendLoadingState(interaction, opts) {
  const payload = buildLoadingContainerV2({
    interaction,
    authorName: opts.authorName,
    title: opts.title,
    description: opts.description,
    expression: opts.expression || "thinking",
    withBanner: true,
    footerText: opts.footerText || ui.getFooter("utility"),
  });
  await interaction.deferReply();
  await interaction.editReply(payload);
}

/**
 * @param {import('discord.js').Message} message
 * @param {string} ownerId
 * @param {Array} results
 * @param {Function} buildPayloadFn
 * @param {object} [opts]
 * @param {number} [opts.timeout]
 * @param {string} [opts.prevId]
 * @param {string} [opts.nextId]
 */
function createPaginationCollector(message, ownerId, results, buildPayloadFn, opts = {}) {
  let currentIndex = 0;
  const timeout = opts.timeout || 120000;
  const prevId = opts.prevId || "page_prev";
  const nextId = opts.nextId || "page_next";

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeout,
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== ownerId) {
      return i.reply({
        content: `${ui.getEmoji("cross") || "❌"} Perintah ini dibuat oleh orang lain. Gunakan command sendiri!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (i.customId === prevId) {
      currentIndex = Math.max(0, currentIndex - 1);
    } else if (i.customId === nextId) {
      currentIndex = Math.min(results.length - 1, currentIndex + 1);
    }

    await i.update(buildPayloadFn(currentIndex));
  });

  collector.on("end", (_collected, reason) => {
    if (reason === "time") {
      const disabledPayload = disableContainerV2(buildPayloadFn(currentIndex));
      message.edit(disabledPayload).catch(() => {});
    }
  });

  return collector;
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} commandName
 * @param {Error} error
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.description]
 * @param {string} [opts.expression]
 */
async function sendCommandError(interaction, commandName, error, opts = {}) {
  const isCircuitOpen = error.name === "CircuitBreakerOpenError" || 
                        error.constructor?.name === "CircuitBreakerOpenError";
  const isRateLimit = error.message?.includes("429") || error.message?.includes("rate");
  const isTimeout = error.message?.includes("timeout") || error.message?.includes("ETIMEDOUT");

  let title, description, expression;

  if (isCircuitOpen) {
    title = opts.circuitTitle || "Server Sedang Istirahat";
    description = opts.circuitDesc || `${ui.getEmoji("naura_sleepy") || "😴"} Server database sedang terlalu sibuk. Coba lagi dalam 1-2 menit ya, Naura tungguin!`;
    expression = "sleepy";
  } else if (isRateLimit) {
    title = opts.rateLimitTitle || "Terlalu Banyak Permintaan";
    description = opts.rateLimitDesc || `${ui.getEmoji("naura_sleepy") || "😴"} Server membatasi akses karena terlalu banyak permintaan. Tunggu sebentar lalu coba lagi ya!`;
    expression = "sleepy";
  } else if (isTimeout) {
    title = opts.timeoutTitle || "Koneksi Terputus";
    description = opts.timeoutDesc || `${ui.getEmoji("naura_cry") || "😢"} Koneksi ke server terputus karena waktu habis. Jaringan mungkin sedang tidak stabil.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba lagi beberapa saat lagi!*`;
    expression = "cry";
  } else {
    title = opts.title || "Terjadi Kesalahan";
    description = opts.description || `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, terjadi kesalahan saat memproses permintaan.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba lagi nanti, ya!*`;
    expression = opts.expression || "cry";
  }

  telemetryMetrics.incrementCommandError(commandName, error.message);

  const errPayload = buildErrorContainerV2({
    interaction,
    title,
    description,
    expression,
    withBanner: true,
    footerText: ui.getFooter("utility"),
  });

  await interaction.editReply(errPayload);
}

/**
 * @param {Function[]} fetchFns
 * @returns {Promise<any>}
 */
async function raceFetch(fetchFns) {
  const promises = fetchFns.map(fn => 
    fn().then(result => {
      if (!result || (Array.isArray(result) && result.length === 0)) {
        throw new Error("No results");
      }
      return result;
    })
  );

  try {
    return await Promise.any(promises);
  } catch {
    return null;
  }
}

/**
 * @param {Function} fn
 * @param {number} maxRetries
 * @param {number} baseDelayMs
 */
async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.status === 429 || 
                          error.response?.status === 429 ||
                          error.message?.includes("429");
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * baseDelayMs;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (attempt === maxRetries - 1) throw error;
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  sendLoadingState,
  createPaginationCollector,
  sendCommandError,
  raceFetch,
  withRetry,
  sleep,
};
