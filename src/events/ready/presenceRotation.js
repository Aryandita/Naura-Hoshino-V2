const botActivity = require("../../config/bot-activity");

module.exports = {
  name: "presenceRotation",
  execute(client) {
    // ==========================================
    // 🔄 ROTASI STATUS BOT (DARI BOT-ACTIVITY.JS)
    // ==========================================
    const activities = botActivity.activities;

    if (activities && activities.length > 0) {
      let currentIndex = 0;
      const env = require("../../config/env");

      const formatUptime = (ms) => {
        if (ms < 1000) return "0m";
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        let result = [];
        if (days > 0) result.push(`${days}d`);
        if (hours > 0) result.push(`${hours}h`);
        if (minutes > 0) result.push(`${minutes}m`);
        return result.length > 0 ? result.join(" ") : "0m";
      };

      // --- 📊 EVENT LOOP LAG MONITOR ---
      let isSystemLagging = false;
      setInterval(async () => {
        const start = Date.now();
        await new Promise((resolve) => setImmediate(resolve));
        const lag = Date.now() - start;

        if (lag > 150) {
          if (!isSystemLagging) {
            isSystemLagging = true;
            console.log(
              `\x1b[41m\x1b[37m ⚠️ EVENT LOOP \x1b[0m \x1b[31mTerdeteksi lag tinggi pada event loop: ${lag}ms! Mengubah status bot ke DND.\x1b[0m`,
            );
          }
        } else {
          if (isSystemLagging && lag < 50) {
            isSystemLagging = false;
            console.log(
              `\x1b[42m\x1b[30m ⚡ EVENT LOOP \x1b[0m \x1b[32mLag event loop kembali normal: ${lag}ms. Memulihkan status.\x1b[0m`,
            );
          }
        }
      }, 5000);

      // --- 🏷️ DYNAMIC GUILD PREFIX CACHE ---
      let guildPrefixes = [];
      let prefixCycleIndex = 0;

      (async () => {
        try {
          const GuildSettings = require("../../models/GuildSettings");
          const allSettings = await GuildSettings.findAll();
          const uniquePrefixes = new Set();
          for (const gs of allSettings) {
            const parsed =
              typeof gs.settings === "string"
                ? JSON.parse(gs.settings)
                : gs.settings || {};
            if (parsed.prefix && parsed.prefix !== env.PREFIX) {
              uniquePrefixes.add(parsed.prefix);
            }
          }
          guildPrefixes = [...uniquePrefixes];
          if (guildPrefixes.length > 0) {
            console.log(
              `\x1b[45m\x1b[37m 🏷️ PREFIX \x1b[0m \x1b[35mDimuat ${guildPrefixes.length} prefiks kustom guild untuk rotasi status.\x1b[0m`,
            );
          }
        } catch (e) {
          // Database belum siap atau tabel belum ada, gunakan fallback
        }
      })();

      setInterval(() => {
        const activity = activities[currentIndex];

        // Resolve Lavalink & Music telemetry values
        let lavalinkStatus = "0/0";
        let playingTracks = 0;
        if (client.musicManager && client.musicManager.poru) {
          const nodes = client.musicManager.poru.nodes;
          const connected = [...nodes.values()].filter(
            (n) => n.isConnected,
          ).length;
          lavalinkStatus = `${connected}/${nodes.size}`;

          const players = client.musicManager.poru.players;
          playingTracks = [...players.values()].filter(
            (p) => p.isPlaying && !p.isPaused,
          ).length;
        }

        // Resolve dynamic prefix (cycle through custom guild prefixes)
        let currentPrefix = env.PREFIX || "n!";
        if (guildPrefixes.length > 0) {
          currentPrefix =
            guildPrefixes[prefixCycleIndex % guildPrefixes.length];
          prefixCycleIndex++;
        }

        const replacePlaceholders = (str) => {
          if (!str) return str;
          return str
            .replace(
              /{servers}/g,
              client.guilds.cache.size.toLocaleString("id-ID"),
            )
            .replace(
              /{users}/g,
              client.guilds.cache
                .reduce((acc, g) => acc + (g.memberCount || 0), 0)
                .toLocaleString("id-ID") ||
                client.users.cache.size.toLocaleString("id-ID"),
            )
            .replace(/{ping}/g, Math.round(client.ws.ping))
            .replace(/{uptime}/g, formatUptime(client.uptime))
            .replace(/{prefix}/g, currentPrefix)
            .replace(/{lavalink}/g, lavalinkStatus)
            .replace(/{playing_tracks}/g, playingTracks);
        };

        const finalName = replacePlaceholders(activity.name);
        const finalState = replacePlaceholders(activity.state);
        const targetStatus = isSystemLagging
          ? "dnd"
          : activity.status || "online";

        client.user.setPresence({
          activities: [
            {
              name: finalName,
              state: finalState || null,
              type: activity.type,
              url: activity.url || null,
            },
          ],
          status: targetStatus,
        });

        currentIndex = (currentIndex + 1) % activities.length;
      }, 15000); // Berganti setiap 15 detik

      console.log(
        "\x1b[45m\x1b[37m ✨ PRESENCE \x1b[0m \x1b[35mRotasi status Naura berhasil diaktifkan.\x1b[0m",
      );
    } else {
      console.log(
        "\x1b[43m\x1b[30m ⚠️ PRESENCE \x1b[0m \x1b[33mTidak ada daftar status yang ditemukan di konfigurasi bot-activity.js.\x1b[0m",
      );
    }
  },
};
