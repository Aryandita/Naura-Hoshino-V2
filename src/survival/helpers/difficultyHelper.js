module.exports = {
  getDifficultyConfig(levelStr) {
    switch (levelStr) {
      case "Mudah":
        return {
          expMultiplier: 1.15,
          coinMultiplier: 1.05,
          drainMultiplier: 0.9,
          extreme: false,
        };
      case "Normal":
        return {
          expMultiplier: 1.1,
          coinMultiplier: 1.03,
          drainMultiplier: 0.95,
          extreme: false,
        };
      case "Sulit":
        return {
          expMultiplier: 1.05,
          coinMultiplier: 1.025,
          drainMultiplier: 0.97,
          extreme: false,
        };
      case "Ekstrim":
        return {
          expMultiplier: 0.8,
          coinMultiplier: 0.8,
          drainMultiplier: 1.2,
          extreme: true,
        };
      default:
        return {
          expMultiplier: 1.0,
          coinMultiplier: 1.0,
          drainMultiplier: 1.0,
          extreme: false,
        };
    }
  },
};
