"use strict";

const mongoose = require("mongoose");

const CapsuleParticipantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  note: { type: String, maxlength: 100 },
  timestamp: { type: Date, default: Date.now },
});

const TimeCapsuleSchema = new mongoose.Schema(
  {
    capsuleCode: { type: String, required: true, unique: true, index: true },
    guildId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 1000 },
    buryDate: { type: Date, default: Date.now },
    unlockDate: { type: Date, required: true, index: true },
    isUnlocked: { type: Boolean, default: false },
    unlockedAt: { type: Date, default: null },
    participants: [CapsuleParticipantSchema],
    aiNostalgiaSummary: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.models.TimeCapsule || mongoose.model("TimeCapsule", TimeCapsuleSchema);
