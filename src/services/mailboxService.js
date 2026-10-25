"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

const MAIL_EXPIRY_MS = 604800000;
const MAX_MAILBOX_SIZE = 50;

class MailboxService {
  /**
   * Kirim mail ke player (cross-guild)
   * @param {object} mail - { senderId, senderName, recipientId, subject, body, attachment }
   * @returns {Promise<{ ok: boolean, mailId?: string, reason?: string }>}
   */
  static async sendMail(mail) {
    try {
      const { senderId, recipientId, subject, body } = mail;

      if (!senderId || !recipientId) return { ok: false, reason: "INVALID_PARAMS" };
      if (senderId === recipientId) return { ok: false, reason: "SELF_MAIL_NOT_ALLOWED" };

      const recipientKey = `mailbox:${recipientId}`;
      const existingMails = await redisManager.lrange(recipientKey, 0, -1);
      const currentCount = existingMails ? existingMails.length : 0;

      if (currentCount >= MAX_MAILBOX_SIZE) {
        return { ok: false, reason: "MAILBOX_FULL" };
      }

      const mailId = `mail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const entry = {
        id: mailId,
        senderId,
        senderName: mail.senderName || "Unknown",
        subject: (subject || "Pesan").substring(0, 100),
        body: (body || "").substring(0, 2000),
        attachment: mail.attachment || null,
        sentAt: Date.now(),
        expiresAt: Date.now() + MAIL_EXPIRY_MS,
        read: false,
      };

      await redisManager.lpush(recipientKey, JSON.stringify(entry));
      await redisManager.ltrim(recipientKey, 0, MAX_MAILBOX_SIZE - 1);

      logger.info(`[Mailbox] ${senderId} -> ${recipientId}: "${entry.subject}"`);
      return { ok: true, mailId };
    } catch (error) {
      logger.error("[Mailbox] Send error:", error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  /**
   * Ambil inbox pemain
   * @param {string} userId
   * @param {object} options - { page, limit, unreadOnly }
   * @returns {Promise<{ mails: Array, total: number, unreadCount: number }>}
   */
  static async getInbox(userId, options = {}) {
    try {
      const key = `mailbox:${userId}`;
      const rawList = await redisManager.lrange(key, 0, -1);
      const now = Date.now();

      let mails = rawList.map((raw) => JSON.parse(raw)).filter((m) => m && m.expiresAt > now);

      if (options.unreadOnly) {
        mails = mails.filter((m) => !m.read);
      }

      mails.sort((a, b) => b.sentAt - a.sentAt);

      const unreadCount = mails.filter((m) => !m.read).length;
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(20, Math.max(1, options.limit || 10));
      const start = (page - 1) * limit;

      return {
        mails: mails.slice(start, start + limit),
        total: mails.length,
        unreadCount,
      };
    } catch (error) {
      logger.error(`[Mailbox] Inbox error for ${userId}:`, error);
      return { mails: [], total: 0, unreadCount: 0 };
    }
  }

  /**
   * Tandai mail sebagai sudah dibaca
   * @param {string} userId
   * @param {string} mailId
   */
  static async markAsRead(userId, mailId) {
    try {
      const key = `mailbox:${userId}`;
      const rawList = await redisManager.lrange(key, 0, -1);
      let found = false;

      const updated = rawList.map((raw) => {
        const mail = JSON.parse(raw);
        if (mail.id === mailId) {
          mail.read = true;
          found = true;
        }
        return JSON.stringify(mail);
      });

      if (found) {
        await redisManager.del(key);
        for (const item of updated.reverse()) {
          await redisManager.lpush(key, item);
        }
      }

      return { ok: found };
    } catch (error) {
      logger.error("[Mailbox] MarkRead error:", error);
      return { ok: false };
    }
  }

  /**
   * Hapus mail
   * @param {string} userId
   * @param {string} mailId
   */
  static async deleteMail(userId, mailId) {
    try {
      const key = `mailbox:${userId}`;
      const rawList = await redisManager.lrange(key, 0, -1);

      const filtered = rawList.filter((raw) => {
        const mail = JSON.parse(raw);
        return mail.id !== mailId;
      });

      await redisManager.del(key);
      for (const item of filtered.reverse()) {
        await redisManager.lpush(key, item);
      }

      return { ok: true };
    } catch (error) {
      logger.error("[Mailbox] Delete error:", error);
      return { ok: false };
    }
  }
}

module.exports = { MailboxService, MAIL_EXPIRY_MS, MAX_MAILBOX_SIZE };
