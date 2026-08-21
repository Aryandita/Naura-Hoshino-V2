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

const AUTO_DELETE_MS = 90000; // 90 detik (1 menit 30 detik)

/**
 * Pasang interceptor auto-delete pada interaction slash.
 * Perilakunya dipertahankan sama seperti sebelum pemecahan berkas.
 */
function attachAutoDelete(interaction) {
  const origReply = interaction.reply.bind(interaction);
  const origEditReply = interaction.editReply.bind(interaction);
  const origFollowUp = interaction.followUp.bind(interaction);

  interaction.reply = async (options) => {
    const opts =
      typeof options === "string" ? { content: options } : { ...options };
    opts.fetchReply = true;
    let res;

    if (interaction.deferred || interaction.replied) {
      if (opts.ephemeral && !interaction.ephemeral) {
        res = await origFollowUp(opts);
        interaction.deleteReply().catch(() => {});
      } else {
        res = await origEditReply(opts);
      }
    } else {
      res = await origReply(opts);
    }

    if (!opts.ephemeral && !interaction.ephemeral) {
      setTimeout(
        () => interaction.deleteReply().catch(() => {}),
        AUTO_DELETE_MS,
      );
    }
    return res;
  };

  interaction.editReply = async (options) => {
    const opts =
      typeof options === "string" ? { content: options } : { ...options };
    const res = await origEditReply(opts);
    if (!interaction.ephemeral) {
      setTimeout(
        () => interaction.deleteReply().catch(() => {}),
        AUTO_DELETE_MS,
      );
    }
    return res;
  };

  return interaction;
}

// Nilai bawaan opsi untuk jalur prefix, menggantikan rantai if berurutan.
const PREFIX_OPTION_DEFAULTS = {
  travel: { lokasi: "kota" },
  collect: { lokasi: "hutan" },
  work: { pekerjaan: "janitor" },
  pet: { aksi: "view" },
  class: { nama: "warrior" },
};

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
    reply: async (data) => await message.reply(data),
    editReply: async (data) => {
      if (loadingMsg) return await loadingMsg.edit(data);
      return await message.reply(data);
    },
    followUp: async (data) => await message.reply(data),
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
      exclusiveItem: "bendera_merah_putih"
    };
  }

  // 2. Ulang Tahun Naura (11 - 13 Juni)
  if (m === 6 && d >= 11 && d <= 13) {
    return {
      name: "naura_birthday",
      label: `${ui.getEmoji("cake") || "🎂"} Ulang Tahun Naura`,
      boostType: "coin",
      dropBoost: 2.0,
      exclusiveItem: "birthday_cake"
    };
  }

  // 3. Tahun Baru (31 Des - 1 Jan)
  if ((m === 12 && d === 31) || (m === 1 && d === 1)) {
    return {
      name: "new_year",
      label: `${ui.getEmoji("party") || "🎆"} Event Tahun Baru`,
      boostType: "coupon",
      dropBoost: 1.0, // No multiplier, just daily random
      exclusiveItem: "firework"
    };
  }

  // 4. Kalender Dinamis Ramadhan & Lebaran (Aproksimasi 2025 - 2028)
  const hijriMap = {
    2025: { ramadhanStart: "03-01", ramadhanEnd: "03-30", lebaran: "03-31" },
    2026: { ramadhanStart: "02-18", ramadhanEnd: "03-19", lebaran: "03-20" },
    2027: { ramadhanStart: "02-08", ramadhanEnd: "03-09", lebaran: "03-10" },
    2028: { ramadhanStart: "01-28", ramadhanEnd: "02-26", lebaran: "02-27" }
  };

  const currYearHijri = hijriMap[y];
  if (currYearHijri) {
    const todayStr = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    
    // Masa Ramadhan (Daily Ketupat)
    if (todayStr >= currYearHijri.ramadhanStart && todayStr <= currYearHijri.ramadhanEnd) {
      return {
        name: "ramadhan",
        label: `${ui.getEmoji("night") || "🌙"} Bulan Ramadhan`,
        boostType: "none",
        dropBoost: 1.0,
        exclusiveItem: "ketupat"
      };
    }
    // Hari Lebaran (Tukar Ketupat)
    if (todayStr === currYearHijri.lebaran || todayStr === getNextDayStr(currYearHijri.lebaran)) {
      return {
        name: "lebaran",
        label: `${ui.getEmoji("mosque") || "🕌"} Hari Raya Idul Fitri`,
        boostType: "none",
        dropBoost: 1.0,
        exclusiveItem: "opor_ayam"
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

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
  const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
  const cacheManager = require("../../managers/cacheManager");

  const eNaura = ui.getEmoji("about") || "🌸";
  const eHeart = ui.getEmoji("heart") || "💖";

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("naura_bday_greet")
      .setLabel("Sapa Naura & Kasih Selamat!")
      .setStyle(ButtonStyle.Success)
      .setEmoji(ui.parseEmoji(ui.getEmoji("cake")) || { name: "🎂" })
  );

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFC0CB",
    authorName: "Naura Hoshino",
    title: `${eNaura} Ketemu Naura!`,
    iconURL: interaction.client.user.displayAvatarURL(),
    expression: "happy",
    description: "Eh, kebetulan banget kita ketemu di sini! Hari ini ulang tahunku lho... hihi.",
    footerText: ui.getFooter("survival"),
  });

  const msg = await interaction.followUp({
    ...payload,
    embeds: [],
    components: [...payload.components, row],
    flags: 64 // Ephemeral
  }).catch(() => {});

  if (!msg) return;

  const collector = msg.createMessageComponentCollector({
    filter: (i) => i.user.id === userId && i.customId === "naura_bday_greet",
    time: 15000,
    max: 1
  });

  collector.on("collect", async (i) => {
    await cacheManager.incrementUserSurvival(userId, "coupons", 1);
    
    const thxPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      authorName: "Naura Hoshino",
      title: `${eHeart} Makasih yaa!`,
      iconURL: interaction.client.user.displayAvatarURL(),
      expression: "cheers",
      description: "Makasih banyak ucapannya! Ini aku kasih 1 Naura Coupon buat kamu. Semoga petualanganmu hari ini menyenangkan!",
      footerText: ui.getFooter("survival"),
    });

    await i.update({ ...thxPayload, embeds: [], components: thxPayload.components }).catch(() => {});
  });
}

module.exports = { attachAutoDelete, createMockInteraction, AUTO_DELETE_MS, getCurrentSeason, checkNauraBirthdayEncounter };
