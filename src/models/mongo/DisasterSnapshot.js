"use strict";

const mongoose = require("mongoose");

const disasterSnapshotSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["role_assignment", "channel_backup", "ban_list"],
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: false,
    collection: "disaster_snapshots",
  }
);

disasterSnapshotSchema.index({ guildId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("DisasterSnapshot", disasterSnapshotSchema);
