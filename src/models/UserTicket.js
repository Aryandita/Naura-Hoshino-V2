const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserTicket = sequelize.define(
  "UserTicket",
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
    ticketId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Channel ID / Thread ID tiket",
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("open", "closed"),
      defaultValue: "open",
    },
    transcriptPath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Path relatif file HTML transkrip di server",
    },
  },
  {
    tableName: "user_tickets",
    timestamps: true,
    indexes: [{ fields: ["userId"] }, { fields: ["guildId", "ticketId"] }],
  },
);

module.exports = UserTicket;
