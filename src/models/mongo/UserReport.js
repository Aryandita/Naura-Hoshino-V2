"use strict";

const mongoose = require("mongoose");

const UserReportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    guildId: { type: String, default: null },
    guildName: { type: String, default: null },
    title: { type: String, required: true },
    description: { type: String, required: true },
    attachmentUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["PENDING", "INVESTIGATING", "RESOLVED"],
      default: "PENDING",
      index: true,
    },
    ownerReply: { type: String, default: null },
    repliedBy: { type: String, default: null },
    repliedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.UserReport || mongoose.model("UserReport", UserReportSchema);
