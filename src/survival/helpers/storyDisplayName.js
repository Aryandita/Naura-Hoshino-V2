"use strict";

const { escapeMarkdown } = require("discord.js");

function resolveStoryDisplayName(interaction) {
  const member = interaction?.guildId ? interaction.member : null;
  const raw =
    member?.displayName ||
    member?.nick ||
    interaction?.user?.globalName ||
    interaction?.user?.username ||
    "Petualang";
  const cleaned = String(raw)
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned || "Petualang")
    .slice(0, 32)
    .join("")
    .replace(/@/g, "@\u200b");
}

function replaceStoryPlayer(text, name, markdown = true) {
  if (typeof text !== "string") return text;
  const safe = markdown ? escapeMarkdown(name) : name;
  return text.replace(/\[Player\]|\{player\}/gi, () => safe);
}

module.exports = { resolveStoryDisplayName, replaceStoryPlayer };
