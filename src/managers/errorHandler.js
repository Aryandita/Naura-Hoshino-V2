const { EmbedBuilder } = require("discord.js");
const { logger } = require("../managers/logger");
const env = require("../config/env");
const crypto = require("crypto");

const ERROR_DM_TTL_MS = 10 * 60 * 1000;
const ERROR_DM_DEDUP_MS = 60 * 1000;

// Error dedup map bersifat sementara dan dibersihkan berkala agar tidak tumbuh tanpa batas.
const lastErrorDMTimes = new Map();

// Cleanup Map secara berkala untuk mencegah memory leak (Rule 1.8).
// Hapus entry yang sudah lebih dari ERROR_DM_TTL_MS.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of lastErrorDMTimes.entries()) {
    if (now - ts > ERROR_DM_TTL_MS) lastErrorDMTimes.delete(key);
  }
}, ERROR_DM_TTL_MS);
if (cleanupTimer.unref) cleanupTimer.unref();

/**
 * Handle and log critical application errors, sending logs to the owner's DM
 * @param {Error} err - The error object
 * @param {string} type - The type of error
 * @param {import('discord.js').Client} client - The Discord client
 */
const sendErrorLog = async (err, type, client) => {
  logger.error(
    `\n\x1b[41m\x1b[37m 💥 ANTI-CRASH \x1b[0m \x1b[31m${type}\x1b[0m`,
  );
  console.error(err);

  // Integrasi Sentry
  if (env.SENTRY_DSN) {
    const Sentry = require("@sentry/node");
    Sentry.captureException(err, { tags: { type } });
  }

  const now = Date.now();
  const errString = String(err?.stack || err);
  const hash = crypto.createHash("md5").update(errString).digest("hex");
  const cacheKey = `${type}_${hash}`;
  const lastTime = lastErrorDMTimes.get(cacheKey) || 0;

  if (now - lastTime < ERROR_DM_DEDUP_MS) return;
  lastErrorDMTimes.set(cacheKey, now);

  // Integrasi Webhook (Lebih disarankan daripada spam DM)
  if (env.ERROR_WEBHOOK_URL) {
    try {
      const { WebhookClient } = require("discord.js");
      const webhook = new WebhookClient({ url: env.ERROR_WEBHOOK_URL });
      const errEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle(`⚠️ System Crash: ${type}`)
        .setDescription(
          `\`\`\`js\n${String(err?.stack || err).substring(0, 4000)}\n\`\`\``,
        )
        .setTimestamp();
      await webhook.send({
        embeds: [errEmbed],
        username: "Naura Crash Reporter",
      });
    } catch (webhookErr) {
      logger.error(
        "[Webhook] Failed to send error log to webhook.",
        webhookErr,
      );
    }
  }

  if (env.OWNER_IDS && env.OWNER_IDS.length > 0 && client) {
    try {
      const ownerId = env.OWNER_IDS[0];
      const owner = await client.users.fetch(ownerId).catch(() => null);

      if (owner) {
        const ui = require("../config/ui");
        const errEmbed = new EmbedBuilder()
          .setColor("#00FFFF")
          .setTitle(`⚠️ Naura Versi ${env.BOT_VERSION || "2.1.0"} - ${type}`)
          .setDescription(
            `\`\`\`js\n${String(err?.stack || err).substring(0, 4000)}\n\`\`\``,
          )
          .setFooter({ text: ui.getFooter("core") })
          .setTimestamp();

        await owner.send({ embeds: [errEmbed] }).catch(() => {});
      }
    } catch (e) {
      logger.error(
        "\x1b[41m\x1b[37m 💥 ERROR \x1b[0m \x1b[31mGagal mengirim log error ke DM Developer.\x1b[0m",
        e,
      );
    }
  }
};

/**
 * Attach crash handlers to process
 * @param {import('discord.js').Client} client - The Discord client
 */
const setupErrorHandlers = (client) => {
  process.on("unhandledRejection", (reason, promise) => {
    if (reason && reason.code === 10062) return;
    sendErrorLog(reason, "Unhandled Rejection", client);
  });

  process.on("uncaughtException", (err, origin) => {
    sendErrorLog(err, "Uncaught Exception", client);
  });
};

module.exports = { setupErrorHandlers, sendErrorLog };
