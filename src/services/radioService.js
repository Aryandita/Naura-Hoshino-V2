"use strict";

const redisManager = require("../managers/redisManager");

class RadioService {
  /**
   * Buat intro penyiar radio Naura untuk lagu yang direquest
   * @param {string} trackTitle
   * @param {string} requesterName
   * @returns {string}
   */
  generateTrackIntro(trackTitle, requesterName = "Teman Musik") {
    const intros = [
      `"Lagu berikutnya adalah **${trackTitle}**, dipersembahkan khusus atas permintaan **${requesterName}**! Selamat menikmati beat hangatnya semuanya~ ✨"`,
      `"Melodi selanjutnya hadir dari selera manis **${requesterName}**: **${trackTitle}**! Mari sejenak rileks bersama Naura ya~ 🌸"`,
      `"Permintaan spesial dari **${requesterName}** sedang mengudara: **${trackTitle}**! Tetap semangat menjalani hari ini~ 🎵"`,
      `"Memasuki gelombang santai berikutnya, **${requesterName}** memperdengarkan **${trackTitle}**! Selamat bernostalgia~ 📻"`,
    ];
    return intros[Math.floor(Math.random() * intros.length)];
  }

  /**
   * Antrekan pesan / titipan salam radio
   * @param {string} guildId
   * @param {string} authorName
   * @param {string} messageText
   * @param {boolean} isAnon
   * @returns {Promise<Object>}
   */
  async queueRadioMessage(guildId, authorName, messageText, isAnon = false) {
    const key = `radio:messages:${guildId}`;
    const entry = {
      id: `msg_${Date.now()}`,
      author: isAnon ? "Pengirim Rahasia 🤫" : authorName,
      text: messageText.trim().slice(0, 200),
      timestamp: new Date().toISOString(),
    };

    if (redisManager.isReady) {
      try {
        await redisManager.lpush(key, JSON.stringify(entry));
        await redisManager.ltrim(key, 0, 15);
      } catch (_) {}
    }

    return entry;
  }

  /**
   * Ambil daftar pesan radio yang mengantre
   * @param {string} guildId
   * @returns {Promise<Array>}
   */
  async getPendingRadioMessages(guildId) {
    const key = `radio:messages:${guildId}`;
    if (redisManager.isReady) {
      try {
        const raw = await redisManager.lrange(key, 0, 5);
        if (raw && raw.length > 0) {
          return raw.map((r) => JSON.parse(r));
        }
      } catch (_) {}
    }
    return [];
  }

  /**
   * Dapatkan preset soundscape santai
   */
  getPresets() {
    return [
      {
        id: "lofi_rain",
        name: "Midnight Lo-Fi & Rainy Cafe 🌧️",
        desc: "Kombinasi melodi lo-fi dengan rintik hujan lembut",
      },
      {
        id: "starlight_chill",
        name: "Starlight Ambient Lounge 🌌",
        desc: "Suasana santai malam berbintang bernuansa kosmik",
      },
      {
        id: "tokyo_cafe",
        name: "Cyber Shibuya Coffeehouse ☕",
        desc: "Nuansa kafe hangat di tengah gemerlap kota cyberpunk",
      },
    ];
  }
}

module.exports = new RadioService();
