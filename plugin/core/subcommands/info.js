"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { AttachmentBuilder } = require("discord.js");
const UserPet = require("../../../src/models/UserPet");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { e, createNavButtons } = require("../helpers/coreShared");

async function handleInfo(interaction, client, lang) {
  const eInfo = e("info", "\u2139\uFE0F");
  const eId = e("id", "\uD83C\uDD94");
  const eAdmin = e("admin", "\uD83D\uDC51");
  const eClock = e("clock", "\uD83D\uDCC5");
  const eUsers = e("users", "\uD83D\uDC65");
  const eBooster = e("booster", "\uD83C\uDF1F");
  const eReach = e("reach", "\uD83D\uDCC8");

  let title, thumbnailURL, fields;

  if (interaction.guild) {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const roleCount = guild.roles.cache.size;
    const channelCount = guild.channels.cache.size;

    const cleanTitle =
      (lang.INFO_SERVER_TITLE || "Server Info").replace(/^\u2139\uFE0F?\s*/, "");

    title = `${eInfo} ${cleanTitle} - ${guild.name}`;
    thumbnailURL = guild.iconURL({ size: 512, dynamic: true });
    fields = [
      { name: `${eId} Server ID`, value: `\`${guild.id}\`` },
      { name: `${eAdmin} Owner`, value: `${owner?.user?.tag || owner?.tag || "Unknown"}` },
      {
        name: `${eClock} Created At`,
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
      },
      {
        name: `${eUsers} Members [${guild.memberCount}]`,
        value: `Roles: ${roleCount} | Channels: ${channelCount}`,
      },
      {
        name: `${eBooster} Boosts`,
        value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount} Boosts)`,
      },
    ];
  } else {
    const cleanTitle =
      (lang.INFO_BOT_TITLE || "Bot Info").replace(/^\u2139\uFE0F?\s*/, "");

    title = `${eInfo} ${cleanTitle} - Naura Hoshino`;
    thumbnailURL = client.user?.displayAvatarURL?.({ size: 512 }) || null;
    fields = [
      { name: `${eId} Bot ID`, value: `\`${client.user?.id || "-"}\`` },
      { name: `${eAdmin} Developer`, value: "Aryandita" },
      {
        name: `${eClock} Created At`,
        value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:R>`,
      },
      {
        name: `${eReach} Reach`,
        value: `${client.guilds.cache.size} Servers | ${client.users.cache.size} Users`,
      },
    ];
  }

  const pet = await UserPet.findOne({
    where: { userId: interaction.user.id, isActive: true },
  });
  let petAttachment = null;

  if (pet) {
    const ePet = e("pet", "\uD83D\uDC3E");
    const imgPath = path.join(
      __dirname,
      "../../../assets/survival/pets",
      `${pet.petType}.png`,
    );
    if (fs.existsSync(imgPath)) {
      petAttachment = new AttachmentBuilder(imgPath, { name: "pet.png" });
    }

    fields.push({
      name: `─────────\n${ePet} Peliharaan Aktif`,
      value: `**Spesies:** ${String(pet.petType).toUpperCase()}\n**Level:** ${pet.petLevel || 1} | **Mood:** ${String(pet.mood || "normal").toUpperCase()}`,
    });
  }

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

  if (interaction.deferred || (interaction.editReply && !interaction.reply)) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = handleInfo;
