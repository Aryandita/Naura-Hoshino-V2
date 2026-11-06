"use strict";

const fs = require("fs");
const path = require("path");
const { logger } = require("../managers/logger");
const ui = require("../config/ui");

const GREETING_PATH = path.join(__dirname, "../../assets/audio/voice/standby.mp3");
const PARK_DELAY_MS = 30 * 1000;
const GREETING_COOLDOWN_MS = 30 * 1000;
const GREETING_CLEANUP_MS = 2 * 60 * 1000;

/**
 * Satu-satunya pengecekan mode 24/7. Command menyetel `player.is247`, jalur
 * lama membaca `player.is24_7` dan `manager.isStay24_7()`; ketiganya dihitung sama.
 * @param {object} manager - MusicManager
 * @param {object} player - Poru player
 * @returns {boolean}
 */
function is247Active(manager, player) {
  if (!player) return false;
  return Boolean(
    player.is247 || player.is24_7 || manager?.isStay24_7?.(player.guildId),
  );
}

function stopCurrentTrack(player) {
  if (typeof player.stopTrack === "function") {
    player.stopTrack();
    return;
  }
  player.node?.rest
    ?.updatePlayer({
      guildId: player.guildId,
      data: { track: { encoded: null } },
    })
    ?.catch(() => {});
}

/**
 * Hentikan lagu dan kosongkan antrean saat voice channel kosong, tetapi tetap
 * berada di channel. Tanpa stream aktif, Lavalink tidak mengirim audio sama sekali.
 * @returns {Promise<boolean>} true jika player baru saja diparkir
 */
async function parkPlayer(manager, player) {
  if (!player || player.destroyed || player.aloneParked247) return false;

  player.aloneParked247 = true;
  player.isIdle247 = true;
  player.queue?.clear?.();
  manager?.cancelSleepTimer?.(player.guildId);
  manager?.clearSkipVotes?.(player.guildId);

  if (player.isPlaying || player.isPaused || player.currentTrack) {
    stopCurrentTrack(player);
  }

  logger.info(
    `[Standby247] Guild ${player.guildId} kosong. Lagu dihentikan, Naura tetap siaga di voice channel.`,
  );

  const MusicUIManager = require("./MusicUIManager");
  await MusicUIManager.renderIdle247Panel(manager, player);
  return true;
}

/**
 * Sapa pendengar yang kembali memakai audio standby.mp3 lewat Lavalink (tanpa
 * membuka koneksi voice kedua), lalu menunggu input lagu berikutnya.
 * @returns {Promise<boolean>} true jika sapaan diproses
 */
async function greetReturningListener(manager, player) {
  if (!player || player.destroyed || !player.aloneParked247) return false;

  const now = Date.now();
  if (now - (player.lastGreet247At || 0) < GREETING_COOLDOWN_MS) {
    player.aloneParked247 = false;
    return false;
  }
  player.aloneParked247 = false;
  player.lastGreet247At = now;

  const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    title: `${ui.getEmoji("night") || "🌙"} Selamat Datang Kembali`,
    description:
      "Naura sudah menunggu di sini. Ketik `/music play <judul/URL>` untuk memutar lagu berikutnya.",
    expression: "happy",
    footerText: ui.getFooter("music"),
  });

  let greetingFile = null;
  if (fs.existsSync(GREETING_PATH)) {
    const { AttachmentBuilder } = require("discord.js");
    greetingFile = new AttachmentBuilder(fs.readFileSync(GREETING_PATH), {
      name: "naura_welcome_back.mp3",
    });
    payload.files = [greetingFile];
  }

  const channel =
    manager.client.channels.cache.get(player.textChannel) ||
    (await manager.client.channels.fetch(player.textChannel).catch(() => null));
  if (!channel) return true;

  const msg = await channel.send(payload).catch(() => null);
  if (!msg) return true;

  const cleanup = setTimeout(() => msg.delete().catch(() => {}), GREETING_CLEANUP_MS);
  cleanup.unref?.();

  const audioUrl = msg.attachments?.first?.()?.url;
  if (!audioUrl) return true;

  try {
    const res = await manager.poru.resolve({
      query: audioUrl,
      requester: manager.client.user,
    });
    const track = res?.tracks?.[0];
    if (!track || player.destroyed) return true;

    track.info.title = "🎙️ Naura DJ: Selamat Datang Kembali";
    track.info.author = "Naura Hoshino";
    track.info.originalSource = "http";
    track.isTTS = true;
    track.isStandbyTTS = true;
    track.info.skipDj = true;

    player.queue.add(track);
    player.play();
  } catch (err) {
    logger.warn(`[Standby247] Gagal memutar audio sapaan: ${err?.message || err}`);
  }
  return true;
}

module.exports = {
  is247Active,
  parkPlayer,
  greetReturningListener,
  PARK_DELAY_MS,
  GREETING_COOLDOWN_MS,
};

