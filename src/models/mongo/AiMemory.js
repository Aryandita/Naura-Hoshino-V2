"use strict";

const mongoose = require("mongoose");

const AiMemorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    nickname: { type: String, default: "" },
    musicPrefs: { type: [String], default: [] },
    facts: { type: [String], default: [] },
    summary: { type: String, default: "" },
    lastInteraction: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "ai_memories",
  },
);

module.exports =
  mongoose.models.AiMemory || mongoose.model("AiMemory", AiMemorySchema);
