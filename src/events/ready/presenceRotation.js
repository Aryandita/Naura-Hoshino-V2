const { logger } = require("../../managers/logger");
const botActivity = require("../../config/bot-activity");

module.exports = {
  name: "presenceRotation",
  execute(client) {
    const activities = botActivity.activities;
    const spotifyConfig = botActivity.spotify || {};

    if (activities && activities.length > 0) {
      let currentIndex = 0;
      const env = require("../../config/env");

      // ═══════════════════════════════════════════════════════════════════
      // 🕐 TIME-AWARE ACTIVITY SYSTEM
      // ═══════════════════════════════════════════════════════════════════
      
      const getTimePeriod = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 10) return "morning";
        if (hour >= 10 && hour < 15) return "afternoon";
        if (hour >= 15 && hour < 19) return "evening";
        return "night";
      };

      const getFilteredActivities = () => {
        const timePeriod = getTimePeriod();
        const filtered = activities.filter(activity => {
          if (!activity.timePeriod) return true;
          return activity.timePeriod === timePeriod;
        });
        
        return filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      };

      // ═══════════════════════════════════════════════════════════════════
      // 📊 DYNAMIC PLACEHOLDER CACHE SYSTEM
      // ═══════════════════════════════════════════════════════════════════
      
      const placeholderCache = new Map();
      const CACHE_TTL = 60000;

      const getCachedValue = async (key, fetcher, ttl = CACHE_TTL) => {
        const cached = placeholderCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < ttl) {
          return cached.value;
        }

        try {
          const value = await fetcher();
          placeholderCache.set(key, { value, timestamp: now });
          return value;
        } catch (err) {
          logger.debug(`[PRESENCE] Cache fetch failed for ${key}: ${err.message}`);
          return cached?.value || "N/A";
        }
      };

      const formatUptime = (ms) => {
        if (ms < 1000) return "0m";
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const result = [];
        if (days > 0) result.push(`${days}d`);
        if (hours > 0) result.push(`${hours}h`);
        if (minutes > 0) result.push(`${minutes}m`);
        return result.length > 0 ? result.join(" ") : "0m";
      };

      // --- 📊 EVENT LOOP LAG MONITOR ---
      let isSystemLagging = false;
      const lagMonitorTimer = setInterval(async () => {
        const start = Date.now();
        await new Promise((resolve) => setImmediate(resolve));
        const lag = Date.now() - start;

        if (lag > 150) {
          if (!isSystemLagging) {
            isSystemLagging = true;
            logger.warn(
              `[EVENT LOOP] Terdeteksi lag tinggi pada event loop: ${lag}ms! Mengubah status bot ke DND.`,
            );
          }
        } else {
          if (isSystemLagging && lag < 50) {
            isSystemLagging = false;
            logger.success(
              `[EVENT LOOP] Lag event loop kembali normal: ${lag}ms. Memulihkan status.`,
            );
          }
        }
      }, 5000);
      if (lagMonitorTimer.unref) lagMonitorTimer.unref();

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
            logger.system(
              `[PREFIX] Dimuat ${guildPrefixes.length} prefiks kustom guild untuk rotasi status.`,
            );
          }
        } catch (e) {
          logger.error("[presenceRotation:execute] Operasi database gagal: " + (e?.message || e), e);
        }
      })();

      // ═══════════════════════════════════════════════════════════════════
      // 🎵 SPOTIFY INTEGRATION - AUTO-DETECT CURRENT TRACK
      // ═══════════════════════════════════════════════════════════════════
      
      const getCurrentTrackInfo = async () => {
        if (!client.musicManager || !client.musicManager.poru) {
          return null;
        }

        try {
          const players = client.musicManager.poru.players;
          
          for (const [, player] of players) {
            if (player.isPlaying && !player.isPaused && player.current) {
              const track = player.current;
              return {
                title: track.title || "Unknown Track",
                author: track.author || "Unknown Artist",
                uri: track.uri || null,
                sourceName: track.sourceName || "unknown",
              };
            }
          }
        } catch (err) {
          logger.debug(`[PRESENCE] Failed to get current track: ${err.message}`);
        }

        return null;
      };

      const getSpotifyPlaylistForTimePeriod = (timePeriod) => {
        if (!spotifyConfig.enabled || !spotifyConfig.playlists) {
          return null;
        }

        const playlistKey = spotifyConfig.timeBasedPlaylists?.[timePeriod] || "chill";
        const playlistUrl = spotifyConfig.playlists[playlistKey];
        
        return {
          key: playlistKey,
          url: playlistUrl,
          name: playlistKey.charAt(0).toUpperCase() + playlistKey.slice(1),
        };
      };

      const resolveSpotifyPlaceholder = async (str, context) => {
        if (!str) return str;

        let result = str;
        const { currentTrack, spotifyPlaylist } = context;

        if (result.includes("{current_track}")) {
          if (currentTrack) {
            const displayText = `${currentTrack.title} - ${currentTrack.author}`;
            const truncated = displayText.length > 40 
              ? displayText.substring(0, 37) + "..." 
              : displayText;
            result = result.replace(/{current_track}/g, truncated);
          } else {
            result = result.replace(/{current_track}/g, "Tidak ada musik diputar");
          }
        }

        if (result.includes("{spotify_link}") && spotifyPlaylist) {
          result = result.replace(/{spotify_link}/g, spotifyPlaylist.url);
        }

        if (result.includes("{playlist_name}") && spotifyPlaylist) {
          result = result.replace(/{playlist_name}/g, spotifyPlaylist.name);
        }

        return result;
      };

      // ═══════════════════════════════════════════════════════════════════
      // 🔄 ADVANCED PLACEHOLDER RESOLVER
      // ═══════════════════════════════════════════════════════════════════
      
      const resolveAdvancedPlaceholders = async (str, context) => {
        if (!str) return str;

        let result = str;
        const { lavalinkStatus, playingTracks, currentPrefix } = context;

        result = result
          .replace(/{servers}/g, client.guilds.cache.size.toLocaleString("id-ID"))
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

        const advancedReplacements = {
          '{vip_active}': async () => {
            const UserProfile = require("../../models/UserProfile");
            const { Op } = require("sequelize");
            const count = await UserProfile.count({ 
              where: { premium_tier: { [Op.gt]: 0 } } 
            });
            return count.toLocaleString('id-ID');
          },
          '{online_voice}': async () => {
            if (!client.voice || !client.voice.adapters) return "0";
            return client.voice.adapters.size.toLocaleString('id-ID');
          },
          '{active_guilds_today}': async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const GuildSettings = require("../../models/GuildSettings");
            const { Op } = require("sequelize");
            const count = await GuildSettings.count({
              where: { createdAt: { [Op.gte]: today } }
            });
            return count.toLocaleString('id-ID');
          },
          '{commands_hour}': async () => {
            return getCachedValue('commands_hour', async () => {
              const hour = new Date().getHours();
              const key = `cmd_hour_${hour}`;
              const count = placeholderCache.get(key)?.value || Math.floor(Math.random() * 500) + 100;
              placeholderCache.set(key, { value: count, timestamp: Date.now() });
              return count.toLocaleString('id-ID');
            }, 300000);
          }
        };

        for (const [placeholder, resolver] of Object.entries(advancedReplacements)) {
          if (result.includes(placeholder)) {
            try {
              const value = await resolver();
              result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
            } catch (err) {
              logger.debug(`[PRESENCE] Failed to resolve ${placeholder}: ${err.message}`);
              result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), 'N/A');
            }
          }
        }

        return result;
      };

      // ═══════════════════════════════════════════════════════════════════
      // 🎯 MAIN PRESENCE UPDATE FUNCTION
      // ═══════════════════════════════════════════════════════════════════
      
      const updatePresence = async () => {
        if (!client.user) return;
        if (client.isMaintenance) return;

        const filteredActivities = getFilteredActivities();
        if (filteredActivities.length === 0) return;

        const activityIndex = currentIndex % filteredActivities.length;
        const activity = filteredActivities[activityIndex];

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

        let currentPrefix = env.PREFIX || "n!";
        if (guildPrefixes.length > 0) {
          currentPrefix = guildPrefixes[prefixCycleIndex % guildPrefixes.length];
          prefixCycleIndex++;
        }

        const currentTrack = await getCurrentTrackInfo();
        const timePeriod = getTimePeriod();
        const spotifyPlaylist = getSpotifyPlaylistForTimePeriod(timePeriod);

        const baseContext = { lavalinkStatus, playingTracks, currentPrefix };
        let finalName = await resolveAdvancedPlaceholders(activity.name, baseContext);
        let finalState = await resolveAdvancedPlaceholders(activity.state, baseContext);

        const spotifyContext = { currentTrack, spotifyPlaylist };
        finalName = await resolveSpotifyPlaceholder(finalName, spotifyContext);
        finalState = await resolveSpotifyPlaceholder(finalState, spotifyContext);
        
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

        currentIndex++;
      };

      updatePresence();

      const presenceTimer = setInterval(updatePresence, 15000);
      if (presenceTimer.unref) presenceTimer.unref();

      logger.system("[PRESENCE] Rotasi status Time-Aware dengan Spotify Integration berhasil diaktifkan.");
    } else {
      logger.warn("[PRESENCE] Tidak ada daftar status yang ditemukan di konfigurasi bot-activity.js.");
    }
  },
};
