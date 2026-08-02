const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserLeveling = sequelize.define('UserLeveling', {
    // ID unik untuk setiap baris di database
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // ID Discord dari user
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // ID dari Server Discord (karena sistem leveling bersifat lokal per-server)
    guildId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Jumlah XP yang dimiliki user di server tersebut
    xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Level user di server tersebut
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    // Jumlah pesan valid yang telah dikirim
    messageCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Waktu terakhir user mendapatkan XP (digunakan untuk sistem cooldown)
    lastActivity: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Poin tata krama yang ditampilkan pada kartu profil rank
    mannersPoint: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    }
}, {
    tableName: 'user_leveling',
    timestamps: false 
});

module.exports = UserLeveling;