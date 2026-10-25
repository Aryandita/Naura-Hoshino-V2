"use strict";

const { logger } = require("../managers/logger");
const canvasWorkerPool = require("../canvas/canvasWorkerPool");

const CARD_WIDTH = 600;
const CARD_HEIGHT = 300;

class WelcomeCardService {
  /**
   * Generate kartu sambutan untuk member baru
   * @param {object} options - { username, avatarUrl, guildName, memberCount, tagline }
   * @returns {Promise<{ ok: boolean, buffer?: Buffer, reason?: string }>}
   */
  static async generateWelcomeCard(options) {
    try {
      const {
        username = "New Member",
        avatarUrl = null,
        guildName = "Naura Hoshino",
        memberCount = 0,
        tagline = "Selamat datang di petualanganmu!",
      } = options;

      const renderData = {
        type: "welcome_card",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        username: username.substring(0, 32),
        avatarUrl,
        guildName: guildName.substring(0, 50),
        memberCount,
        tagline: tagline.substring(0, 100),
        backgroundColor: "#1a1a2e",
        accentColor: "#e94560",
        textColor: "#ffffff",
      };

      const buffer = await canvasWorkerPool.runTask("welcome_card", renderData);

      logger.info(`[WelcomeCard] Generated for ${username} in ${guildName}`);
      return { ok: true, buffer };
    } catch (error) {
      logger.error(`[WelcomeCard] Generation error:`, error);
      return { ok: false, reason: "RENDER_FAILED" };
    }
  }

  /**
   * Generate welcome card tanpa worker pool (fallback synchronous)
   * @param {object} options
   * @returns {{ ok: boolean, payload: object }}
   */
  static buildFallbackPayload(options) {
    const {
      username = "New Member",
      guildName = "Naura Hoshino",
      memberCount = 0,
      tagline = "Selamat datang di petualanganmu!",
    } = options;

    return {
      ok: true,
      payload: {
        title: `Selamat Datang, ${username}!`,
        description: `${tagline}\n\nServer: **${guildName}**\nMember ke-**${memberCount.toLocaleString("id-ID")}**`,
        color: 0xe94560,
        footer: "Bergabunglah dengan komunitas kami dan mulai petualanganmu!",
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Kirim kartu sambutan ke channel tertentu
   * @param {object} channel - Discord TextChannel
   * @param {object} member - GuildMember
   * @param {object} options
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  static async sendWelcome(channel, member, options = {}) {
    try {
      if (!channel || !member) {
        return { ok: false, reason: "INVALID_CHANNEL_OR_MEMBER" };
      }

      const cardOptions = {
        username: member.displayName || member.user.username,
        avatarUrl: member.displayAvatarURL({ size: 256 }),
        guildName: member.guild.name,
        memberCount: member.guild.memberCount,
        ...options,
      };

      const result = await this.generateWelcomeCard(cardOptions);

      if (result.ok && result.buffer) {
        const { AttachmentBuilder } = require("discord.js");
        const attachment = new AttachmentBuilder(result.buffer, { name: "welcome-card.png" });
        await channel.send({ files: [attachment] });
      } else {
        const fallback = this.buildFallbackPayload(cardOptions);
        await channel.send({ embeds: [fallback.payload] });
      }

      return { ok: true };
    } catch (error) {
      logger.error(`[WelcomeCard] Send error:`, error);
      return { ok: false, reason: "SEND_FAILED" };
    }
  }
}

module.exports = { WelcomeCardService, CARD_WIDTH, CARD_HEIGHT };
