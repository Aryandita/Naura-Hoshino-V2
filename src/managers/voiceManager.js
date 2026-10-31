"use strict";

const { Readable } = require("node:stream");
const { logger } = require("./logger");
const googleTTS = require("google-tts-api");

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
    if (!process.env.FFMPEG_PATH) {
      const staticPath = require("ffmpeg-static");
      if (staticPath) process.env.FFMPEG_PATH = staticPath;
    }
  } catch (_) {
    // ffmpeg-static tidak terpasang: andalkan binary di PATH.
  }
}

class VoiceManager {
  static connections = new Map(); // guildId -> { guildId, channelId, connection, player, mode, keepaliveTimer }
  static KEEPALIVE_TIMEOUT_MS = 60000;

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
    if (!session) return;

    logger.info(`[VoiceManager] Mengalah pada Lavalink Music di guild ${gId}. Menutup koneksi native voice.`);
    this.disconnect(gId);
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
      logger.error(`[VoiceManager] Audio Player Error di guild ${guildId}:`, err.message);
    });

    this.connections.set(guildId, session);
    return session;
  }

  static scheduleIdleKeepalive(guildId) {
    const session = this.connections.get(String(guildId));
    if (!session || session.mode === "persistent") return;

    if (session.keepaliveTimer) clearTimeout(session.keepaliveTimer);

    session.keepaliveTimer = setTimeout(() => {
      logger.info(`[VoiceManager] Keepalive timeout tercapai di guild ${guildId}. Melepaskan koneksi voice.`);
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
    const gId = String(guildId);
    const session = this.connections.get(gId);
    if (!session) return;

    if (session.keepaliveTimer) clearTimeout(session.keepaliveTimer);

    try {
      if (session.player) session.player.stop(true);
      if (session.connection) session.connection.destroy();
    } catch (e) {
      logger.debug("[VoiceManager:disconnect] Cleanup error: " + (e?.message || e));
    } finally {
      this.connections.delete(gId);
    }
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
      const session = this.acquireConnection({ voiceChannel, mode: "transient" });
      if (!session) return { success: false, reason: "connection_failed" };

      const safeText = text.length > 195 ? text.substring(0, 192) + "..." : text;
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
      logger.error(`[VoiceManager] Gagal memutar stream audio di guild ${guildId}:`, err);
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
   * @returns {Promise<{success: boolean, reason?: string, durationMs?: number}>}
   */
  static async playIntroClip({ guildId, voiceChannel, audioBuffer, filePath, timeoutMs = 20000 }) {
    const voice = getVoiceLib();
    if (!voice) return { success: false, reason: "voice_lib_unavailable" };
    if (!voiceChannel || !voiceChannel.guild) {
      return { success: false, reason: "voice_channel_unavailable" };
    }
    if (!audioBuffer && !filePath) {
      return { success: false, reason: "no_audio_source" };
    }

    const gId = String(guildId || voiceChannel.guild.id);

    // Jangan rebutan voice channel dengan Lavalink yang sedang aktif.
    if (this.isMusicActive(gId, voiceChannel.client)) {
      return { success: false, reason: "music_active" };
    }

    ensureFfmpegPath();

    const startedAt = Date.now();
    let session = null;

    try {
      session = this.acquireConnection({ voiceChannel, mode: "transient" });
      if (!session || !session.player) {
        return { success: false, reason: "connection_failed" };
      }

      const source = audioBuffer
        ? Readable.from(audioBuffer)
        : filePath;

      const resource = voice.createAudioResource(source, {
        inlineVolume: false,
      });

      const player = session.player;

      const finished = new Promise((resolve) => {
        let settled = false;
        const done = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          player.removeListener("error", onError);
          resolve(result);
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

        player.once(voice.AudioPlayerStatus.Idle, () => done({ success: true }));
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
      // Selalu lepas koneksi native: Lavalink harus jadi pemilik voice channel
      // tunggal saat lagu utama mulai diputar.
      try {
        this.disconnect(gId);
      } catch (_) {}
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
      const session = this.acquireConnection({ voiceChannel, mode: "transient" });
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
