const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserFarm = sequelize.define('UserFarm', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    slotIndex: { type: DataTypes.INTEGER, allowNull: false }, // Lahan ke-1 sampai ke-5
    seedId: { type: DataTypes.STRING, allowNull: true },      // ID benih yang ditanam
    plantedDay: { type: DataTypes.INTEGER, allowNull: true }, // Hari ke berapa ditanam
    readyDay: { type: DataTypes.INTEGER, allowNull: true }    // Hari ke berapa siap panen
});

module.exports = UserFarm;