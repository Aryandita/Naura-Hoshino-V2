const { Events, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const path = require("node:path");
const fs = require("node:fs");
const StickyRole = require("../models/StickyRole");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");
const ui = require("../config/ui");
const guildSettingsService = require("../managers/guildSettingsService");

const { generateWelcomeImage } = require("../canvas/CanvasUtils");

// Membaca kolom roles yang bisa berupa JSON, string JSON, atau data rusak.
function parseRoles(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function assignableRoles(member, ids) {
  const me = member.guild.members.me;
  if (!me) return [];
  const ceiling = me.roles.highest.position;
  return ids.filter((id) => {
    const role = member.guild.roles.cache.get(id);
    return (
      role &&
      role.position < ceiling &&
      !role.managed &&
      role.id !== member.guild.id
    );
  });
}

async function applyAutoRole(member, settings) {
  if (!settings.autoRole) return;
  const valid = assignableRoles(member, [settings.autoRole]);
  if (valid.length === 0) return;
  await member.roles
    .add(valid)
    .catch((err) =>
      logger.warn(
        `[AutoRole] Gagal memberi role ke ${member.user.tag}: ${err.message}`,
      ),
    );
}

async function applyStickyRoles(member, settings) {
  if (!settings.sticky_roles) return;
  const stickyData = await StickyRole.findOne({
    where: { guildId: member.guild.id, userId: member.user.id },
  });
  if (!stickyData) return;

  const valid = assignableRoles(member, parseRoles(stickyData.roles));
  if (valid.length === 0) return;

  await member.roles
    .add(valid)
    .catch((err) =>
      logger.warn(`[StickyRoles] Gagal memberi role: ${err.message}`),
    );
  logger.info(`[StickyRoles] Role dipulihkan untuk ${member.user.tag}`);
}

function renderMessage(template, member) {
  let text = (template || "Selamat datang {member}!")
    .replace(/\{member\}/g, `<@${member.id}>`)
    .replace(/\{user\}/g, member.user.username)
    .replace(/\{guild\}/g, member.guild.name)
    .replace(/\{count\}/g, member.guild.memberCount);

  // Sisa placeholder dicoba dipetakan ke emoji Naura; yang tidak dikenal
  // dibiarkan apa adanya agar teks admin tidak hilang.
  text = text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const emoji = ui.getEmoji(key.toLowerCase());
    return emoji || match;
  });

  return text;
}

async function sendWelcome(member, settings) {
  const welcome = settings.greetings && settings.greetings.welcome;
  if (!welcome || !welcome.enabled || !welcome.channelId) return;

  const channel = member.guild.channels.cache.get(welcome.channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(welcome.color || ui.getColor("welcome"))
    .setDescription(renderMessage(welcome.message, member));

  const payload = { embeds: [embed] };

  if (welcome.image) {
    try {
      const bgUrl = welcome.background || ui.getBackground("welcome");
      const buffer = await generateWelcomeImage(
        member,
        "welcome",
        ui,
        bgUrl,
        welcome,
      );
      payload.files = [new AttachmentBuilder(buffer, { name: "welcome.png" })];
      embed.setImage("attachment://welcome.png");
    } catch (err) {
      // Gambar gagal dirender bukan alasan untuk membatalkan sambutan.
      logger.error("[Welcomer Image Error]", err);
    }
  }

  if (welcome.attachAudio) {
    const langCode = settings?.language === "en" ? "EN" : "ID";
    const audioFilePath = path.join(
      __dirname,
      `../../assets/audio/Server Join (${langCode}).mp3`,
    );
    if (fs.existsSync(audioFilePath)) {
      if (!payload.files) payload.files = [];
      payload.files.push(
        new AttachmentBuilder(audioFilePath, {
          name: `Welcome_${langCode}.mp3`,
        }),
      );
    }
  }

  await channel
    .send(payload)
    .catch((err) => logger.error("[Welcomer Send Error]", err));
}

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.user.bot) return;

    let settings;
    try {
      const data = await cacheManager.getGuildSettings(member.guild.id);
      settings = data && data.settings ? data.settings : null;
    } catch (error) {
      logger.error(
        `[GuildMemberAdd] Gagal memuat pengaturan: ${error.message}`,
      );
      return;
    }
    if (!settings) return;

    // --- ANTI-RAID SYSTEM ---
    if (settings.antiRaid && settings.antiRaid.enabled) {
      const redisManager = require("../managers/redisManager");
      const now = Date.now();
      const timeWindow = (settings.antiRaid.seconds || 10) * 1000;
      const threshold = settings.antiRaid.joins || 5;

      const redisKey = `raid:joins:${member.guild.id}`;
      let record = await redisManager.getCache(redisKey);

      if (!record || now - record.windowStart > timeWindow) {
        record = { count: 0, windowStart: now };
      }
      record.count += 1;

      // Store in redis with TTL matching timeWindow (plus a little buffer)
      await redisManager.setCache(
        redisKey,
        record,
        Math.ceil(timeWindow / 1000) + 5,
      );

      if (record.count >= threshold) {
        // LOCKDOWN ACTIVATED
        settings.antiRaid.lockdown = true;
        await guildSettingsService.updateGuildSetting(
          member.guild.id,
          "antiRaid",
          settings.antiRaid,
        );
        logger.warn(
          `[Anti-Raid] Server ${member.guild.name} telah dikunci otomatis karena terdeteksi raid!`,
        );
        await redisManager.client.del(redisKey); // Reset
      }
    }

    // Jika sedang lockdown, usir/kick otomatis member baru ini
    if (settings.antiRaid && settings.antiRaid.lockdown) {
      try {
        await member
          .send(
            `Maaf, server **${member.guild.name}** sedang dalam status Lockdown karena sistem Anti-Raid. Coba bergabung lagi nanti!`,
          )
          .catch(() => {});
        await member.kick("Auto-Kick: Server dalam status Lockdown Anti-Raid");
        logger.info(
          `[Anti-Raid] Mengeluarkan ${member.user.tag} karena lockdown aktif.`,
        );
      } catch (err) {
        logger.error(
          `[Anti-Raid] Gagal mengusir ${member.user.tag} saat lockdown: ${err.message}`,
        );
      }
      return; // Jangan lanjutkan welcome / autorole
    }

    // Ketiga tahap berjalan terpisah. Kegagalan satu tahap tidak boleh
    // menghapus tahap berikutnya, terutama sambutan yang paling terlihat.
    const stages = [
      ["AutoRole", applyAutoRole],
      ["StickyRoles", applyStickyRoles],
      ["Welcomer", sendWelcome],
    ];

    for (const [label, stage] of stages) {
      try {
        await stage(member, settings);
      } catch (error) {
        logger.error(`[GuildMemberAdd:${label}] ${error.message}`);
      }
    }
  },
};
