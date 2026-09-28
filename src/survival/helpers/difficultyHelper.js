const DIFFICULTY_CONFIGS = {
  Mudah: { expMultiplier: 1.15, coinMultiplier: 1.05, drainMultiplier: 0.9, extreme: false },
  Normal: { expMultiplier: 1.1, coinMultiplier: 1.03, drainMultiplier: 0.95, extreme: false },
  Sulit: { expMultiplier: 1.05, coinMultiplier: 1.025, drainMultiplier: 0.97, extreme: false },
  Ekstrim: { expMultiplier: 0.8, coinMultiplier: 0.8, drainMultiplier: 1.2, extreme: true },
};

const DEFAULT_CONFIG = { expMultiplier: 1.0, coinMultiplier: 1.0, drainMultiplier: 1.0, extreme: false };

module.exports = {
  getDifficultyConfig(levelStr) {
    return DIFFICULTY_CONFIGS[levelStr] || DEFAULT_CONFIG;
  },
};
