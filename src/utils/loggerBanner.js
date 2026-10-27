"use strict";

/**
 * 🎨 Logger Banner Utility - Naura Hoshino V2
 * -------------------------------------------
 * Provides consistent colored banner formatting for log messages.
 * Eliminates inline ANSI escape codes throughout the codebase.
 *
 * @module src/utils/loggerBanner
 * @example
 * const { logWithBanner } = require('../utils/loggerBanner');
 *
 * // Instead of: logger.info(`\x1b[45m\x1b[37m 🎵 AUDIO \x1b[0m Message`);
 * // Use:
 * logWithBanner('info', '🎵 AUDIO', 'Registered 5 nodes');
 */

const { logger } = require("../managers/logger");

// ============================================================================
// ANSI COLOR CODES
// ============================================================================

/** ANSI escape codes for terminal colors */
const ANSI = {
  RESET: "\x1b[0m",
  BOLD: "\x1b[1m",

  // Background colors
  MAGENTA_BG: "\x1b[45m",
  BLUE_BG: "\x1b[44m",
  GREEN_BG: "\x1b[42m",
  YELLOW_BG: "\x1b[43m",
  RED_BG: "\x1b[41m",

  // Foreground colors
  WHITE_FG: "\x1b[37m",
  BLACK_FG: "\x1b[30m",
};

// ============================================================================
// BANNER FORMATTING FUNCTIONS
// ============================================================================

/**
 * Log a message with a colored banner prefix.
 * @param {'info'|'warn'|'error'|'debug'} level - Log level
 * @param {string} banner - Banner text (e.g., "🎵 AUDIO CLUSTER")
 * @param {string} message - Log message
 * @example
 * logWithBanner('info', '🎵 AUDIO CLUSTER', 'Registered 5 nodes');
 * // Output: [INFO] <MAGENTA_BG><WHITE_FG> 🎵 AUDIO CLUSTER </RESET> Registered 5 nodes
 */
function logWithBanner(level, banner, message) {
  const prefix = `${ANSI.MAGENTA_BG}${ANSI.WHITE_FG} ${banner} ${ANSI.RESET}`;
  if (typeof logger[level] === "function") {
    logger[level](`${prefix} ${message}`);
  } else {
    logger.info(`${prefix} ${message}`);
  }
}

/**
 * Create a custom banner string with specific colors.
 * @param {string} text - Banner text
 * @param {string} [bgColor=ANSI.MAGENTA_BG] - Background color code
 * @param {string} [fgColor=ANSI.WHITE_FG] - Foreground color code
 * @returns {string} Formatted banner string
 * @example
 * const banner = createBanner('⚠️ WARNING', ANSI.YELLOW_BG, ANSI.BLACK_FG);
 * logger.warn(`${banner} High memory usage detected`);
 */
function createBanner(text, bgColor = ANSI.MAGENTA_BG, fgColor = ANSI.WHITE_FG) {
  return `${bgColor}${fgColor} ${text} ${ANSI.RESET}`;
}

/**
 * Predefined banners for common use cases.
 */
const BANNERS = {
  AUDIO_CLUSTER: createBanner("🎵 AUDIO CLUSTER"),
  DATABASE: createBanner("💾 DATABASE", ANSI.BLUE_BG),
  CACHE: createBanner("⚡ CACHE", ANSI.GREEN_BG),
  WARNING: createBanner("⚠️ WARNING", ANSI.YELLOW_BG, ANSI.BLACK_FG),
  ERROR: createBanner("❌ ERROR", ANSI.RED_BG),
  SYSTEM: createBanner("🔧 SYSTEM"),
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  ANSI,
  logWithBanner,
  createBanner,
  BANNERS,
};
