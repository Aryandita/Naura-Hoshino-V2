"use strict";

const vibeMonitor = require("../../ai/vibeMonitor");

module.exports = async function handleVibe(message) {
  if (!message.guild || message.author.bot) return false;
  await vibeMonitor.handleMessage(message);
  return false;
};
