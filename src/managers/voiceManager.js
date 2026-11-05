"use strict";

const { Readable } = require("node:stream");
const { logger } = require("./logger");
const googleTTS = require("google-tts-api");
const env = require("../config/env");

let djsVoice = null;
function getVoiceLib() {
  if (djsVoice !== null) return djsVoice;
  try {
    djsVoice = require("@discordjs/voice");
  } catch (_) {
    djsVoice = false;
  }
  return djsVoice;
}

let ffmpegPathReady = false;
/**
 * Pastikan prism-media bisa menemukan binary FFmpeg untuk mendekode mp3.
 * Tanpa ini, createAudioResource() pada file .mp3 gagal senyap di container.
 */
function ensureFfmpegPath() {
  if (ffmpegPathReady) return;
  ffmpegPathReady = true;
  try {
    if (!env.FFMPEG_PATH) {
      const staticPath = require("ffmpeg-static");
      if (staticPath) {
        env.FFMPEG_PATH = staticPath;
      }
    }
  } catch (_) {
    // ffmpeg-static tidak terpasang: andalkan binary di PATH.
  }
}

class VoiceManager {
  static connections = new Map(); // guildId -> { guildId, channelId, connection, player, mode, keepaliveTimer }
  static KEEPALIVE_TIMEOUT_MS = 60000;
  static voiceConnectionGuard = new Map(); // guildId -> { locked, owner, depth, acquiredAt, queue: [] }

  /**
   * Mengambil voice lock eksklusif untuk guild tertentu.
   * @param {string} guildId
   * @param {string} [owner="native"]
   * @param {number} [timeoutMs=15000]
   * @returns {Promise<boolean>}
   */
  static async acquireVoiceLock(guildId, owner = "native", timeoutMs = 15000) {
    const gId = String(guildId);
    let guard = this.voiceConnectionGuard.get(gId);
    if (!guard) {
      guard = {
        locked: false,
        owner: null,
        depth: 0,
        acquiredAt: 0,
        queue: [],
      };
      this.voiceConnectionGuard.set(gId, guard);
    }

    if (!guard.locked) {
      guard.locked = true;
      guard.owner = owner;
      guard.depth = 1;
      guard.acquiredAt = Date.now();
      logger.debug(
        `[VoiceManager] Voice lock didapatkan untuk guild ${gId} oleh ${owner}.`,
      );
      return true;
    }

    if (guard.owner === owner) {
      guard.depth += 1;
      return true;
    }

    return new Promise((resolve) => {
      let timer = null;
      const waiter = {
        owner,
        resolve: () => {
          if (timer) clearTimeout(timer);
          guard.locked = true;
          guard.owner = owner;
          guard.depth = 1;
          guard.acquiredAt = Date.now();
          logger.debug(
            `[VoiceManager] Voice lock dialihkan ke ${owner} untuk guild ${gId}.`,
          );
          resolve(true);
        },
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = guard.queue.indexOf(waiter);
          if (idx !== -1) guard.queue.splice(idx, 1);
          logger.warn(
            `[VoiceManager] Timeout (${timeoutMs}ms) menunggu voice lock di guild ${gId} untuk ${owner}.`,
          );
          resolve(false);
        }, timeoutMs);
        if (timer.unref) timer.unref();
      }

      guard.queue.push(waiter);
    });
  }

  /**
   * Melepas voice lock untuk guild tertentu.
   * @param {string} guildId
   * @param {string} [owner="native"]
   * @returns {Promise<boolean>}
   */
  static async releaseVoiceLock(guildId, owner = "native") {
    const gId = String(guildId);
    const guard = this.voiceConnectionGuard.get(gId);
    if (!guard || !guard.locked) return true;

    if (guard.depth > 1 && (guard.owner === owner || owner === "force")) {
      guard.depth -= 1;
      return true;
    }

    guard.depth = 0;
    guard.locked = false;
    guard.owner = null;
    guard.acquiredAt = 0;

    if (guard.queue.length > 0) {
      const nextWaiter = guard.queue.shift();
      setImmediate(() => {
        nextWaiter.resolve();
      });
    } else {
      this.voiceConnectionGuard.delete(gId);
    }

    logger.debug(`[VoiceManager] Voice lock dilepas untuk guild ${gId}.`);
    return true;
  }

  /**
   * Cek apakah voice gateway sedang terkunci untuk guild tertentu.
   * @param {string} guildId
   * @returns {boolean}
   */
  static isVoiceLocked(guildId) {
    const gId = String(guildId);
    const guard = this.voiceConnectionGuard.get(gId);
    return Boolean(guard && guard.locked);
  }

  /**
   * Mengambil nama pemegang voice lock saat ini.
   * @param {string} guildId
   * @returns {string|null}
   */
  static getVoiceLockOwner(guildId) {
    const gId = String(guildId);
    const guard = this.voiceConnectionGuard.get(gId);
    return guard && guard.locked ? guard.owner : null;
  }

  /**
   * Menunggu hingga voice lock pada guild dilepaskan.
   * @param {string} guildId
   * @param {number} [timeoutMs=15000]
   * @returns {Promise<boolean>}
   */
  static async waitForVoiceLock(guildId, timeoutMs = 15000) {
    const gId = String(guildId);
    const guard = this.voiceConnectionGuard.get(gId);
    if (!guard || !guard.locked) return true;

    return new Promise((resolve) => {
      let timer = null;
      const waiter = {
        owner: "waiter",
        resolve: () => {
          if (timer) clearTimeout(timer);
          resolve(true);
        },
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = guard.queue.indexOf(waiter);
          if (idx !== -1) guard.queue.splice(idx, 1);
          resolve(false);
        }, timeoutMs);
        if (timer.unref) timer.unref();
      }

      guard.queue.push(waiter);
    });
  }

  /**
   * Pembersihan total dan pelepasan sesi koneksi native voice.
   * Menghentikan audio player, melepaskan listener adapter gateway,
   * dan menghancurkan koneksi Discord.
   * @param {string} guildId
   * @param {object} [session]
   */
  static cleanTeardownConnection(guildId, session) {
    const gId = String(guildId);
    const activeSession = session || this.connections.get(gId);
    if (!activeSession) return;

    if (activeSession.keepaliveTimer) {
      clearTimeout(activeSession.keepaliveTimer);
      activeSession.keepaliveTimer = null;
    }

    try {
      if (activeSession.player) {
        activeSession.player.stop(true);
        activeSession.player.removeAllListeners();
      }
    } catch (e) {
      logger.debug(
        "[VoiceManager:cleanTeardownConnection] Player cleanup error: " +
          (e?.message || e),
      );
    }

    try {
      if (activeSession.connection) {
        activeSession.connection.removeAllListeners();
        activeSession.connection.destroy();
      }
    } catch (e) {
      logger.debug(
        "[VoiceManager:cleanTeardownConnection] Connection cleanup error: " +
          (e?.message || e),
      );
    } finally {
      this.connections.delete(gId);
    }
  }

  static isAvailable() {
    return Boolean(getVoiceLib());
  }

  static hasActiveConnection(guildId) {
    return this.connections.has(String(guildId));
  }

  static isMusicActive(guildId, client) {
    if (!client || !client.musicManager) return false;
    const poru = client.musicManager._poru;
    if (!poru || !poru.players) return false;
    const player = poru.players.get(String(guildId));
    if (!player) return false;
    return Boolean(player.isPlaying || player.isPaused || player.isConnected);
  }

  static async yieldToMusic(guildId) {
    const gId = String(guildId);
    const session = this.connections.get(gId);
    if (!session && !this.isVoiceLocked(gId)) return;

    logger.info(
      `[VoiceManager] Mengalah pada Lavalink Music di guild ${gId}. Menutup koneksi native voice.`,
    );
    this.cleanTeardownConnection(gId, session);
    await this.releaseVoiceLock(gId, "force");
  }

  static acquireConnection({ voiceChannel, mode = "transient" }) {
    const voice = getVoiceLib();
    if (!voice) return null;

    const {
      joinVoiceChannel,
      createAudioPlayer,
      VoiceConnectionStatus,
      entersState,
    } = voice;

    const guildId = String(voiceChannel.guild.id);
    let session = this.connections.get(guildId);

    if (session && session.connection) {
      if (session.keepaliveTimer) {
        clearTimeout(session.keepaliveTimer);
        session.keepaliveTimer = null;
      }
      if (mode === "persistent") session.mode = "persistent";
      return session;
    }

    const player = createAudioPlayer();
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    connection.subscribe(player);

    session = {
      guildId,
      channelId: voiceChannel.id,
      connection,
      player,
      mode,
      keepaliveTimer: null,
    };

    // Robust Disconnection Handling (Handles Region Shifts & Network Blips)
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch (_) {
        VoiceManager.disconnect(guildId);
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      VoiceManager.connections.delete(guildId);
    });

    player.on("error", (err) => {
      logger.error(
        `[VoiceManager] Audio Player Error di guild ${guildId}:`,
        err.message,
      );
    });

    this.connections.set(guildId, session);
    return session;
  }

  static scheduleIdleKeepalive(guildId) {
    const session = this.connections.get(String(guildId));
    if (!session || session.mode === "persistent") return;

    if (session.keepaliveTimer) clearTimeout(session.keepaliveTimer);

    session.keepaliveTimer = setTimeout(() => {
      logger.info(
        `[VoiceManager] Keepalive timeout tercapai di guild ${guildId}. Melepaskan koneksi voice.`,
      );
      VoiceManager.disconnect(guildId);
    }, this.KEEPALIVE_TIMEOUT_MS);

    if (session.keepaliveTimer.unref) session.keepaliveTimer.unref();
  }

  static stopPlayback(guildId) {
    const session = this.connections.get(String(guildId));
    if (session && session.player) {
      session.player.stop(true);
      return true;
    }
    return false;
  }

  static disconnect(guildId) {
    this.cleanTeardownConnection(guildId);
  }

  static async speak(text, member) {
    const voice = getVoiceLib();
    if (!voice) return { success: false, reason: "voice_lib_unavailable" };
    if (!member || !member.voice || !member.voice.channel) {
      return { success: false, reason: "not_in_voice_channel" };
    }

    const voiceChannel = member.voice.channel;
    const guildId = String(voiceChannel.guild.id);

    if (this.isMusicActive(guildId, member.client)) {
      return { success: false, reason: "music_active" };
    }

    try {
      const session = this.acquireConnection({
        voiceChannel,
        mode: "transient",
      });
      if (!session) return { success: false, reason: "connection_failed" };

      const safeText =
        text.length > 195 ? text.substring(0, 192) + "..." : text;
      const audioUrl = googleTTS.getAudioUrl(safeText, {
        lang: "id",
        slow: false,
        host: "https://translate.google.com",
      });

      const resource = voice.createAudioResource(audioUrl);
      session.player.play(resource);

      session.player.once(voice.AudioPlayerStatus.Idle, () => {
        VoiceManager.scheduleIdleKeepalive(guildId);
      });

      return { success: true };
    } catch (err) {
      logger.error("[VoiceManager] Gagal mengeksekusi TTS:", err);
      return { success: false, reason: "playback_error", error: err.message };
    }
  }

  static async playAudioStream(guildId, stream) {
    const voice = getVoiceLib();
    if (!voice) return false;
    const session = this.connections.get(String(guildId));
    if (!session || !session.player) return false;

    try {
      const resource = voice.createAudioResource(stream);
      session.player.play(resource);
      return true;
    } catch (err) {
      logger.error(
        `[VoiceManager] Gagal memutar stream audio di guild ${guildId}:`,
        err,
      );
      return false;
    }
  }

  /**
   * Putar klip intro DJ lewat voice native Discord (bukan Lavalink).
   *
   * Dipakai untuk audio sapaan sebelum lagu utama. Koneksi bersifat sementara:
   * setelah klip selesai, koneksi native dilepas agar Poru/Lavalink bisa
   * mengambil alih voice channel yang sama tanpa bentrok session (kode 4006).
   *
   * @param {Object} params
   * @param {string} params.guildId
   * @param {Object} params.voiceChannel - Kanal suara Discord (butuh .guild.voiceAdapterCreator)
   * @param {Buffer} [params.audioBuffer] - Buffer audio (mp3) hasil TTS
   * @param {string} [params.filePath] - Alternatif: path file audio lokal
   * @param {number} [params.timeoutMs=20000] - Batas tunggu agar tidak menggantung
   * @param {boolean} [params.lockAlreadyAcquired=false] - Tandai jika pemanggil sudah memegang lock
   * @returns {Promise<{success: boolean, reason?: string, durationMs?: number}>}
   */
  static async playIntroClip({
    guildId,
    voiceChannel,
    audioBuffer,
    filePath,
    timeoutMs = 20000,
    lockAlreadyAcquired = false,
  }) {
    const voice = getVoiceLib();
    if (!voice) return { success: false, reason: "voice_lib_unavailable" };
    if (!voiceChannel || !voiceChannel.guild) {
      return { success: false, reason: "voice_channel_unavailable" };
    }
    if (!audioBuffer && !filePath) {
      return { success: false, reason: "no_audio_source" };
    }

    const gId = String(guildId || voiceChannel.guild.id);

    const shouldManageLock = !lockAlreadyAcquired;
    if (shouldManageLock) {
      const locked = await this.acquireVoiceLock(
        gId,
        "native_intro",
        timeoutMs,
      );
      if (!locked) {
        logger.warn(
          `[VoiceManager:playIntroClip] Gagal memperoleh voice lock di guild ${gId}.`,
        );
        return { success: false, reason: "voice_lock_busy" };
      }
    }

    logger.info(
      `[VoiceManager:playIntroClip] Memulai intro native di guild ${gId} (sumber: ${
        audioBuffer ? `buffer ${audioBuffer.length}B` : filePath
      }).`,
    );

    // Catatan: pemanggil (playEngine) sudah menahan koneksi Poru sampai intro
    // ini selesai, jadi tidak perlu cek isMusicActive di sini. Cek tambahan
    // justru berisiko memblokir intro secara keliru.

    ensureFfmpegPath();

    const startedAt = Date.now();
    let session = null;

    try {
      session = this.acquireConnection({ voiceChannel, mode: "transient" });
      if (!session || !session.player || !session.connection) {
        return { success: false, reason: "connection_failed" };
      }

      // joinVoiceChannel() mengembalikan koneksi sebelum UDP/WebSocket voice
      // benar-benar siap. Memutar resource lebih awal membuat intro berakhir
      // secara lokal tanpa pernah mengirim frame audio ke Discord.
      try {
        await voice.entersState(
          session.connection,
          voice.VoiceConnectionStatus.Ready,
          10_000,
        );
      } catch (err) {
        logger.warn(
          `[VoiceManager:playIntroClip] Koneksi native tidak Ready di guild ${gId}: ${err?.message || err}`,
        );
        return { success: false, reason: "connection_not_ready" };
      }

      const source = audioBuffer ? Readable.from(audioBuffer) : filePath;

      const resource = voice.createAudioResource(source, {
        inlineVolume: false,
      });

      const player = session.player;

      const finished = new Promise((resolve) => {
        let settled = false;
        let startedPlaying = false;
        const done = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          player.removeListener("error", onError);
          player.removeListener(voice.AudioPlayerStatus.Playing, onPlaying);
          resolve(result);
        };

        const onPlaying = () => {
          startedPlaying = true;
          logger.info(
            `[VoiceManager:playIntroClip] Intro native sedang diputar di guild ${gId}.`,
          );
        };

        const onError = (err) => {
          logger.warn(
            `[VoiceManager:playIntroClip] Player error di guild ${gId}: ${err?.message || err}`,
          );
          done({ success: false, reason: "player_error" });
        };

        const timer = setTimeout(() => {
          done({ success: false, reason: "timeout" });
        }, timeoutMs);
        if (timer.unref) timer.unref();

        player.once(voice.AudioPlayerStatus.Playing, onPlaying);
        player.once(voice.AudioPlayerStatus.Idle, () => {
          done({
            success: startedPlaying,
            reason: startedPlaying ? undefined : "never_started",
          });
        });
        player.once("error", onError);
      });

      player.play(resource);
      const outcome = await finished;

      return {
        ...outcome,
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      logger.error(
        `[VoiceManager:playIntroClip] Gagal memutar intro di guild ${gId}: ${err?.message || err}`,
      );
      return { success: false, reason: "playback_error" };
    } finally {
      // Selalu lepas koneksi native dan unbind event listener gateway:
      // Berikan settling delay agar Discord Gateway tuntas membersihkan sesi sebelumnya.
      try {
        this.cleanTeardownConnection(gId, session);
        await new Promise((r) => setTimeout(r, 250));
      } catch (_) {}

      if (shouldManageLock) {
        try {
          await this.releaseVoiceLock(gId, "native_intro");
        } catch (_) {}
      }
    }
  }

  /**
   * Putar klip intro audio secara aman dan berurutan sebelum beralih ke Poru/Lavalink.
   * Mengakuisisi voice lock eksklusif, memutar klip secara native, membersihkan koneksi
   * dan unbind event listener gateway, lalu melepaskan lock.
   *
   * @param {string|object} guildIdOrParams
   * @param {string|object} [channelIdOrVoiceChannel]
   * @param {string} [introAudioPath]
   * @param {object} [options={}]
   * @returns {Promise<{success: boolean, reason?: string, durationMs?: number}>}
   */
  static async playIntroClipSafe(
    guildIdOrParams,
    channelIdOrVoiceChannel,
    introAudioPath,
    options = {},
  ) {
    let guildId;
    let voiceChannel = null;
    let audioBuffer = null;
    let filePath = null;
    let timeoutMs = 20000;
    let client = null;

    if (typeof guildIdOrParams === "object" && guildIdOrParams !== null) {
      guildId = guildIdOrParams.guildId;
      voiceChannel = guildIdOrParams.voiceChannel;
      audioBuffer = guildIdOrParams.audioBuffer;
      filePath = guildIdOrParams.filePath || guildIdOrParams.introAudioPath;
      timeoutMs = guildIdOrParams.timeoutMs || 20000;
      client = guildIdOrParams.client;
    } else {
      guildId = String(guildIdOrParams);
      filePath = introAudioPath;
      if (
        typeof channelIdOrVoiceChannel === "object" &&
        channelIdOrVoiceChannel !== null
      ) {
        voiceChannel = channelIdOrVoiceChannel;
      }
      if (options.audioBuffer) audioBuffer = options.audioBuffer;
      if (options.filePath) filePath = options.filePath;
      if (options.timeoutMs) timeoutMs = options.timeoutMs;
      if (options.client) client = options.client;
    }

    const gId = String(guildId || voiceChannel?.guild?.id || "");
    if (!gId) {
      return { success: false, reason: "invalid_guild_id" };
    }

    if (!voiceChannel && channelIdOrVoiceChannel && client) {
      const channelId =
        typeof channelIdOrVoiceChannel === "string"
          ? channelIdOrVoiceChannel
          : channelIdOrVoiceChannel?.id;
      if (channelId && client.channels?.cache) {
        voiceChannel = client.channels.cache.get(channelId);
      }
    }

    const lockAcquired = await this.acquireVoiceLock(
      gId,
      "native_intro",
      timeoutMs,
    );
    if (!lockAcquired) {
      return { success: false, reason: "voice_lock_busy" };
    }

    try {
      return await this.playIntroClip({
        guildId: gId,
        voiceChannel,
        audioBuffer,
        filePath,
        timeoutMs,
        lockAlreadyAcquired: true,
      });
    } finally {
      this.cleanTeardownConnection(gId);
      await new Promise((r) => setTimeout(r, 250));
      await this.releaseVoiceLock(gId, "native_intro");
    }
  }

  static async playFile(filePath, member) {
    const voice = getVoiceLib();
    if (!voice) return false;
    if (!member || !member.voice || !member.voice.channel) return false;

    const voiceChannel = member.voice.channel;
    const guildId = String(voiceChannel.guild.id);

    if (this.isMusicActive(guildId, member.client)) return false;

    try {
      const session = this.acquireConnection({
        voiceChannel,
        mode: "transient",
      });
      if (!session) return false;

      const resource = voice.createAudioResource(filePath);
      session.player.play(resource);

      session.player.once(voice.AudioPlayerStatus.Idle, () => {
        VoiceManager.scheduleIdleKeepalive(guildId);
      });

      return true;
    } catch (error) {
      logger.error("[VoiceManager] Gagal memutar file audio:", error.message);
      return false;
    }
  }
}

module.exports = VoiceManager;
