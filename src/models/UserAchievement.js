const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserAchievement = sequelize.define('UserAchievement', {
    userId: {
        type: DataTypes.STRING(25),
        primaryKey: true,
        allowNull: false
    },
    unlockedAchievements: {
        type: DataTypes.JSON, // Array of strings (achievement IDs)
        defaultValue: []
    },
    activeTitle: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: 'user_achievements',
    timestamps: true
});

module.exports = UserAchievement;
