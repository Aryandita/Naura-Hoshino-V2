"use strict";

const COSMIC_GEMS = {
  RUBY_LIFESTEAL: {
    id: "RUBY_LIFESTEAL",
    name: "Crimson Blood Gem 💎",
    effect: "LIFESTEAL",
    value: 12,
    description: "+12% Pemulihan HP dari Total Serangan",
  },
  SAPPHIRE_CRIT: {
    id: "SAPPHIRE_CRIT",
    name: "Starlight Sapphire Gem 🔷",
    effect: "CRITICAL_BURST",
    value: 15,
    description: "+15% Peluang Serangan Kritis",
  },
  EMERALD_STAMINA: {
    id: "EMERALD_STAMINA",
    name: "Nebula Emerald Gem 🟢",
    effect: "STAMINA_CONSERVATION",
    value: 20,
    description: "+20% Penghematan Pengurangan Stamina",
  },
  AMETHYST_BOSS: {
    id: "AMETHYST_BOSS",
    name: "Void Amethyst Gem 🔮",
    effect: "BOSS_HUNTER",
    value: 25,
    description: "+25% Bonus Serangan Terhadap World Boss",
  },
};

class GemSocketEngine {
  getAvailableGems() {
    return COSMIC_GEMS;
  }

  getGemById(gemId) {
    return COSMIC_GEMS[gemId] || null;
  }

  /**
   * Memasang permata kosmik ke dalam soket gear/kartu
   */
  socketGem(targetItem, gemId) {
    const gem = this.getGemById(gemId);
    if (!gem) return { success: false, reason: "INVALID_GEM" };

    const sockets = Array.isArray(targetItem.cosmic_sockets)
      ? [...targetItem.cosmic_sockets]
      : [];

    const maxSockets = targetItem.maxSockets || 3;
    if (sockets.length >= maxSockets) {
      return { success: false, reason: "SOCKETS_FULL", maxSockets };
    }

    sockets.push({
      gemId: gem.id,
      gemName: gem.name,
      effect: gem.effect,
      value: gem.value,
      socketedAt: new Date().toISOString(),
    });

    return {
      success: true,
      updatedSockets: sockets,
      gem,
    };
  }

  /**
   * Melepas permata kosmik dari soket
   */
  extractGem(targetItem, socketIndex = 0) {
    const sockets = Array.isArray(targetItem.cosmic_sockets)
      ? [...targetItem.cosmic_sockets]
      : [];

    if (socketIndex < 0 || socketIndex >= sockets.length) {
      return { success: false, reason: "INVALID_SOCKET_INDEX" };
    }

    const removed = sockets.splice(socketIndex, 1)[0];
    return {
      success: true,
      removedGem: removed,
      updatedSockets: sockets,
    };
  }
}

module.exports = new GemSocketEngine();
