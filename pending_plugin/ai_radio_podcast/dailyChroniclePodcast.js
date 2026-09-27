"use strict";

/**
 * @file dailyChroniclePodcast.js
 * @description Blueprint Modul Siaran Podcast & Radio AI Harian (Daily Chronicle Podcast).
 * Merangkum riwayat obrolan dan peristiwa besar server menjadi naskah podcast interaktif.
 */

const { logger } = require("../../src/managers/logger");

class DailyChroniclePodcast {
  constructor(guildId) {
    this.guildId = guildId;
  }

  /**
   * Menyusun kerangka naskah siaran berita server harian
   * @param {Array<string>} serverHighlights - Daftar peristiwa penting hari ini
   * @returns {object} Struktur naskah siaran podcast
   */
  compilePodcastScript(serverHighlights = []) {
    logger.info(`[DailyChroniclePodcast] Menyusun naskah siaran harian untuk guild ${this.guildId}`);

    const defaultEvents = serverHighlights.length > 0
      ? serverHighlights
      : [
          "Pasar saham Pratama mencatatkan transaksi tertinggi minggu ini.",
          "Sebuah aliansi klan baru berhasil menembus lantai 25 Neo-Abyss.",
          "Cuaca cerah diprediksi akan berlangsung di pesisir dermaga Desa Sukamaju.",
        ];

    return {
      guildId: this.guildId,
      showTitle: "🎙️ Warta Hoshino Malam: Catatan Bintang Server",
      hostName: "Naura Hoshino",
      segments: [
        {
          order: 1,
          name: "Pembuka",
          script: "Selamat malam para petualang! Bersama saya Naura, inilah warta terkini dari semesta kita hari ini.",
        },
        {
          order: 2,
          name: "Sorotan Utama",
          script: defaultEvents.join(" Selanjutnya, "),
        },
        {
          order: 3,
          name: "Penutup",
          script: "Tetap jaga vitals kalian, istirahat yang cukup di cyber-pod, dan sampai jumpa di petualangan esok hari!",
        },
      ],
      readyForTtsStreaming: false,
      instruction: "Alirkan setiap segmen naskah ke Fish Audio TTS lalu stream ke voice channel guild.",
    };
  }
}

module.exports = {
  DailyChroniclePodcast,
};
