"use strict";

const { logger } = require("../managers/logger");

class LyricsService {
  /**
   * Mengambil lirik lagu dari API publik lrclib.net
   * @param {string} query - Judul lagu atau artis
   * @param {string} [artist] - Nama artis jika diketahui
   * @returns {Promise<{ title: string, artist: string, lyrics: string, pages: string[] } | null>}
   */
  static async fetchLyrics(query, artist = "") {
    if (!query || typeof query !== "string") return null;

    try {
      // Bersihkan karakter query (hapus tanda kurung remix/official audio dll)
      const cleanQuery = query
        .replace(/\b(official\s+video|official\s+audio|music\s+video|lyrics|lyric\s+video|audio|mv|remix)\b/gi, "")
        .replace(/[()[\]{}]/g, " ")
        .trim();

      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanQuery)}`;
      const res = await globalThis.fetch(searchUrl, {
        headers: { "User-Agent": "NauraHoshinoBot/2.3.0" },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        logger.warn(`[LyricsService] HTTP ${res.status} saat mencari lirik: ${cleanQuery}`);
        return null;
      }

      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) {
        return null;
      }

      // Ambil hasil pertama yang memiliki lirik (plainLyrics atau syncedLyrics)
      const target = results.find((r) => r.plainLyrics || r.syncedLyrics) || results[0];
      let rawLyrics = target.plainLyrics || target.syncedLyrics;

      if (!rawLyrics) return null;

      // Bersihkan timestamp synced lyrics bila ada: [00:12.34] -> bersih
      if (!target.plainLyrics && target.syncedLyrics) {
        rawLyrics = rawLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim();
      }

      const pages = this.paginateLyrics(rawLyrics);

      return {
        title: target.trackName || query,
        artist: target.artistName || artist || "Artis Tidak Diketahui",
        lyrics: rawLyrics,
        pages,
      };
    } catch (error) {
      logger.error(`[LyricsService] Gagal mengambil lirik untuk "${query}":`, error.message);
      return null;
    }
  }

  /**
   * Memecah lirik lagu panjang menjadi halaman-halaman yang nyaman dibaca di Discord
   * @param {string} fullText
   * @param {number} [maxCharsPerPage=900]
   * @returns {string[]}
   */
  static paginateLyrics(fullText, maxCharsPerPage = 900) {
    if (!fullText) return ["(Lirik tidak tersedia)"];

    const lines = fullText.split("\n");
    const pages = [];
    let currentPage = "";

    for (const line of lines) {
      if ((currentPage + "\n" + line).length > maxCharsPerPage) {
        if (currentPage.trim().length > 0) {
          pages.push(currentPage.trim());
        }
        currentPage = line;
      } else {
        currentPage = currentPage ? currentPage + "\n" + line : line;
      }
    }

    if (currentPage.trim().length > 0) {
      pages.push(currentPage.trim());
    }

    return pages.length > 0 ? pages : [fullText.slice(0, maxCharsPerPage)];
  }
}

module.exports = LyricsService;
