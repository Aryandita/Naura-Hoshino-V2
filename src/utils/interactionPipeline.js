"use strict";

const { ComponentType, MessageFlags } = require("discord.js");
const { buildErrorContainerV2 } = require("./NauraContainerBuilder");
const { logger } = require("../managers/logger");
const ui = require("../config/ui");

/**
 * Registry kolektor pesan aktif global untuk mencegah kebocoran listener dan race condition.
 */
const activeCollectors = new Map();

/**
 * Daftarkan kolektor aktif untuk pesan tertentu.
 * Jika sudah ada kolektor sebelumnya pada pesan yang sama, hentikan dengan reason 'navigated'.
 * @param {string} messageId
 * @param {object} collector
 */
function registerCollector(messageId, collector) {
  if (!messageId || !collector) return;
  const existing = activeCollectors.get(messageId);
  if (existing && typeof existing.stop === "function") {
    try {
      existing.stop("navigated");
    } catch (_) {}
  }
  activeCollectors.set(messageId, collector);
}

/**
 * Hentikan kolektor aktif untuk pesan tertentu.
 * @param {string} messageId
 * @param {string} [reason="navigated"]
 */
function stopCollector(messageId, reason = "navigated") {
  if (!messageId) return;
  const collector = activeCollectors.get(messageId);
  if (collector && typeof collector.stop === "function") {
    try {
      collector.stop(reason);
    } catch (_) {}
  }
  activeCollectors.delete(messageId);
}

/**
 * Kolektor Komponen Terkelola (Managed Collector).
 * Mengurangi boilerplate duplikasi pembuat collector di subcommands.
 *
 * @param {object} message - Discord Message instance
 * @param {object} user - User yang berhak mengklik (opsional, jika null semua user boleh)
 * @param {object} options
 * @param {number} [options.time=60000] - Timeout dalam ms
 * @param {ComponentType} [options.componentType=ComponentType.Button]
 * @param {Function} [options.onCollect] - async (interaction, collector) => {}
 * @param {Function} [options.onEnd] - async (collected, reason) => {}
 * @param {string} [options.footerCategory="core"]
 * @param {string} [options.denyMessage]
 * @param {boolean} [options.autoDisableOnEnd=true]
 * @returns {object|null}
 */
function createManagedCollector(message, user, options = {}) {
  if (!message || typeof message.createMessageComponentCollector !== "function") {
    return null;
  }

  const {
    time = 60000,
    componentType = ComponentType.Button,
    onCollect,
    onEnd,
    footerCategory = "core",
    denyMessage = "Hanya pemanggil command yang dapat berinteraksi dengan tombol ini.",
    autoDisableOnEnd = true,
  } = options;

  const collector = message.createMessageComponentCollector({
    componentType,
    time,
  });

  registerCollector(message.id, collector);

  collector.on("collect", async (i) => {
    // 1. Validasi kepemilikan interaksi (author-only check)
    if (user && i.user && i.user.id !== user.id) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: denyMessage,
        footerText: ui.getFooter(footerCategory),
      });
      try {
        await i.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      } catch (_) {}
      return;
    }

    // 2. Eksekusi handler dengan error boundary
    if (typeof onCollect === "function") {
      try {
        await onCollect(i, collector);
      } catch (err) {
        logger.error("[InteractionPipeline:collect] Galat saat memproses interaksi: " + (err?.message || err));
      }
    }
  });

  collector.on("end", async (collected, reason) => {
    activeCollectors.delete(message.id);

    if (reason !== "navigated" && autoDisableOnEnd) {
      try {
        await message.edit({ components: [] });
      } catch (_) {}
    }

    if (typeof onEnd === "function") {
      try {
        await onEnd(collected, reason);
      } catch (err) {
        logger.error("[InteractionPipeline:end] Galat saat membersihkan komponen: " + (err?.message || err));
      }
    }
  });

  return collector;
}

/**
 * Pagination Collector seragam untuk navigasi multi-halaman.
 *
 * @param {object} message
 * @param {object} user
 * @param {object} options
 * @param {number} options.totalPages
 * @param {number} [options.initialPage=0]
 * @param {Function} options.onPageChange - async (newPage, interaction) => {}
 * @param {string} [options.prevPrefix="page_prev"]
 * @param {string} [options.nextPrefix="page_next"]
 * @param {number} [options.time=90000]
 * @param {string} [options.footerCategory="core"]
 * @returns {object|null}
 */
function createPaginationCollector(message, user, options = {}) {
  const {
    totalPages,
    initialPage = 0,
    time = 90000,
    onPageChange,
    footerCategory = "core",
    prevPrefix = "page_prev",
    nextPrefix = "page_next",
  } = options;

  if (!totalPages || totalPages <= 1) return null;

  let currentPage = initialPage;

  return createManagedCollector(message, user, {
    time,
    footerCategory,
    onCollect: async (i) => {
      let changed = false;
      if (i.customId.startsWith(prevPrefix)) {
        if (currentPage > 0) {
          currentPage--;
          changed = true;
        }
      } else if (i.customId.startsWith(nextPrefix)) {
        if (currentPage < totalPages - 1) {
          currentPage++;
          changed = true;
        }
      }

      if (changed && typeof onPageChange === "function") {
        await onPageChange(currentPage, i);
      } else if (!i.replied && !i.deferred) {
        await i.deferUpdate().catch(() => {});
      }
    },
  });
}

module.exports = {
  activeCollectors,
  registerCollector,
  stopCollector,
  createManagedCollector,
  createPaginationCollector,
};
