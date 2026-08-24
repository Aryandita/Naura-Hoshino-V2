const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");

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

      if (nonBotMembers.size === 0) {
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
                if (aloneMembers.size === 0) {
                  logger.info(
                    `[MUSIC ALONE] 3 menit berlalu, memutus koneksi music player di ${guild.name}...`,
                  );
                  const poru = client.musicManager?.poru;
                  const player = poru?.players?.get(guild.id);
                  if (player) {
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
                          description:
                            `Naura telah keluar dari Voice Channel karena sendirian selama **3 menit** untuk menghemat resource server. Silakan panggil kembali dengan \`/music play\`! ${ui.getEmoji("naura_sleepy") || "💤"}`,
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
      }
    };

    if (oldState.channel) checkChannelAlone(oldState.channel);
    if (newState.channel) checkChannelAlone(newState.channel);
  },
};
