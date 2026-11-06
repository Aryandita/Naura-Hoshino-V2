const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");
const {
  is247Active,
  parkPlayer,
  greetReturningListener,
  PARK_DELAY_MS,
} = require("../../music/standby247");

module.exports = {
  name: "musicAutoDisconnect",
  execute(oldState, newState, client) {
    const { guild } = newState;
    if (!guild) return;

    // ==========================================
    // 🎵 LOGIKA AUTO-DISCONNECT MUSIC (3 MENIT ALONE GUARD)
    // ==========================================
    if (!client.aloneDisconnectTimers) client.aloneDisconnectTimers = new Map();

    const checkChannelAlone = (voiceChan) => {
      if (!voiceChan || !guild) return;
      const botInChan = voiceChan.members.has(client.user.id);
      if (!botInChan) return;

      const nonBotMembers = voiceChan.members.filter((m) => !m.user.bot);
      const timerKey = `${guild.id}:${voiceChan.id}`;

      const manager = client.musicManager;
      const activePlayer = manager?.poru?.players?.get(guild.id);

      if (nonBotMembers.size === 0) {
        // Mode 24/7: tidak pernah keluar. Hentikan lagu setelah jeda singkat dan
        // tetap siaga tanpa stream aktif.
        if (is247Active(manager, activePlayer)) {
          if (
            !client.aloneDisconnectTimers.has(timerKey) &&
            !activePlayer.aloneParked247
          ) {
            const parkTimer = setTimeout(() => {
              client.aloneDisconnectTimers.delete(timerKey);
              const stillAlone = voiceChan.members.every((m) => m.user.bot);
              if (stillAlone && is247Active(manager, activePlayer)) {
                parkPlayer(manager, activePlayer).catch((err) =>
                  logger.warn(`[Standby247] Gagal memarkir player: ${err?.message || err}`),
                );
              }
            }, PARK_DELAY_MS);
            if (parkTimer.unref) parkTimer.unref();
            client.aloneDisconnectTimers.set(timerKey, parkTimer);
          }
          return;
        }

        // Bot sendirian di voice channel! Pasang timer 3 menit
        if (!client.aloneDisconnectTimers.has(timerKey)) {
          logger.info(
            `[MUSIC ALONE] Bot sendirian di VC ${voiceChan.name} (${guild.name}). Memasang timer disconnect 3 menit...`,
          );
          const timer = setTimeout(
            async () => {
              client.aloneDisconnectTimers.delete(timerKey);
              const currentChan = guild.channels.cache.get(voiceChan.id);
              if (currentChan && currentChan.members.has(client.user.id)) {
                const aloneMembers = currentChan.members.filter(
                  (m) => !m.user.bot,
                );
                const guardPlayer = client.musicManager?.poru?.players?.get(guild.id);
                if (aloneMembers.size === 0 && is247Active(client.musicManager, guardPlayer)) {
                  // 24/7 diaktifkan saat timer berjalan: jangan keluar.
                  parkPlayer(client.musicManager, guardPlayer).catch(() => {});
                  return;
                }
                if (aloneMembers.size === 0) {
                  logger.info(
                    `[MUSIC ALONE] 3 menit berlalu, memutus koneksi music player di ${guild.name}...`,
                  );
                  const poru = client.musicManager?.poru;
                  const player = poru?.players?.get(guild.id);
                  if (player) {
                    client.musicManager?.cancelSleepTimer?.(guild.id);
                    const textChanId = player.textChannel;
                    player.destroy();
                    if (textChanId) {
                      const textChan = guild.channels.cache.get(textChanId);
                      if (textChan) {
                        const {
                          buildContainerV2,
                        } = require("../../utils/NauraContainerBuilder");
                        const payload = buildContainerV2({
                          accentColorHex: ui.getColor("warning") || "#FFA500",
                          authorName: "Naura Voice Guard",
                          title: `${ui.getEmoji("offline") || ui.getEmoji("power") || "🔌"} Otomatis Disconnect`,
                          description: `Naura telah keluar dari Voice Channel karena sendirian selama **3 menit** untuk menghemat resource server. Silakan panggil kembali dengan \`/music play\`! ${ui.getEmoji("naura_sleepy") || "💤"}`,
                          expression: "sleepy",
                          footerText: ui.getFooter("music"),
                        });
                        textChan.send(payload).catch(() => {});
                      }
                    }
                  }
                }
              }
            },
            3 * 60 * 1000,
          );

          if (timer.unref) timer.unref();
          client.aloneDisconnectTimers.set(timerKey, timer);
        }
      } else {
        // Ada user lain di voice channel, batalkan timer jika ada
        if (client.aloneDisconnectTimers.has(timerKey)) {
          logger.info(
            `[MUSIC ALONE] User bergabung kembali di VC ${voiceChan.name}. Membatalkan timer disconnect.`,
          );
          clearTimeout(client.aloneDisconnectTimers.get(timerKey));
          client.aloneDisconnectTimers.delete(timerKey);
        }

        // Pendengar kembali ke player 24/7 yang sedang diparkir: sapa dan tunggu lagu baru.
        if (activePlayer?.aloneParked247 && is247Active(manager, activePlayer)) {
          greetReturningListener(manager, activePlayer).catch((err) =>
            logger.warn(`[Standby247] Gagal menyapa: ${err?.message || err}`),
          );
        }
      }
    };

    if (oldState.channel) checkChannelAlone(oldState.channel);
    if (newState.channel) checkChannelAlone(newState.channel);
  },
};
