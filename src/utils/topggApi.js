"use strict";

const env = require("../config/env");
const { logger } = require("../managers/logger");

/**
 * Memeriksa status vote pengguna langsung ke REST API resmi Top.gg.
 *
 * @param {string} userId - ID Discord pengguna
 * @returns {Promise<{ ok: boolean, voted?: boolean, reason?: string }>}
 */
async function checkTopggVote(userId) {
  const token = env.TOPGG_TOKEN || env.WEBHOOK_AUTH_VOTE;
  const clientId = env.CLIENT_ID || "1483665745727721543";

  // Bila token tidak dikonfigurasi, lewati pemeriksaan API agar fallback webhook / manual claim tetap bisa berjalan
  if (!token) {
    return { ok: true, voted: true, reason: "no_api_token" };
  }

  try {
    const res = await fetch(
      `https://top.gg/api/bots/${clientId}/check?userId=${userId}`,
      {
        headers: {
          Authorization: token,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (res.status === 401 || res.status === 403) {
      logger.warn(
        `[TOPGG API] Token tidak valid saat memeriksa vote user ${userId}. Melanjutkan dengan mode toleran.`,
      );
      return { ok: true, voted: true, reason: "invalid_topgg_token" };
    }

    if (!res.ok) {
      logger.warn(
        `[TOPGG API] HTTP ${res.status} saat memeriksa vote user ${userId}.`,
      );
      return { ok: true, voted: true, reason: `http_${res.status}` };
    }

    const data = await res.json();
    const hasVoted = data.voted === 1 || data.voted === true;
    return { ok: true, voted: hasVoted };
  } catch (err) {
    logger.warn(`[TOPGG API] Gagal menghubungi API Top.gg: ${err.message}`);
    // Bila koneksi ke Top.gg gagal/timeout, jangan blokir user
    return { ok: true, voted: true, reason: "network_error" };
  }
}

module.exports = {
  checkTopggVote,
};
