const { DataTypes } = require("sequelize");
const { sequelize } = require("../managers/dbManager");

const RoleLease = sequelize.define(
  "RoleLease",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    }
  },
  {
    tableName: "role_leases",
    timestamps: true,
    indexes: [
      {
        fields: ["expiresAt"],
      },
      {
        fields: ["guildId", "userId", "roleId"],
        unique: true
      }
    ],
  }
);

module.exports = RoleLease;
