// Penambal bahasa: memasang localeLang, lang, t(), dan fetchLang() pada setiap
// interaction dan message TANPA perlu menyunting src/events/interactionCreate.js.
//
// Alasan memakai penambal prototipe, bukan menyuntik di interactionCreate:
// - interactionCreate.js adalah jalur kritis seluruh command; menyuntingnya
//   berisiko jauh lebih besar daripada menambal satu titik terpusat.
// - Seluruh command lama yang sudah membaca interaction.localeLang langsung
//   bekerja tanpa perubahan sebaris pun.
//
// Kontrak yang dijamin:
// - localeLang SELALU mengembalikan 'id' atau 'en', tidak pernah undefined.
// - Pembacaannya sinkron sehingga aman dipakai di dalam builder embed.
// - Bila pilihan user belum ada di cache, nilai sementara diambil dari locale
//   Discord, lalu cache dihangatkan di latar belakang untuk pembacaan berikutnya.

const { BaseInteraction, Message } = require("discord.js");
const languageManager = require("../managers/languageManager");
const { logger } = require("../managers/logger");

// Penjaga agar satu user tidak memicu banyak query serentak.
const warming = new Set();

/** Baca cache pilihan bahasa tanpa menyentuh database. */
function peekCache(userId) {
  if (!userId) return null;
  try {
    const cache = languageManager.userCache;
    if (!cache || typeof cache.get !== "function") return null;
    const hit = cache.get(userId);
    if (hit && hit.lang && hit.expiresAt > Date.now()) return hit.lang;
  } catch (error) {
    return null;
  }
  return null;
}

/** Isi cache di latar belakang. Sengaja tidak ditunggu. */
function warmCache(userId) {
  if (!userId || warming.has(userId)) return;
  warming.add(userId);
  Promise.resolve()
    .then(() => languageManager.getUserLanguage(userId))
    .catch((error) =>
      logger.warn(
        `[LocalePatch] Gagal memuat bahasa ${userId}: ${error.message}`,
      ),
    )
    .finally(() => warming.delete(userId));
}

function contextUserId(context) {
  if (!context) return null;
  return (
    (context.user && context.user.id) ||
    (context.author && context.author.id) ||
    null
  );
}

/** Versi sinkron. Aman dipanggil di dalam builder embed maupun getter. */
function resolveLanguageSync(context) {
  const userId = contextUserId(context);
  const cached = peekCache(userId);
  if (cached) return cached;
  if (userId) warmCache(userId);
  return languageManager.normalize(context && context.locale);
}

/** Versi asinkron. Dipakai bila pemanggil sanggup menunggu hasil paling akurat. */
async function resolveLanguage(context) {
  const userId = contextUserId(context);
  if (!userId) return languageManager.normalize(context && context.locale);
  try {
    return await languageManager.getUserLanguage(userId);
  } catch (error) {
    return languageManager.normalize(context && context.locale);
  }
}

/** Pasang properti hanya bila discord.js belum memilikinya. */
function defineIfAbsent(proto, name, descriptor) {
  if (!proto || Object.prototype.hasOwnProperty.call(proto, name)) return false;
  Object.defineProperty(
    proto,
    name,
    Object.assign({ configurable: true }, descriptor),
  );
  return true;
}

function patchPrototype(proto, label) {
  if (!proto) return 0;
  let applied = 0;

  if (
    defineIfAbsent(proto, "localeLang", {
      get() {
        return resolveLanguageSync(this);
      },
    })
  )
    applied++;

  if (
    defineIfAbsent(proto, "lang", {
      get() {
        return resolveLanguageSync(this);
      },
    })
  )
    applied++;

  if (
    defineIfAbsent(proto, "t", {
      value: function translate(key, placeholders) {
        return languageManager.translateSync(
          resolveLanguageSync(this),
          key,
          placeholders || {},
        );
      },
      writable: true,
    })
  )
    applied++;

  if (
    defineIfAbsent(proto, "fetchLang", {
      value: async function fetchLang() {
        return resolveLanguage(this);
      },
      writable: true,
    })
  )
    applied++;

  if (applied > 0) {
    logger.info(
      `[LocalePatch] ${applied} properti bahasa dipasang pada ${label}.`,
    );
  }
  return applied;
}

let patched = false;

function applyLocalePatch() {
  if (patched) return false;
  patched = true;

  try {
    patchPrototype(
      BaseInteraction && BaseInteraction.prototype,
      "BaseInteraction",
    );
    patchPrototype(Message && Message.prototype, "Message");
    return true;
  } catch (error) {
    logger.error(
      `[LocalePatch] Gagal memasang penambal bahasa: ${error.message}`,
    );
    return false;
  }
}

module.exports = { applyLocalePatch, resolveLanguage, resolveLanguageSync };
