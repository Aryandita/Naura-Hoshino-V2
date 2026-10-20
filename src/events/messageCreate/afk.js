"use strict";

/**
 * afk.js - Event Handler Notifikasi & Rangkuman Mention AFK
 *
 * Mengelola status AFK pengguna berbasis Discord Components V2:
 * 1. Memberi tahu pemanggil saat pengguna yang di-tag sedang AFK dan mencatat pesan (snippet, link, waktu).
 * 2. Menyambut pengguna saat kembali aktif dan menyajikan Rangkuman Mention (Digest) rapi dan bersih.
 *
 * Mematuhi aturan Components V2 dan bebas karakter em-dash (U+2014).
 */

const ui = require("../../config/ui");
const env = require("../../config/env");
const cacheManager = require("../../managers/cacheManager");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const { checkPremiumStatus } = require("../../premium/premiumHelper");
const { logger } = require("../../managers/logger");

const MAX_STORED_MENTIONS = 10;
const NOTICE_LIFETIME_MS = 10000;

/**
 * Memberi tahu pemanggil bahwa target sedang AFK dan mencatat riwayat mention.
 */
async function notifyMentionedAfk(message) {
  if (!message.mentions || message.mentions.users.size === 0) return;

  for (const mentioned of message.mentions.users.values()) {
    if (mentioned.id === message.author.id || mentioned.bot) continue;

    const profile = await cacheManager.getUserProfile(mentioned.id).catch(() => null);
    if (!profile || !profile.afk_reason) continue;

    const mentions = Array.isArray(profile.afk_mentions) ? [...profile.afk_mentions] : [];
    if (mentions.length < MAX_STORED_MENTIONS) {
      const snippet = message.cleanContent
        ? message.cleanContent.substring(0, 80).replace(/\n+/g, " ")
        : message.content.substring(0, 80).replace(/\n+/g, " ");

      await cacheManager
        .mutateUserProfileJson(mentioned.id, "afk_mentions", (current) => {
          const list = Array.isArray(current) ? [...current] : [];
          if (list.length < MAX_STORED_MENTIONS) {
            list.push({
              author: message.author.displayName || message.author.username,
              authorId: message.author.id,
              content: snippet,
              time: Date.now(),
              link: message.url,
            });
          }
          return list;
        })
        .catch(() => {});
    }

    const afkTime = profile.afk_timestamp ? new Date(profile.afk_timestamp).getTime() : Date.now();
    const since = `<t:${Math.floor(afkTime / 1000)}:R>`;

    const afkNoticePayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#38BDF8",
      authorName: "Pemberitahuan Status AFK",
      title: `💤 ${mentioned.displayName || mentioned.username} Sedang AFK`,
      description: [
        `Pengguna yang kamu panggil sedang istirahat sejak ${since}.`,
        ``,
        `> 📝 *"${profile.afk_reason}"*`,
        ``,
        `Naura telah mencatat panggilanmu dan akan menyajikan rangkumannya begitu dia kembali aktif!`,
      ].join("\n"),
      footerText: ui.getFooter("core"),
    });

    message
      .reply(afkNoticePayload)
      .then((sent) => setTimeout(() => sent?.delete().catch(() => null), NOTICE_LIFETIME_MS))
      .catch((err) => {
        logger.debug("[afk:notify] Gagal mengirim pesan notifikasi: " + (err?.message || err));
      });
  }
}

/**
 * Menyambut pengguna yang baru kembali dari masa AFK dan menyajikan Mention Digest.
 */
async function welcomeBack(message) {
  if (message.author.bot) return;

  const profile = await cacheManager.getUserProfile(message.author.id).catch(() => null);
  if (!profile || !profile.afk_reason) return;

  const isOwner = env.OWNER_IDS && env.OWNER_IDS.includes(message.author.id);
  const isPremium = await checkPremiumStatus(message.author.id).catch(() => false);
  const minutes = profile.afk_timestamp
    ? Math.max(1, Math.floor((Date.now() - new Date(profile.afk_timestamp).getTime()) / 60000))
    : 1;
  const mentions = Array.isArray(profile.afk_mentions) ? profile.afk_mentions : [];

  // Hapus status AFK secara atomik
  await Promise.all([
    cacheManager.updateUserProfile(message.author.id, {
      afk_reason: null,
      afk_timestamp: null,
    }),
    cacheManager.mutateUserProfileJson(message.author.id, "afk_mentions", () => []),
  ]).catch(() => {});

  let greeting = `Selamat datang kembali, <@${message.author.id}>! Naura sudah siap membantumu lagi.`;
  if (isOwner) {
    greeting = `Akhirnya kamu kembali, sayang! Naura kangen banget tau... sekarang Naura siap temani petualanganmu lagi!`;
  } else if (isPremium) {
    greeting = `Halo bestie VIP Naura! Selamat datang kembali <@${message.author.id}>, semoga waktu istirahatmu menyenangkan!`;
  }

  let digestText = "✨ *Tidak ada yang mencari atau me-mention tokomu selama kamu beristirahat.*";
  if (mentions.length > 0) {
    const list = mentions.slice(-10).map((m, idx) => {
      const timeStr = m.time ? `<t:${Math.floor(m.time / 1000)}:R>` : "Baru saja";
      const snippet = m.content ? `> *"${m.content}"*\n` : "";
      return `**${idx + 1}.** **${m.author}** (${timeStr})\n${snippet}🔗 [Buka Pesan Asli](${m.link})`;
    }).join("\n\n");

    digestText = `🔔 **RANGKUMAN MENTION (${mentions.length} Panggilan):**\n\n${list}`;
  }

  const welcomePayload = buildContainerV2({
    accentColorHex: ui.getColor("success") || "#10B981",
    authorName: `Status AFK Dinonaktifkan`,
    title: `👋 Selamat Datang Kembali!`,
    description: [
      greeting,
      `*(Kamu beristirahat selama ${minutes} menit)*`,
      ``,
      digestText,
    ].join("\n"),
    expression: "happy",
    footerText: ui.getFooter("core"),
  });

  // Pulihkan nama panggilan jika memiliki prefix [AFK]
  if (message.member && message.member.displayName && message.member.displayName.startsWith("[AFK]")) {
    const cleanNick = message.member.displayName.replace(/^\[AFK\]\s*/, "");
    await message.member.setNickname(cleanNick).catch(() => {});
  }

  message.reply(welcomePayload).catch((err) => {
    logger.debug("[afk:welcomeBack] Gagal mengirim pesan selamat datang: " + (err?.message || err));
  });
}

/**
 * Handler utama penanganan AFK pada messageCreate
 */
module.exports = async function handleAfk(message) {
  await notifyMentionedAfk(message);
  await welcomeBack(message);
  return false;
};
