"use strict";

/**
 * ℹ️ Info Command - Server/Bot Information - Naura Hoshino V2
 * ------------------------------------------------------------
 * Displays comprehensive information about current server or bot.
 * Automatically detects context (guild vs DM) and shows relevant data.
 *
 * Features:
 * - Server info: ID, owner, creation date, members, boosts
 * - Bot info: ID, developer, reach statistics
 * - Active pet display with image attachment
 * - Dynamic thumbnail and banner support
 *
 * @module plugin/core/subcommands/info
 */

const fs = require("node:fs");
const path = require("node:path");
const { AttachmentBuilder } = require("discord.js");
const UserPet = require("../../../src/models/UserPet");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { e, createNavButtons } = require("../helpers/coreShared");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build server information fields.
 * @param {object} guild - Discord guild object
 * @param {object} lang - Language dictionary
 * @param {object} emojis - Emoji map
 * @returns {Promise<Array>} Array of field objects
 */
async function buildServerFields(guild, lang, emojis) {
  const owner = await guild.fetchOwner().catch(() => null);
  const roleCount = guild.roles.cache.size;
  const channelCount = guild.channels.cache.size;

  return [
    { name: `${emojis.id} Server ID`, value: `\`${guild.id}\`` },
    { name: `${emojis.admin} Owner`, value: `${owner?.user?.tag || owner?.tag || "Unknown"}` },
    {
      name: `${emojis.clock} Created At`,
      value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
    },
    {
      name: `${emojis.users} Members [${guild.memberCount}]`,
      value: `Roles: ${roleCount} | Channels: ${channelCount}`,
    },
    {
      name: `${emojis.booster} Boosts`,
      value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount} Boosts)`,
    },
  ];
}

/**
 * Build bot information fields.
 * @param {object} client - Discord client
 * @param {object} emojis - Emoji map
 * @returns {Array} Array of field objects
 */
function buildBotFields(client, emojis) {
  return [
    { name: `${emojis.id} Bot ID`, value: `\`${client.user?.id || "-"}\`` },
    { name: `${emojis.admin} Developer`, value: "Aryandita" },
    {
      name: `${emojis.clock} Created At`,
      value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:R>`,
    },
    {
      name: `${emojis.reach} Reach`,
      value: `${client.guilds.cache.size} Servers | ${client.users.cache.size} Users`,
    },
  ];
}

/**
 * Load active pet attachment if exists.
 * @param {string} userId - User ID
 * @returns {Promise<{attachment: AttachmentBuilder|null, pet: object|null}>}
 */
async function loadActivePet(userId) {
  const pet = await UserPet.findOne({
    where: { userId, isActive: true },
  });

  if (!pet) return { attachment: null, pet: null };

  const imgPath = path.join(
    __dirname,
    "../../../assets/survival/pets",
    `${pet.petType}.png`,
  );

  const attachment = fs.existsSync(imgPath)
    ? new AttachmentBuilder(imgPath, { name: "pet.png" })
    : null;

  return { attachment, pet };
}

/**
 * Build pet information field.
 * @param {object} pet - Pet model instance
 * @param {string} petEmoji - Pet emoji
 * @returns {object} Field object
 */
function buildPetField(pet, petEmoji) {
  return {
    name: `─────────\n${petEmoji} Peliharaan Aktif`,
    value: `**Spesies:** ${String(pet.petType).toUpperCase()}\n**Level:** ${pet.petLevel || 1} | **Mood:** ${String(pet.mood || "normal").toUpperCase()}`,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle /core info command execution.
 * Displays server or bot information based on context.
 * @param {object} interaction - Discord interaction
 * @param {object} client - Discord client
 * @param {object} lang - Language dictionary
 * @returns {Promise<void>}
 */
async function handleInfo(interaction, client, lang) {
  // Get emojis
  const emojis = {
    info: e("info", "ℹ️"),
    id: e("id", "🆔"),
    admin: e("admin", "👑"),
    clock: e("clock", "📅"),
    users: e("users", "👥"),
    booster: e("booster", "🌟"),
    reach: e("reach", "📈"),
    pet: e("pet", "🐾"),
  };

  let title, thumbnailURL, fields;

  // Determine context: server or DM
  if (interaction.guild) {
    // Server context
    const guild = interaction.guild;
    const cleanTitle = (lang.INFO_SERVER_TITLE || "Server Info").replace(/^ℹ️?\s*/, "");

    title = `${emojis.info} ${cleanTitle} - ${guild.name}`;
    thumbnailURL = guild.iconURL({ size: 512, dynamic: true });
    fields = await buildServerFields(guild, lang, emojis);
  } else {
    // DM/Bot context
    const cleanTitle = (lang.INFO_BOT_TITLE || "Bot Info").replace(/^ℹ️?\s*/, "");

    title = `${emojis.info} ${cleanTitle} - Naura Hoshino`;
    thumbnailURL = client.user?.displayAvatarURL?.({ size: 512 }) || null;
    fields = buildBotFields(client, emojis);
  }

  // Load active pet if any
  const { attachment: petAttachment, pet } = await loadActivePet(interaction.user.id);

  if (pet) {
    fields.push(buildPetField(pet, emojis.pet));
  }

  // Build payload
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Info System",
    title,
    iconURL: thumbnailURL,
    fields,
    bannerAttachmentName: petAttachment ? "pet.png" : null,
    buttonsRow: createNavButtons(),
    footerText: ui.getFooter("core"),
  });

  if (petAttachment) {
    payload.files = [petAttachment];
  }

  // Send response
  if (interaction.deferred || (interaction.editReply && !interaction.reply)) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = handleInfo;
