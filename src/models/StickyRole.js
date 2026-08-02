const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const StickyRole = sequelize.define('StickyRole', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    guildId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    roles: {
        // Menyimpan array role ID (karena sqlite tidak dukung array natively, kita simpan sebagai JSON string)
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '[]'
    }
}, {
    tableName: 'sticky_roles',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['guildId', 'userId'] }
    ]
});

module.exports = StickyRole;
