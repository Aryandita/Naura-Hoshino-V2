const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const ModMail = sequelize.define('ModMail', {
    // ID unik pengguna Discord
    userId: { 
        type: DataTypes.STRING, 
        primaryKey: true 
    },
    // ID server tujuan agar bot tahu pesan dikirim ke mana
    guildId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // ID Channel/Thread bantuan yang dibuat di server
    channelId: { 
        type: DataTypes.STRING, 
        unique: true 
    }, 
    // Status tiket (false = aktif, true = sudah ditutup)
    closed: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false 
    }
}, { 
    tableName: 'modmail_threads',
    timestamps: true // Menambahkan createdAt & updatedAt otomatis
});

module.exports = ModMail;