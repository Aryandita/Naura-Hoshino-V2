module.exports = {
    getDifficultyConfig(levelStr) {
        switch (levelStr) {
            case 'Mudah':
                return { expMultiplier: 1.15, coinMultiplier: 1.05, drainMultiplier: 0.90, extreme: false };
            case 'Normal':
                return { expMultiplier: 1.10, coinMultiplier: 1.03, drainMultiplier: 0.95, extreme: false };
            case 'Sulit':
                return { expMultiplier: 1.05, coinMultiplier: 1.025, drainMultiplier: 0.97, extreme: false };
            case 'Ekstrim':
                return { expMultiplier: 0.80, coinMultiplier: 0.80, drainMultiplier: 1.20, extreme: true };
            default:
                return { expMultiplier: 1.00, coinMultiplier: 1.00, drainMultiplier: 1.00, extreme: false };
        }
    }
};
