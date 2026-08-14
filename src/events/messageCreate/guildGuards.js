const { PermissionFlagsBits } = require("discord.js");
const env = require("../../config/env");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");

const BAN_PURGE_SECONDS = 604800; // 7 hari

/**
 * Channel perangkap: siapa pun yang menulis di sini langsung diban, kecuali
 * pemilik server dan pengurus.
 *
 * @returns {Promise<boolean>} true bila pelakunya sudah ditindak.
 */
async function softbanTrap(message, currentSet) {
  const trapId =
    currentSet.softbanChannelId ||
    currentSet.honeypotChannelId ||
    currentSet.automod?.softbanChannelId;

  if (!trapId || message.channel.id !== trapId) return false;

  const isOwner =
    message.guild.ownerId === message.author.id ||
    env.OWNER_IDS.includes(message.author.id);
  const isAdmin =
    message.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    message.member?.permissions?.has(PermissionFlagsBits.ManageGuild);

  if (isOwner || isAdmin) return false;

  await message.delete().catch(() => {});

  const reason = "Naura Security: memicu channel perangkap scammer";
  await message.member
    .ban({ reason, deleteMessageSeconds: BAN_PURGE_SECONDS })
    .catch(async () => {
      await message.member.kick(reason).catch(() => {});
    });

  const logChannelId = currentSet.automod?.logChannel || message.channel.id;
  const logChannel = message.guild.channels.cache.get(logChannelId);
  if (logChannel) {
    const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
    await logChannel
      .send(
        buildContainerV2({
          accentColorHex: ui.getColor("error") || "#FF0000",
          authorName: "Naura Anti-Scammer Governance",
          title: "Scammer tertangkap dan langsung diban",
          expression: "hmph",
          description:
            `**Pengguna:** ${message.author.tag} (\`${message.author.id}\`)\n` +
            `**Channel perangkap:** <#${message.channel.id}>\n` +
            "**Tindakan:** diban otomatis, pesan 7 hari terakhir dibersihkan\n" +
            "**Sebab:** mengirim pesan di channel perangkap scammer.",
          footerText: ui.getFooter("core"),
        }),
      )
      .catch(() => {});
  }

  logger.info(
    `[Scammer Trap] Ban ${message.author.tag} (${message.author.id}) di ${message.guild.name}`,
  );
  return true;
}

/** Meneruskan obrolan Discord ke server Minecraft lewat RCON. */
async function minecraftBridge(message, settings) {
  const mc = settings?.settings?.minecraft;
  if (!mc || !mc.bridgeEnabled || mc.bridgeChannelId !== message.channel.id)
    return;

  const Rcon = require("../../utils/rcon");
  const rcon = new Rcon(
    mc.ip || "localhost",
    mc.rconPort || 25575,
    mc.rconPassword || "",
  );

  const cleanUser = message.author.username.replace(/"/g, '\\"');
  let cleanText = message.content.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  if (message.attachments.size > 0) {
    cleanText += ` ${message.attachments.map((a) => `[${a.name}]`).join(" ")}`;
  }

  const command = `tellraw @a [{"text":"[","color":"blue"},{"text":"Discord","color":"aqua","bold":true},{"text":"] ","color":"blue"},{"text":"${cleanUser}: ","color":"yellow"},{"text":"${cleanText}","color":"white"}]`;

  try {
    await rcon.execute(command);
  } catch (err) {
    logger.error("[Minecraft Bridge] Gagal mengirim lewat RCON:", err.message);
  } finally {
    rcon.disconnect();
  }
}

module.exports = { softbanTrap, minecraftBridge };
