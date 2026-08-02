const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserSurvival = sequelize.define('UserSurvival', {
    userId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    starFragments: {
        type: DataTypes.INTEGER,
        defaultValue: 500 // Modal awal 500 Naura Star Fragments
    },
    hunger: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    thirst: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    hp: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    stamina: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    strength: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    agility: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    intelligence: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    luck: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    survival_xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    survival_level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    inGameDay: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    inGameHour: {
        type: DataTypes.INTEGER,
        defaultValue: 6
    },
    propertyId: {
        type: DataTypes.STRING,
        defaultValue: 'jalanan'
    },
    currentLocation: {
        type: DataTypes.STRING,
        defaultValue: 'jalanan'
    },
    vehicle: {
        type: DataTypes.STRING,
        allowNull: true
    },
    rpg_state: {
        type: DataTypes.JSON,
        defaultValue: { sick: false, tax_due: 0, house_seized: false, weather: 'cerah', weather_hour: 0, unlocked_recipes: [], failed_exams: 0, test_cd: 0 }
    },
    shop_purchases: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    shop_last_reset_day: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    }
}, {
    tableName: 'UserSurvivals',
    timestamps: true
});

module.exports = UserSurvival;
