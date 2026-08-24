"use strict";

const mongoose = require("mongoose");

const AiChatHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    guildId: { type: String, default: "" },
    persona: { type: String, default: "default" },
    role: { type: String, enum: ["user", "model", "system"], required: true },
    content: { type: String, required: true },
    parts: { type: Array, default: [] },
    tokens: { type: Number, default: 0 },
    metadata: { type: Object, default: {} },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 30, // Auto TTL: 30 hari
    },
  },
  {
    timestamps: true,
    collection: "ai_chat_histories",
  },
);

AiChatHistorySchema.index({ userId: 1, channelId: 1, createdAt: -1 });

module.exports =
  mongoose.models.AiChatHistory ||
  mongoose.model("AiChatHistory", AiChatHistorySchema);
