"use strict";

const PROGRESS_BAR_LENGTH = 10;
const FILLED_CHAR = "█";
const EMPTY_CHAR = "░";

class CooldownVisualizer {
  /**
   * Membuat progress bar string dari cooldown
   * @param {number} remainingMs - Sisa waktu cooldown dalam ms
   * @param {number} totalMs - Total durasi cooldown dalam ms
   * @param {object} options - Opsi tampilan
   * @returns {string}
   */
  static renderBar(remainingMs, totalMs, options = {}) {
    const length = options.length || PROGRESS_BAR_LENGTH;
    const filledChar = options.filledChar || FILLED_CHAR;
    const emptyChar = options.emptyChar || EMPTY_CHAR;

    if (totalMs <= 0) return emptyChar.repeat(length);
    if (remainingMs <= 0) return filledChar.repeat(length);

    const progress = Math.max(0, Math.min(1, 1 - remainingMs / totalMs));
    const filledCount = Math.round(progress * length);
    const emptyCount = length - filledCount;

    return filledChar.repeat(filledCount) + emptyChar.repeat(emptyCount);
  }

  /**
   * Format sisa waktu menjadi string human-readable
   * @param {number} ms
   * @returns {string}
   */
  static formatRemaining(ms) {
    if (ms <= 0) return "Ready";

    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Membangun objek tampilan cooldown lengkap untuk Components V2
   * @param {string} label - Nama skill/item
   * @param {number} remainingMs
   * @param {number} totalMs
   * @param {object} options
   * @returns {{ label: string, bar: string, remaining: string, ready: boolean }}
   */
  static buildCooldownDisplay(label, remainingMs, totalMs, options = {}) {
    const ready = remainingMs <= 0;
    return {
      label,
      bar: this.renderBar(remainingMs, totalMs, options),
      remaining: this.formatRemaining(remainingMs),
      ready,
      percentage: totalMs > 0 ? Math.round((1 - remainingMs / totalMs) * 100) : 100,
    };
  }

  /**
   * Membangun tampilan multi-cooldown untuk beberapa skill/item
   * @param {Array<{name: string, remainingMs: number, totalMs: number}>} cooldowns
   * @returns {string}
   */
  static buildMultiDisplay(cooldowns) {
    const lines = [];
    for (const cd of cooldowns) {
      const display = this.buildCooldownDisplay(cd.name, cd.remainingMs, cd.totalMs);
      lines.push(`**${display.label}** ${display.bar} ${display.remaining}`);
    }
    return lines.join("\n");
  }
}

module.exports = { CooldownVisualizer, PROGRESS_BAR_LENGTH };
