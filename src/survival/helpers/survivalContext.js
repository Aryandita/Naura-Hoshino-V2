// Konteks eksekusi /survival: interceptor auto-delete untuk jalur slash, dan
// pembuat objek tiruan interaction untuk jalur prefix (n!survival ...).
//
// Objek tiruan sengaja dilengkapi localeLang, lang, t(), dan fetchLang() karena
// penambal prototipe di src/utils/localePatch.js hanya menjangkau instance asli
// discord.js, bukan objek biasa seperti ini. Tanpa pelengkap ini, pemakai
// perintah prefix akan selalu menerima Bahasa Indonesia walaupun sudah memilih
// Bahasa Inggris.

const {
  buildLoadingContainerV2,
} = require("../../utils/NauraContainerBuilder");
const languageManager = require("../../managers/languageManager");
const {
  resolveLanguageSync,
  resolveLanguage,
} = require("../../utils/localePatch");
const ui = require("../../config/ui");

const { MessageFlags } = require("discord.js");

const AUTO_DELETE_MS = 90000; // 90 detik (1 menit 30 detik)

const activeCollectors = new Map(); // messageId -> MessageComponentCollector
const autoDeleteTimers = new Map(); // messageId -> NodeJS.Timeout

/**
 * Daftarkan collector komponen pesan aktif untuk mencegah tumpang tindih navigasi.
 */
function registerMessageCollector(messageId, collector) {
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
 * Hentikan collector aktif pada pesan tertentu (misal saat berpindah layar).
 */
function stopMessageCollector(messageId, reason = "navigated") {
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
 * Jadwalkan pembersihan pesan otomatis secara terkoordinasi (reset timer pada tiap interaksi baru).
 */
function scheduleAutoDelete(messageId, deleteFn, delayMs = AUTO_DELETE_MS) {
  if (!messageId || typeof deleteFn !== "function") return;
  if (autoDeleteTimers.has(messageId)) {
    clearTimeout(autoDeleteTimers.get(messageId));
  }
  const timer = setTimeout(async () => {
    autoDeleteTimers.delete(messageId);
    try {
      await deleteFn();
    } catch (_) {}
  }, delayMs);
  autoDeleteTimers.set(messageId, timer);
}

/**
 * Bungkus objek Message agar pembuatan collector terdaftar secara otomatis di registry.
 */
function wrapMessageWithCollectorRegistry(msg) {
  if (!msg || typeof msg.createMessageComponentCollector !== "function") {
    return msg;
  }
  const origCreateCollector = msg.createMessageComponentCollector.bind(msg);
  msg.createMessageComponentCollector = function (options) {
    const collector = origCreateCollector(options);
    registerMessageCollector(msg.id, collector);

    const origOn = collector.on.bind(collector);
    collector.on = function (event, listener) {
      if (event === "end" && typeof listener === "function") {
        const wrappedListener = function (collected, reason) {
          if (reason === "navigated") return;
          return listener(collected, reason);
        };
        return origOn(event, wrappedListener);
      }
      return origOn(event, listener);
    };

    return collector;
  };
  return msg;
}

// Nilai bawaan opsi untuk jalur prefix maupun tombol, menggantikan rantai if berurutan.
const PREFIX_OPTION_DEFAULTS = {
  travel: { lokasi: "desa" },
  collect: { lokasi: null },
  work: { pekerjaan: "janitor" },
  pet: { aksi: "view" },
  class: { nama: "warrior" },
  farm: { aksi: "status" },
  siege: { aksi: "status" },
  raid: { aksi: "status" },
  clan: { aksi: "info" },
  caravan: { aksi: "status" },
  family: { aksi: "status" },
  federation: { aksi: "status" },
  customdungeon: { aksi: "browse" },
  customDungeon: { aksi: "browse" },
  conquest: { aksi: "map" },
  bounty: { aksi: "list" },
  fish: { aksi: "cast" },
  shop: { aksi: "buy" },
  market: { aksi: "view" },
};

/**
 * Normalisasi objek Interaction agar kompatibel dengan seluruh subcommand survival:
 * - Menangani reply -> editReply/followUp secara otomatis jika interaksi sudah di-defer/replied.
 * - Mencegah error 40060 pada deferReply / deferUpdate berulang.
 * - Menyediakan mock options lengkap dengan getter aman.
 * - Menghindari pemusnahan kartu utama (deleteReply) saat respons tombol berstatus ephemeral.
 */
function adaptSurvivalInteraction(interaction, actionName = null) {
  if (!interaction) return interaction;

  if (interaction._isSurvivalAdapted) {
    if (actionName && interaction.options && typeof interaction.options.getSubcommand === "function") {
      interaction.options.getSubcommand = () => actionName;
    }
    return interaction;
  }

  const origReply = typeof interaction.reply === "function" ? interaction.reply.bind(interaction) : null;
  const origEditReply = typeof interaction.editReply === "function" ? interaction.editReply.bind(interaction) : null;
  const origFollowUp = typeof interaction.followUp === "function" ? interaction.followUp.bind(interaction) : null;
  const origDeferReply = typeof interaction.deferReply === "function" ? interaction.deferReply.bind(interaction) : null;
  const origDeferUpdate = typeof interaction.deferUpdate === "function" ? interaction.deferUpdate.bind(interaction) : null;

  const messageId = interaction.message?.id || null;

  interaction.reply = async (options) => {
    const opts = typeof options === "string" ? { content: options } : { ...options };
    opts.fetchReply = true;
    let res;

    const isEphemeral = Boolean(
      opts.ephemeral ||
      (opts.flags && (opts.flags & MessageFlags.Ephemeral))
    );

    if (interaction.deferred || interaction.replied) {
      if (isEphemeral && !interaction.ephemeral && origFollowUp) {
        res = await origFollowUp({
          ...opts,
          flags: (opts.flags || 0) | MessageFlags.Ephemeral,
        });
        if (interaction.isChatInputCommand?.() && typeof interaction.deleteReply === "function") {
          interaction.deleteReply().catch(() => {});
        }
      } else if (origEditReply) {
        res = await origEditReply(opts);
      } else if (origFollowUp) {
        res = await origFollowUp(opts);
      }
    } else if (origReply) {
      res = await origReply(opts);
    }

    const finalMsg = wrapMessageWithCollectorRegistry(res);
    const targetMsgId = finalMsg?.id || messageId;

    if (!isEphemeral && !interaction.ephemeral && targetMsgId) {
      scheduleAutoDelete(targetMsgId, () => {
        if (typeof interaction.deleteReply === "function") {
          return interaction.deleteReply();
        }
        if (finalMsg && typeof finalMsg.delete === "function") {
          return finalMsg.delete();
        }
      });
    }

    return finalMsg;
  };

  interaction.editReply = async (options) => {
    const opts = typeof options === "string" ? { content: options } : { ...options };
    let res = null;
    if (origEditReply) {
      res = await origEditReply(opts);
    } else if (origReply) {
      res = await origReply(opts);
    }

    const finalMsg = wrapMessageWithCollectorRegistry(res);
    const targetMsgId = finalMsg?.id || messageId;

    if (!interaction.ephemeral && targetMsgId) {
      scheduleAutoDelete(targetMsgId, () => {
        if (typeof interaction.deleteReply === "function") {
          return interaction.deleteReply();
        }
        if (finalMsg && typeof finalMsg.delete === "function") {
          return finalMsg.delete();
        }
      });
    }

    return finalMsg;
  };

  interaction.deferReply = async (...args) => {
    if (interaction.deferred || interaction.replied) return;
    if (origDeferReply) return await origDeferReply(...args);
  };

  interaction.deferUpdate = async (...args) => {
    if (interaction.deferred || interaction.replied) return;
    if (origDeferUpdate) return await origDeferUpdate(...args);
  };

  const actionKey = actionName || "info";
  const defaults = PREFIX_OPTION_DEFAULTS[actionKey] || {};

  if (!interaction.options) {
    interaction.options = {
      getSubcommand: () => actionKey,
      getSubcommandGroup: () => null,
      getString: (name) => defaults[name] ?? null,
      getInteger: (name) => (typeof defaults[name] === "number" ? defaults[name] : null),
      getNumber: (name) => (typeof defaults[name] === "number" ? defaults[name] : null),
      getBoolean: (name) => (typeof defaults[name] === "boolean" ? defaults[name] : false),
      getUser: () => null,
      getMember: () => null,
      getChannel: () => null,
      getRole: () => null,
      getMentionable: () => null,
      getAttachment: () => null,
      getFocused: () => "",
    };
  } else {
    if (typeof interaction.options.getSubcommand !== "function") {
      interaction.options.getSubcommand = () => actionKey;
    }
    if (typeof interaction.options.getFocused !== "function") {
      interaction.options.getFocused = () => "";
    }
  }

  if (typeof interaction.t !== "function") {
    interaction.t = (key, placeholders) =>
      languageManager.translateSync(
        interaction.localeLang || "id",
        key,
        placeholders || {},
      );
  }

  interaction._isSurvivalAdapted = true;
  return interaction;
}

/**
 * Pasang interceptor auto-delete pada interaction slash.
 */
function attachAutoDelete(interaction) {
  const subName = interaction?.options?.getSubcommand
    ? interaction.options.getSubcommand(false)
    : null;
  return adaptSurvivalInteraction(interaction, subName);
}

/** Bangun objek yang menyerupai interaction untuk perintah prefix. */
function createMockInteraction({ message, client, subCmdName, args }) {
  let loadingMsg = null;

  const mock = {
    user: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    client: client,
    deferReply: async () => {
      const loadingPayload = buildLoadingContainerV2({
        authorName: "Naura Survival System",
        title: "Menyiapkan Petualangan...",
        loadingMessage:
          "Naura sedang menyiapkan data ekspedisi survival untukmu, tunggu sebentar yaa~ ✨",
        footerText: `Sedang menyiapkan untuk ${message.author.username}`,
        withBanner: true,
      });
      loadingMsg = await message.reply(loadingPayload);
    },
    reply: (data) => message.reply(data),
    editReply: (data) => (loadingMsg ? loadingMsg.edit(data) : message.reply(data)),
    followUp: (data) => message.reply(data),
    options: {
      getSubcommand: () => subCmdName,
      getString: (name) => {
        const fallback = PREFIX_OPTION_DEFAULTS[subCmdName];
        if (fallback && fallback[name]) return args[1] || fallback[name];
        return args[1];
      },
      // Stub aman: perintah prefix tidak membawa opsi terstruktur, jadi
      // pembacaannya mengembalikan null alih-alih melempar TypeError.
      getInteger: () => null,
      getNumber: () => null,
      getBoolean: () => null,
      getUser: () => null,
      getMember: () => null,
      getChannel: () => null,
      getRole: () => null,
      getAttachment: () => null,
    },
    // Dipakai builder embed maupun subcommand untuk menerjemahkan teks.
    t: (key, placeholders) =>
      languageManager.translateSync(
        resolveLanguageSync(message),
        key,
        placeholders || {},
      ),
    fetchLang: () => resolveLanguage(message),
  };

  // Getter & Setter, bukan nilai tetap, agar bahasa yang baru saja masuk cache langsung terpakai.
  Object.defineProperty(mock, "localeLang", {
    get() {
      return this._localeLang || resolveLanguageSync(message);
    },
    set(value) {
      this._localeLang = languageManager.normalize(value);
    },
    configurable: true,
  });
  Object.defineProperty(mock, "lang", {
    get() {
      return this._localeLang || resolveLanguageSync(message);
    },
    set(value) {
      this._localeLang = languageManager.normalize(value);
    },
    configurable: true,
  });

  return mock;
}

/**
 * Menghitung dan mendapatkan musim/event saat ini.
 * Termasuk kalender dinamis untuk Ramadhan & Lebaran.
 */
function getCurrentSeason() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();

  // 1. Kemerdekaan (17 - 31 Agustus)
  if (m === 8 && d >= 17 && d <= 31) {
    return {
      name: "kemerdekaan",
      label: `${ui.getEmoji("celebrate") || "🎉"} Event Kemerdekaan`,
      boostType: "fragment",
      dropBoost: 2.0,
      exclusiveItem: "bendera_merah_putih",
    };
  }

  // 2. Ulang Tahun Naura (11 - 13 Juni)
  if (m === 6 && d >= 11 && d <= 13) {
    return {
      name: "naura_birthday",
      label: `${ui.getEmoji("cake") || "🎂"} Ulang Tahun Naura`,
      boostType: "coin",
      dropBoost: 2.0,
      exclusiveItem: "birthday_cake",
    };
  }

  // 3. Tahun Baru (31 Des - 1 Jan)
  if ((m === 12 && d === 31) || (m === 1 && d === 1)) {
    return {
      name: "new_year",
      label: `${ui.getEmoji("party") || "🎆"} Event Tahun Baru`,
      boostType: "coupon",
      dropBoost: 1.0, // No multiplier, just daily random
      exclusiveItem: "firework",
    };
  }

  // 4. Kalender Dinamis Ramadhan & Lebaran (Aproksimasi 2025 - 2028)
  const hijriMap = {
    2025: { ramadhanStart: "03-01", ramadhanEnd: "03-30", lebaran: "03-31" },
    2026: { ramadhanStart: "02-18", ramadhanEnd: "03-19", lebaran: "03-20" },
    2027: { ramadhanStart: "02-08", ramadhanEnd: "03-09", lebaran: "03-10" },
    2028: { ramadhanStart: "01-28", ramadhanEnd: "02-26", lebaran: "02-27" },
  };

  const currYearHijri = hijriMap[y];
  if (currYearHijri) {
    const todayStr = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    // Masa Ramadhan (Daily Ketupat)
    if (
      todayStr >= currYearHijri.ramadhanStart &&
      todayStr <= currYearHijri.ramadhanEnd
    ) {
      return {
        name: "ramadhan",
        label: `${ui.getEmoji("night") || "🌙"} Bulan Ramadhan`,
        boostType: "none",
        dropBoost: 1.0,
        exclusiveItem: "ketupat",
      };
    }
    // Hari Lebaran (Tukar Ketupat)
    if (
      todayStr === currYearHijri.lebaran ||
      todayStr === getNextDayStr(currYearHijri.lebaran)
    ) {
      return {
        name: "lebaran",
        label: `${ui.getEmoji("mosque") || "🕌"} Hari Raya Idul Fitri`,
        boostType: "none",
        dropBoost: 1.0,
        exclusiveItem: "opor_ayam",
      };
    }
  }

  return null;
}

function getNextDayStr(dateStr) {
  const [mm, dd] = dateStr.split("-").map(Number);
  const tempDate = new Date(2026, mm - 1, dd + 1);
  return `${String(tempDate.getMonth() + 1).padStart(2, "0")}-${String(tempDate.getDate()).padStart(2, "0")}`;
}

async function checkNauraBirthdayEncounter(interaction, userId) {
  const season = getCurrentSeason();
  if (!season || season.name !== "naura_birthday") return;

  // 15% chance to encounter Naura
  if (Math.random() > 0.15) return;

  const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");
  const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
  const cacheManager = require("../../managers/cacheManager");

  const eNaura = ui.getEmoji("about") || "🌸";
  const eHeart = ui.getEmoji("heart") || "💖";

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("naura_bday_greet")
      .setLabel("Sapa Naura & Kasih Selamat!")
      .setStyle(ButtonStyle.Success)
      .setEmoji(ui.parseEmoji(ui.getEmoji("cake")) || { name: "🎂" }),
  );

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFC0CB",
    authorName: "Naura Hoshino",
    title: `${eNaura} Ketemu Naura!`,
    iconURL: interaction.client.user.displayAvatarURL(),
    expression: "happy",
    description:
      "Eh, kebetulan banget kita ketemu di sini! Hari ini ulang tahunku lho... hihi.",
    buttonsRow: [row],
    footerText: ui.getFooter("survival"),
  });

  const msg = await interaction
    .followUp({
      ...payload,
      embeds: [],
      flags: 64, // Ephemeral
    })
    .catch(() => {});

  if (!msg) return;

  const collector = msg.createMessageComponentCollector({
    filter: (i) => i.user.id === userId && i.customId === "naura_bday_greet",
    time: 15000,
    max: 1,
  });

  collector.on("collect", async (i) => {
    await cacheManager.incrementUserSurvival(userId, "coupons", 1);

    const thxPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      authorName: "Naura Hoshino",
      title: `${eHeart} Makasih yaa!`,
      iconURL: interaction.client.user.displayAvatarURL(),
      expression: "cheers",
      description:
        "Makasih banyak ucapannya! Ini aku kasih 1 Naura Coupon buat kamu. Semoga petualanganmu hari ini menyenangkan!",
      footerText: ui.getFooter("survival"),
    });

    await i
      .update({ ...thxPayload, embeds: [], components: thxPayload.components })
      .catch(() => {});
  });
}

const localBusyMap = new Map();

/**
 * Pasang status sibuk pemain agar tidak bisa masuk duel/dungeon bersamaan.
 */
async function setSurvivalBusy(userId, label, durationSeconds = 120) {
  if (!userId) return;
  const data = {
    label: label || "Aktivitas Ekspedisi",
    until: Date.now() + durationSeconds * 1000,
  };
  localBusyMap.set(userId, data);
  try {
    const redisManager = require("../../managers/redisManager");
    if (redisManager.isReady) {
      await redisManager.setCache(
        `survival:busy:${userId}`,
        data,
        durationSeconds,
      );
    }
  } catch (_) {}
}

/**
 * Hapus status sibuk pemain setelah aksi selesai.
 */
async function clearSurvivalBusy(userId) {
  if (!userId) return;
  localBusyMap.delete(userId);
  try {
    const redisManager = require("../../managers/redisManager");
    if (redisManager.isReady) {
      await redisManager.deleteCache(`survival:busy:${userId}`);
    }
  } catch (_) {}
}

/**
 * Cek apakah pemain sedang dalam sesi sibuk (dungeon, duel, arena).
 */
async function isSurvivalBusy(userId) {
  if (!userId) return { isBusy: false };
  try {
    const redisManager = require("../../managers/redisManager");
    if (redisManager.isReady) {
      const cached = await redisManager.getCache(`survival:busy:${userId}`);
      if (cached && (!cached.until || cached.until > Date.now())) {
        return { isBusy: true, label: cached.label || "Aktivitas Lain" };
      }
    }
  } catch (_) {}

  const local = localBusyMap.get(userId);
  if (local && local.until > Date.now()) {
    return { isBusy: true, label: local.label || "Aktivitas Lain" };
  }
  if (local) {
    localBusyMap.delete(userId);
  }
  return { isBusy: false };
}

module.exports = {
  attachAutoDelete,
  adaptSurvivalInteraction,
  registerMessageCollector,
  stopMessageCollector,
  wrapMessageWithCollectorRegistry,
  scheduleAutoDelete,
  PREFIX_OPTION_DEFAULTS,
  createMockInteraction,
  AUTO_DELETE_MS,
  getCurrentSeason,
  checkNauraBirthdayEncounter,
  setSurvivalBusy,
  clearSurvivalBusy,
  isSurvivalBusy,
};
