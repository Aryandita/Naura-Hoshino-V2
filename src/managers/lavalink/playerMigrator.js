"use strict";

/**
 * 🔄 Player Migrator - Lavalink Cluster - Naura Hoshino V2
 * ---------------------------------------------------------
 * Handles zero-drop player migration during node failures.
 * Implements dual-path strategy: moveNode API first, reconnect fallback.
 *
 * @module src/managers/lavalink/playerMigrator
 */

const { logger } = require("../logger");
const { logWithBanner } = require("../../utils/loggerBanner");

// ============================================================================
// PLAYER MIGRATOR CLASS
// ============================================================================

/**
 * Manages seamless audio player migration between Lavalink nodes.
 * Prevents duplicate migrations via guild-level locking.
 */
class PlayerMigrator {
  /**
   * @param {import('./nodeSelector').NodeSelector} nodeSelector - Node selector instance
   */
  constructor(nodeSelector) {
    this.nodeSelector = nodeSelector;

    /** @type {Set<string>} Guild IDs currently being migrated (lock set) */
    this.migrationLocks = new Set();
  }

  /**
   * Migrate active audio player to a healthy node seamlessly.
   * Attempts zero-drop migration via moveNode API first, falls back to reconnect.
   *
   * Migration Flow:
   * 1. Acquire guild lock (prevent duplicate migrations)
   * 2. Capture player snapshot (track, position, queue, volume)
   * 3. Select target node via nodeSelector
   * 4. Try moveNode API (zero-drop, preserves voice connection)
   * 5. Fallback to destroy + reconnect if moveNode fails
   * 6. Restore playback state and resume at exact position
   * 7. Release guild lock
   *
   * @param {object} poru - Poru instance
   * @param {object} player - Affected player object
   * @param {object} failedNode - Node that failed
   * @param {string} [reason='Node disconnect'] - Migration reason for logging
   * @returns {Promise<boolean>} True if migration succeeded
   */
  async migratePlayer(poru, player, failedNode, reason = "Node disconnect") {
    if (!player || !poru) return false;

    const guildId = player.guildId;

    // Prevent duplicate concurrent migrations for same guild
    if (this.migrationLocks.has(guildId)) return false;
    this.migrationLocks.add(guildId);

    try {
      logWithBanner(
        "warn",
        "🔄 AUDIO FAILOVER",
        `Starting migration for guild ${guildId} from node "${failedNode?.name || "Unknown"}" (${reason})...`,
      );

      // Step 1: Capture player state snapshot
      const snapshot = this._capturePlayerSnapshot(player);

      if (!snapshot.voiceChannel) {
        this.migrationLocks.delete(guildId);
        return false;
      }

      // Step 2: Select healthy target node
      const targetNodeName = this.nodeSelector.getPreferredNode(poru, {
        excludeNode: failedNode?.name,
      });

      if (!targetNodeName) {
        logger.error(
          `[PlayerMigrator] Migration failed: No available target node for guild ${guildId}.`,
        );
        this.migrationLocks.delete(guildId);
        return false;
      }

      logger.info(`✨ [PlayerMigrator] Moving guild ${guildId} to node "${targetNodeName}"...`);

      // Step 3: Try zero-drop migration via Poru moveNode API
      if (typeof player.moveNode === "function") {
        const success = await this._executeMoveNode(player, targetNodeName);
        if (success) {
          this.migrationLocks.delete(guildId);
          return true;
        }
        // moveNode failed, continue to fallback
      }

      // Step 4: Fallback to destroy + reconnect
      const success = await this._executeReconnect(poru, player, snapshot, targetNodeName);
      this.migrationLocks.delete(guildId);
      return success;
    } catch (err) {
      logger.error(`[PlayerMigrator] Exception during migration for guild ${guildId}:`, err);
      this.migrationLocks.delete(guildId);
      return false;
    }
  }

  /**
   * Capture current player state for restoration after migration.
   * @private
   * @param {object} player - Player object
   * @returns {PlayerSnapshot} Captured state
   */
  _capturePlayerSnapshot(player) {
    return {
      currentTrack: player.currentTrack,
      position: Math.max(0, player.position || 0),
      queueTracks: player.queue ? [...player.queue] : [],
      voiceChannel: player.voiceChannel,
      textChannel: player.textChannel,
      isLoop: player.loop,
      volume: player.volume,
      is24_7: player.is24_7 || false,
    };
  }

  /**
   * Attempt zero-drop migration via Poru's native moveNode API.
   * This preserves the voice connection and avoids audio interruption.
   * @private
   * @param {object} player - Player object
   * @param {string} targetNodeName - Target node identifier
   * @returns {Promise<boolean>} True if moveNode succeeded
   */
  async _executeMoveNode(player, targetNodeName) {
    try {
      await player.moveNode(targetNodeName);
      logWithBanner(
        "info",
        "✨ AUDIO MIGRATION",
        `Zero-drop migration successful via moveNode to "${targetNodeName}".`,
      );
      return true;
    } catch (moveErr) {
      logger.warn(
        `[PlayerMigrator] moveNode failed, using reconnect fallback: ${moveErr.message}`,
      );
      return false;
    }
  }

  /**
   * Fallback migration: destroy old player and create new one on target node.
   * Restores queue, volume, loop state, and resumes playback at exact position.
   * @private
   * @param {object} poru - Poru instance
   * @param {object} oldPlayer - Old player to destroy
   * @param {PlayerSnapshot} snapshot - Captured state to restore
   * @param {string} targetNodeName - Target node identifier
   * @returns {Promise<boolean>} True if reconnect succeeded
   */
  async _executeReconnect(poru, oldPlayer, snapshot, targetNodeName) {
    // Cleanup old player connection
    try {
      if (typeof oldPlayer.destroy === "function") {
        oldPlayer.destroy();
      }
    } catch (err) {
      logger.debug(`[PlayerMigrator:_executeReconnect] Destroy failed: ${err?.message || err}`);
    }

    // Create new player on target node
    const newPlayer = poru.createConnection({
      guildId: oldPlayer.guildId,
      voiceChannel: snapshot.voiceChannel,
      textChannel: snapshot.textChannel,
      deaf: true,
      node: targetNodeName,
    });

    if (!newPlayer) {
      return false;
    }

    // Restore player state
    newPlayer.volume = snapshot.volume;
    newPlayer.loop = snapshot.isLoop;
    if (snapshot.is24_7) {
      newPlayer.is24_7 = true;
    }

    // Restore queue
    if (snapshot.queueTracks.length > 0) {
      newPlayer.queue.add(snapshot.queueTracks);
    }

    // Resume playback at exact position
    if (snapshot.currentTrack) {
      newPlayer.queue.unshift(snapshot.currentTrack);
      await newPlayer.play({ startTime: snapshot.position });

      const trackTitle = snapshot.currentTrack.info?.title || "Track";
      const positionSec = Math.round(snapshot.position / 1000);
      logger.info(
        `✨ [PlayerMigrator] Resumed [${trackTitle}] at ${positionSec}s on node "${targetNodeName}".`,
      );
    }

    return true;
  }

  /**
   * Check if a guild is currently being migrated.
   * @param {string} guildId - Guild identifier
   * @returns {boolean} True if migration in progress
   */
  isMigrating(guildId) {
    return this.migrationLocks.has(guildId);
  }

  /**
   * Clear all migration locks.
   * Primarily used for testing or emergency reset.
   */
  clearAllLocks() {
    this.migrationLocks.clear();
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} PlayerSnapshot
 * @property {object|null} currentTrack - Currently playing track
 * @property {number} position - Playback position in milliseconds
 * @property {Array} queueTracks - Queued tracks array
 * @property {string} voiceChannel - Voice channel ID
 * @property {string} textChannel - Text channel ID
 * @property {boolean|number} isLoop - Loop mode (0=off, 1=track, 2=queue)
 * @property {number} volume - Volume level (0-1000)
 * @property {boolean} is24_7 - 24/7 standby mode flag
 */

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  PlayerMigrator,
};
