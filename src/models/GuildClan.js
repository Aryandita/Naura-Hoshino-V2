const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const GuildClan = sequelize.define('GuildClan', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    leaderId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    guildId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    members: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    vault: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    bossHp: {
        type: DataTypes.INTEGER,
        defaultValue: 1000
    }
}, {
    tableName: 'GuildClans',
    timestamps: true
});

module.exports = GuildClan;
