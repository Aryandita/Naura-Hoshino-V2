const cron = require("node-cron");
const { AttachmentBuilder } = require("discord.js");
const { Op, fn, col } = require("sequelize");
const { logger } = require("../managers/logger");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");
const GuildSettings = require("../models/GuildSettings");
const UserBirthday = require("../models/UserBirthday");
const canvasWorkerPool = require("../canvas/canvasWorkerPool");
const cacheManager = require("./cacheManager");
const { addItemsAtomic } = require("../survival/engines/inventoryHelper");

const clusterManager = require("./clusterManager");

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

/**
 * Membungkus task cron dengan proteksi mutex (hanya 1 eksekusi aktif bersamaan).
 * Memastikan flag selalu di-reset pada finally block agar tidak terjadi deadlock.
 * @param {Function} fn - Async task function
 * @returns {Function}
 */
/**
 * Helper deklaratif untuk mendaftarkan cron job dengan proteksi mutex,
 * penanganan error terisolasi, dan logging konsisten.
 * @param {string} name - Nama deskriptif cron job
 * @param {string} cronExp - Pola cron (node-cron expression)
 * @param {Function} taskFn - Fungsi async yang akan dijalankan
 * @param {object} [options] - Opsi konfigurasi
 * @param {boolean} [options.mutex=true] - Aktifkan proteksi mutex
 * @returns {cron.ScheduledTask}
 */
function runGuardedCronJob(name, cronExp, taskFn, options = {}) {
  const { mutex = true } = options;
  let isRunning = false;
  return cron.schedule(cronExp, async () => {
    if (mutex && isRunning) {
      logger.debug(`[Cron] Skip ${name}: eksekusi sebelumnya masih aktif.`);
      return;
    }
    if (mutex) isRunning = true;
    try {
      await taskFn();
    } catch (err) {
      logger.error(`[Cron] Gagal ${name}:`, err);
    } finally {
      if (mutex) isRunning = false;
    }
  });
}



/**
 * Helper mutasi JSON untuk menandai flag preferensi notifikasi terkirim (sent_*)
 * @param {string} flagKey
 * @returns {Function} Mutator function untuk cacheManager.mutateUserProfileJson
 */
function setNotifFlag(flagKey) {
  return (prefsObj) => {
    const obj = prefsObj && typeof prefsObj === "object" ? prefsObj : {};
    obj[flagKey] = true;
    return obj;
  };
}

module.exports = {
  init(client) {
    const isMasterShard = clusterManager.isMasterShard(client);
    if (!isMasterShard) {
      logger.info(
        `[Cron] Secondary Shard #${clusterManager.getShardIds(client)} active. Master scheduled tasks (Backup/QOTD/Giveaways) delegated to Shard #0.`,
      );
      return;
    }

    logger.info("[Cron] Initializing scheduled tasks on Master Shard #0...");

    // --- XP BUFFER FLUSH ---
    // Buffer XP sekarang di-handle langsung oleh plugin/leveling/xpBuffer.js secara internal

    // 0. Auto Backup Database - Runs every day at 02:00 AM
    runGuardedCronJob("Auto Backup Database", "0 2 * * *", async () => {
      logger.info("[Cron] Running Auto Backup Database...");
      const backupManager = require("./backupManager");
      await backupManager.runBackup();
    });

    // 0.1 Nightly AI Memory Reflection & Synthesis Engine - Runs every day at 03:00 AM
    runGuardedCronJob("Nightly AI Memory Reflection", "0 3 * * *", async () => {
      logger.info("[Cron] Running Nightly AI Memory Reflection & Synthesis...");
      const { service } = require("../ai/semanticMemoryService");
      await service.synthesizeDailyMemories();
      await service.pruneDuplicateMemories();
    });

    // 0.5 Tempban Expiration Check - Runs every minute
    runGuardedCronJob("Tempban Expiration Check", "* * * * *", async () => {
      const UserStrike = require("../models/UserStrike");
      const expiredTempbans = await UserStrike.findAll({
        where: {
          isTempBanned: true,
          tempbanExpiresAt: {
            [Op.lt]: new Date(),
          },
        },
      });

      for (const record of expiredTempbans) {
        if (!record.userId || !SNOWFLAKE_REGEX.test(String(record.userId)) || !record.guildId || !SNOWFLAKE_REGEX.test(String(record.guildId))) {
          record.isTempBanned = false;
          record.tempbanExpiresAt = null;
          await record.save({ fields: ["isTempBanned", "tempbanExpiresAt"] });
          continue;
        }
        const guild = await client.guilds.fetch(record.guildId).catch(() => null);
        if (guild) {
          await guild.members
            .unban(record.userId, "Masa Tempban selesai")
            .catch(() => {});
        }
        record.isTempBanned = false;
        record.tempbanExpiresAt = null;
        await record.save({ fields: ["isTempBanned", "tempbanExpiresAt"] });
      }
    });

    // 0.6 Daily Quest Reset: Menggunakan sistem lazy-evaluation di questGenerator.js saat
    // user bertindak atau membuka papan misi, sehingga tidak memerlukan cron aktif di sini.

    // 0.7 Role Lease Expiration Check - Runs every minute
    runGuardedCronJob("Role Lease Expiration Check", "* * * * *", async () => {
      const RoleLease = require("../models/RoleLease");
      const expiredLeases = await RoleLease.findAll({
        where: {
          expiresAt: {
            [Op.lt]: new Date(),
          },
        },
      });

      for (const lease of expiredLeases) {
        if (!lease.userId || !SNOWFLAKE_REGEX.test(String(lease.userId)) || !lease.guildId || !SNOWFLAKE_REGEX.test(String(lease.guildId))) {
          await lease.destroy();
          continue;
        }
        const guild = await client.guilds.fetch(lease.guildId).catch(() => null);
        if (guild) {
          const member = await guild.members
            .fetch(lease.userId)
            .catch(() => null);
          if (member) {
            await member.roles
              .remove(lease.roleId, "Masa sewa role selesai")
              .catch(() => {});
          }
        }
        await lease.destroy();
      }
    });

    // 0.75 Survival Periodic Vital Decay - Runs every 30 minutes
    runGuardedCronJob("Survival Vital Decay", "*/30 * * * *", async () => {
      const {
        processVitalDecayCycle,
      } = require("../survival/helpers/survivalVitalDecay");
      await processVitalDecayCycle();
    });

    // 0.8 Custom Reminders Check - Runs every minute
    runGuardedCronJob("Custom Reminders Check", "* * * * *", async () => {
      const UserReminder = require("../models/UserReminder");
      const { sendNotification } = require("./notificationManager");
      const expiredReminders = await UserReminder.findAll({
        where: {
          remindAt: {
            [Op.lt]: new Date(),
          },
        },
      });

      for (const rem of expiredReminders) {
        if (!rem.userId || !SNOWFLAKE_REGEX.test(String(rem.userId))) {
          await rem.destroy();
          continue;
        }
        try {
          const payload = buildContainerV2({
            accentColorHex: ui.getColor("primary"),
            title: "⏰ Waktunya!",
            description: `Ini pengingat yang kamu buat sebelumnya:\n\n**"${rem.message}"**`,
            expression: "Happy",
            footerText: ui.getFooter("utility"),
          });
          await sendNotification(
            client,
            rem.userId,
            "custom_reminder",
            payload,
          );
        } catch (err) {
          logger.error(`[Cron] Gagal mengirim reminder ${rem.id}:`, err);
        }
        await rem.destroy();
      }
    });

    // 0.9 Stamina Full Check - Runs every 5 minutes
    runGuardedCronJob("Stamina Full Check", "*/5 * * * *", async () => {
      const UserSurvival = require("../models/UserSurvival");
      const UserProfile = require("../models/UserProfile");
      const { sendNotification } = require("./notificationManager");

      // Cari user yang staminanya >= 100
      const fullStaminaUsers = await UserSurvival.findAll({
        where: { stamina: { [Op.gte]: 100 } },
        include: [
          {
            model: UserProfile,
            attributes: ["userId", "notification_prefs"],
          },
        ],
      });

      for (const survival of fullStaminaUsers) {
        if (!survival.userId || !SNOWFLAKE_REGEX.test(String(survival.userId))) continue;
        const profile = survival.UserProfile;
        if (!profile) continue;

        const prefs = profile.notification_prefs || {};

        // Jika dia mensubscribe stamina_full dan belum ada notifikasi_stamina_sent hari ini
        if (prefs.stamina_full && !prefs.sent_stamina) {
          const payload = buildContainerV2({
            accentColorHex: ui.getColor("success") || "#22C55E",
            title: `${ui.getEmoji("stamina") || "⚡"} Stamina RPG Penuh!`,
            description:
              "Staminamu sudah 100/100! Jangan sampai terbuang sia-sia, yuk lanjut petualangannya di Naura RPG!",
            expression: "impressed",
            footerText: ui.getFooter("utility"),
          });

          const sent = await sendNotification(
            client,
            survival.userId,
            "stamina_full",
            payload,
          );
          if (sent) {
            await cacheManager.mutateUserProfileJson(
              survival.userId,
              "notification_prefs",
              setNotifFlag("sent_stamina"),
            );
          }
        }
      }
    });

    // 0.77 Survival Cafe Idle Revenue Notification - Runs every 2 hours
    runGuardedCronJob("Cafe Idle Revenue Notif", "0 */2 * * *", async () => {
      const UserCafe = require("../models/UserCafe");
      const { sendNotification } = require("./notificationManager");

      const readyCafes = await UserCafe.findAll({
        where: {
          uncollectedRevenue: { [Op.gte]: 500 },
        },
      });

      for (const cafe of readyCafes) {
        if (!cafe.userId || !SNOWFLAKE_REGEX.test(String(cafe.userId))) continue;
        const profile = await cacheManager.getUserProfile(cafe.userId);
        const prefs = profile?.notification_prefs || {};
        if (prefs.idle_revenue && !prefs.sent_idle_revenue) {
          const sent = await sendNotification(
            client,
            cafe.userId,
            "idle_revenue",
            { amount: cafe.uncollectedRevenue },
          );
          if (sent) {
            await cacheManager.mutateUserProfileJson(
              cafe.userId,
              "notification_prefs",
              setNotifFlag("sent_idle_revenue"),
            );
          }
        }
      }
    });

    // 0.78 Stock Market Price Alert Notification - Runs every 4 hours
    runGuardedCronJob("Stock Market Price Alert Notif", "0 */4 * * *", async () => {
      const ServerStock = require("../models/ServerStock");
      const UserStockHolding = require("../models/UserStockHolding");
      const { sendNotification } = require("./notificationManager");

      const stocks = await ServerStock.findAll();
      for (const stock of stocks) {
        const prev = Number(stock.previousPrice || 0);
        const curr = Number(stock.currentPrice || 0);
        if (prev <= 0) continue;
        const diffPct = Math.abs((curr - prev) / prev);
        if (diffPct >= 0.1) {
          const holders = await UserStockHolding.findAll({
            where: {
              ticker: stock.ticker,
              sharesOwned: { [Op.gt]: 0 },
            },
          });
          for (const holder of holders) {
            if (!holder.userId || !SNOWFLAKE_REGEX.test(String(holder.userId))) continue;
            const profile = await cacheManager.getUserProfile(holder.userId);
            const prefs = profile?.notification_prefs || {};
            if (prefs.stock_alert && !prefs.sent_stock_alert) {
              const sent = await sendNotification(
                client,
                holder.userId,
                "stock_alert",
                { symbol: stock.name, price: curr },
              );
              if (sent) {
                await cacheManager.mutateUserProfileJson(
                  holder.userId,
                  "notification_prefs",
                  setNotifFlag("sent_stock_alert"),
                );
              }
            }
          }
        }
      }
    });

    // 0.79 Vote Top.gg Reminder Notification - Runs every 2 hours
    runGuardedCronJob("Vote Reminder Notif", "0 */2 * * *", async () => {
      const UserSurvival = require("../models/UserSurvival");
      const { sendNotification } = require("./notificationManager");

      const survivals = await UserSurvival.findAll({
        attributes: ["userId", "rpg_state"],
      });
      const now = Date.now();
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

      for (const survival of survivals) {
        if (!survival.userId || !SNOWFLAKE_REGEX.test(String(survival.userId))) continue;
        const state = survival.rpg_state || {};
        const lastVote = state.last_vote_at
          ? new Date(state.last_vote_at).getTime()
          : 0;
        if (!lastVote || now - lastVote < TWELVE_HOURS_MS) continue;

        const profile = await cacheManager.getUserProfile(survival.userId);
        const prefs = profile?.notification_prefs || {};
        if (prefs.vote_reminder && !prefs.sent_vote_reminder) {
          const sent = await sendNotification(
            client,
            survival.userId,
            "vote_reminder",
            {},
          );
          if (sent) {
            await cacheManager.mutateUserProfileJson(
              survival.userId,
              "notification_prefs",
              setNotifFlag("sent_vote_reminder"),
            );
          }
        }
      }
    });

    // 0.80 Farm Greenhouse Maturity Webhook Alerts - Runs every 15 minutes
    runGuardedCronJob("Farm Greenhouse Maturity Alerts", "*/15 * * * *", async () => {
      const UserGreenhouse = require("../models/UserGreenhouse");
      const farmWebhook = require("../services/farmNotificationWebhook");
      const greenhouses = await UserGreenhouse.findAll({
        attributes: ["userId", "slots"],
      });

      for (const gh of greenhouses) {
        if (!gh.userId || !SNOWFLAKE_REGEX.test(String(gh.userId))) continue;
        if (!gh.slots || !Array.isArray(gh.slots) || gh.slots.length === 0) continue;
        await farmWebhook.checkAndNotifyHarvest(gh.userId, gh);
      }
    });

    // Reset notif status every day at 00:00 (also Quest reset notif)
    runGuardedCronJob("Daily Reset Notif Status & Quest Reset", "0 0 * * *", async () => {
      const UserProfile = require("../models/UserProfile");
      const { sendNotification } = require("./notificationManager");

      const profiles = await UserProfile.findAll({
        attributes: ["userId", "notification_prefs"],
        limit: 500,
      });

      for (const profile of profiles) {
        if (!profile.userId || !SNOWFLAKE_REGEX.test(String(profile.userId))) continue;
        const prefs = profile.notification_prefs || {};

        if (prefs.quest_reset) {
          const payload = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFB6C1",
            title: `${ui.getEmoji("desc") || "📜"} Quest Harian Direset!`,
            description:
              "Misi Harian (Daily Quest) RPG kamu sudah diperbarui. Yuk cek `/survival rpg quest` dan kumpulkan hadiahnya hari ini!",
            expression: "happy",
            footerText: ui.getFooter("utility"),
          });
          await sendNotification(
            client,
            profile.userId,
            "quest_reset",
            payload,
          ).catch((err) => {
            logger.warn(`[Cron] Gagal kirim quest_reset notif ke ${profile.userId}: ${err.message}`);
          });
          await new Promise((r) => setTimeout(r, 200));
        }

        if (
          prefs.sent_stamina ||
          prefs.sent_idle_revenue ||
          prefs.sent_stock_alert ||
          prefs.sent_vote_reminder
        ) {
          await cacheManager.mutateUserProfileJson(
            profile.userId,
            "notification_prefs",
            (prefsObj) => {
              const obj =
                prefsObj && typeof prefsObj === "object" ? prefsObj : {};
              obj.sent_stamina = false;
              obj.sent_idle_revenue = false;
              obj.sent_stock_alert = false;
              obj.sent_vote_reminder = false;
              return obj;
            },
          );
        }
      }
    });

    // 1. QOTD Scheduler - Runs every minute to check if it's time to post
    runGuardedCronJob("QOTD Scheduler", "* * * * *", async () => {
      const now = new Date();
      const currentHourStr = now.getHours().toString().padStart(2, "0");
      const currentMinStr = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHourStr}:${currentMinStr}`;
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      // Find all guilds with QOTD enabled
      // Optimized: Only fetch guilds where QOTD or Announcements might be enabled
      const allSettings = await GuildSettings.findAll({
        attributes: ["guildId", "settings"],
      });

      for (const guildData of allSettings) {
        if (
          !guildData.settings ||
          !guildData.settings.qotd ||
          !guildData.settings.qotd.enabled
        )
          continue;

        const qotdConf = guildData.settings.qotd;

        // If it's time, and we haven't asked today, and we have questions
        if (
          qotdConf.time === currentTime &&
          qotdConf.lastAsked !== todayStr &&
          qotdConf.questions.length > 0
        ) {
          const channel = client.channels.cache.get(qotdConf.channelId);
          if (!channel) continue;

          // Pilih pertanyaan secara acak
          const qIndex = Math.floor(
            Math.random() * qotdConf.questions.length,
          );
          const question = qotdConf.questions[qIndex];

          // Konversi ke Components V2 (sesuai Rule 1.6 & AGENTS.md)
          const qotdPayload = buildContainerV2({
            accentColorHex: "#ff9ff3",
            authorName: "Naura Daily Engagement",
            title: "❓ Question of the Day",
            description: `> ${question}\n\n-# Jawab pertanyaan ini di kolom reply! 💬`,
            footerText: ui.getFooter("core"),
          });

          await channel
            .send({ content: "@everyone Waktunya QOTD!" })
            .catch(() => {});
          await channel.send(qotdPayload).catch(() => {});

          // Update db
          const currentSettings = guildData.settings;
          currentSettings.qotd.lastAsked = todayStr;

          guildData.settings = currentSettings;
          guildData.changed("settings", true);
          await guildData.save({ fields: ["settings"] });
        }
      }
    });

    // 2. Birthday Announcer & Celebration Engine - Runs at 00:00 every day
    runGuardedCronJob("Birthday Celebration Engine", "0 0 * * *", async () => {
      logger.info("[Cron] Checking for birthdays...");
      const today = new Date();
      const d = today.getDate();
      const m = today.getMonth() + 1; // 1-12

      const birthdaysToday = await UserBirthday.findAll({
        where: { day: d, month: m },
      });
      const validBirthdays = birthdaysToday.filter(
        (b) => b.userId && SNOWFLAKE_REGEX.test(String(b.userId)),
      );
      if (validBirthdays.length === 0) return;

      // Kumpulkan semua userId birthday hari ini untuk batch fetch
      const birthdayUserIds = validBirthdays.map((b) => b.userId);

      // Pre-render birthday card & serahkan birthday gift box via DM personal untuk setiap user
      const userCardMap = new Map();
      for (const bday of validBirthdays) {
        try {
          const user = await client.users.fetch(bday.userId).catch(() => null);
          if (!user) continue;

          let age = null;
          if (bday.year) {
            age = today.getFullYear() - bday.year;
          }

          // 1. Render kartu ucapan selamat ulang tahun kosmik
          const cardBuffer = await canvasWorkerPool
            .runTask("renderBirthdayCard", {
              username: user.username,
              avatarUrl: user.displayAvatarURL({ extension: "png", size: 256 }),
              age: age || undefined,
              customMessage: bday.customMessage || undefined,
            })
            .catch((err) => {
              logger.error(
                `[Cron Birthday] Gagal render kartu untuk ${bday.userId}: ${err.message}`,
              );
              return null;
            });

          if (cardBuffer) {
            userCardMap.set(bday.userId, cardBuffer);
          }

          // 2. Kado Ulang Tahun Atomik (1.000 NSF, 3 Kupon, 1 Kue Tart)
          await cacheManager
            .incrementUserSurvival(bday.userId, {
              starFragments: 1000,
              coupons: 3,
            })
            .catch(() => {});
          await addItemsAtomic(bday.userId, [
            { id: "birthday_cake", amount: 1 },
          ]).catch(() => {});

          // 3. Kirim ucapan personal & kartu via DM
          const dmFiles = cardBuffer
            ? [new AttachmentBuilder(cardBuffer, { name: "birthday_card.png" })]
            : [];
          const dmPayload = buildContainerV2({
            accentColorHex: "#FF69B4",
            authorName: "Naura Birthday Celebration",
            title: `🎂 Selamat Ulang Tahun, ${user.username}!`,
            bannerAttachmentName: cardBuffer ? "birthday_card.png" : undefined,
            description: [
              `Hai **${user.username}**! Hari ini adalah hari spesialmu! 🎉✨`,
              age
                ? `Selamat menginjak usia yang ke-**${age}** tahun! Semoga panjang umur, sehat selalu, dan petualanganmu di dunia Naura semakin luar biasa.`
                : "Semoga panjang umur, sehat selalu, dan petualanganmu di dunia Naura semakin luar biasa!",
              "",
              "🎁 **Spesial Birthday Gift Box dari Naura:**",
              "• **+1.000** Star Fragments (NSF)",
              "• **+3** Naura Coupons",
              "• **1x** Kue Ulang Tahun (Kue manis pemulih vital)",
              "",
              "*Kado spesial telah otomatis dimasukkan ke dalam ransel survival kamu! Nikmati hari istimewamu ya!*",
            ].join("\n"),
            files: dmFiles,
            footerText: ui.getFooter("survival"),
          });

          await user.send(dmPayload).catch(() => {
            logger.info(
              `[Cron Birthday] DM ditutup oleh pengguna ${bday.userId}`,
            );
          });
        } catch (userErr) {
          logger.error(
            `[Cron Birthday] Error memproses perayaan user ${bday.userId}: ${userErr.message}`,
          );
        }
      }

      // 4. Siarkan ucapan dan kartu ke Announcement Channel di server-server yang mengaktifkannya
      const allSettings = await GuildSettings.findAll({
        attributes: ["guildId", "settings"],
      });

      for (const guildData of allSettings) {
        if (!guildData.settings || !guildData.settings.announcementChannel)
          continue;

        const guild = client.guilds.cache.get(guildData.guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(
          guildData.settings.announcementChannel,
        );
        if (!channel) continue;

        // Batch fetch member
        let fetchedMembers;
        try {
          fetchedMembers = await guild.members.fetch({
            user: birthdayUserIds,
          });
        } catch {
          continue;
        }

        let bdayMsg = "";
        const guildFiles = [];
        for (const bday of birthdaysToday) {
          const member = fetchedMembers.get(bday.userId);
          if (member) {
            let ageText = "";
            if (bday.year) {
              const age = today.getFullYear() - bday.year;
              ageText = ` yang ke-${age}`;
            }
            bdayMsg += `🎉 Selamat Ulang Tahun${ageText} kepada <@${member.id}>!\n`;
            const cardBuf = userCardMap.get(bday.userId);
            if (cardBuf && guildFiles.length === 0) {
              guildFiles.push(
                new AttachmentBuilder(cardBuf, {
                  name: "birthday_server_card.png",
                }),
              );
            }
          }
        }

        if (bdayMsg.length > 0) {
          const bdayPayload = buildContainerV2({
            accentColorHex: "#ff9ff3",
            authorName: "Naura Birthday Reminder",
            title: "🎂 Hari Ulang Tahun Anggota Server!",
            bannerAttachmentName:
              guildFiles.length > 0 ? "birthday_server_card.png" : undefined,
            description:
              bdayMsg +
              "\nMari berikan ucapan selamat dan doa terbaik kita di hari spesial ini! 🎈🥳",
            files: guildFiles,
            footerText: ui.getFooter("core"),
          });
          await channel.send(bdayPayload).catch(() => {});
        }
      }
    });

    // 3. Friendship Streak Checker - Runs every hour to reset lost streaks
    runGuardedCronJob("Friendship Streak Reset", "0 * * * *", async () => {
      logger.info("[Cron] Checking friendship streaks...");
      const UserFriend = require("../models/UserFriend");

      const now = new Date();
      const fortyEightHoursAgo = new Date(
        now.getTime() - 48 * 60 * 60 * 1000,
      );

      // Reset streak if last interaction is older than 48 hours and streak > 0
      await UserFriend.update(
        { streak: 0 },
        {
          where: {
            status: "accepted",
            streak: { [Op.gt]: 0 },
            lastInteraction: { [Op.lt]: fortyEightHoursAgo },
          },
        },
      );
    });

    // 4. Stale Cooldown Cleanup - Runs every day at 04:00 AM
    runGuardedCronJob("Stale Cooldown Cleanup", "0 4 * * *", async () => {
      logger.info("[Cron] Cleaning up expired cooldowns entries...");
      const UserProfile = require("../models/UserProfile");
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const BATCH_SIZE = 200; // ✅ FIX OOM: batching agar tidak load semua profil ke memory

      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const profiles = await UserProfile.findAll({
          attributes: ["userId", "cooldowns"],
          limit: BATCH_SIZE,
          offset,
        });

        if (profiles.length < BATCH_SIZE) hasMore = false;
        offset += BATCH_SIZE;

        for (const profile of profiles) {
          if (!profile.cooldowns || typeof profile.cooldowns !== "object")
            continue;
          let modified = false;
          const newCooldowns = { ...profile.cooldowns };

          for (const [key, ts] of Object.entries(newCooldowns)) {
            const cooldownTime = new Date(ts).getTime();
            if (isNaN(cooldownTime) || now - cooldownTime > SEVEN_DAYS_MS) {
              delete newCooldowns[key];
              modified = true;
            }
          }

          if (modified) {
            profile.cooldowns = newCooldowns;
            profile.changed("cooldowns", true);
            await profile.save({ fields: ["cooldowns"] });
            await cacheManager.invalidateUserProfile(profile.userId);
          }
        }
      }
    });

    // 5. Premium VIP Lifecycle Manager - Runs every day at 08:00 WIB (01:00 UTC)
    runGuardedCronJob("Premium VIP Lifecycle", "0 1 * * *", async () => {
      logger.info("[Cron] Running Premium VIP Lifecycle check...");
      const UserProfile = require("../models/UserProfile");
      const now = new Date();

      // ── 5A. Cabut status EXPIRED ─────────────────────────
      const expiredUsers = await UserProfile.findAll({
        where: {
          isPremium: true,
          premiumUntil: { [Op.lte]: now },
        },
        attributes: ["userId", "premiumUntil"],
      });

      for (const profile of expiredUsers) {
        try {
          profile.isPremium = false;
          profile.premiumUntil = null;
          await profile.save({ fields: ["isPremium", "premiumUntil"] });
          await cacheManager.invalidateUserProfile(profile.userId);

          if (!profile.userId || !SNOWFLAKE_REGEX.test(String(profile.userId))) continue;

          // Kirim DM notifikasi expired
          const user = await client.users
            .fetch(profile.userId)
            .catch(() => null);
          if (!user) continue;

          const expiredPayload = buildContainerV2({
            accentColorHex: "#8e98b0",
            authorName: "Naura V.I.P Service",
            title: "🔔 Langganan V.I.P Kamu Telah Berakhir",
            description: [
              `Hei **${user.username}**!`,
              ``,
              `Masa aktif **V.I.P Premium** kamu telah berakhir. Akses ke fitur eksklusif seperti Musik 24/7, Dungeon Unlimited, dan Bonus Economy kini kembali ke mode reguler.`,
              ``,
              `Perpanjang langgananmu dengan \`/premium info\`, hanya mulai dari **Rp 25.000** untuk 30 hari!`,
              ``,
              `-# Terima kasih telah mendukung Naura Project. Kami berharap bertemu kembali! 💎`,
            ].join("\n"),
            footerText: ui.getFooter("premium"),
          });

          await user.send(expiredPayload).catch(() => {});
          logger.info(
            `[Cron Premium] Status expired dicabut: ${profile.userId}`,
          );
        } catch (userErr) {
          logger.error(
            `[Cron Premium Expiry] Error untuk userId ${profile.userId}:`,
            userErr,
          );
        }
      }

      if (expiredUsers.length > 0) {
        logger.info(
          `[Cron Premium] Total expired & dicabut: ${expiredUsers.length} user.`,
        );
      }

      // ── 5B. Warning H-3 untuk yang akan expired ──────────
      const threeDaysLater = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000,
      );
      const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      const expiringUsers = await UserProfile.findAll({
        where: {
          isPremium: true,
          premiumUntil: {
            [Op.gt]: twoDaysLater,
            [Op.lte]: threeDaysLater,
          },
        },
        attributes: ["userId", "premiumUntil"],
      });

      for (const profile of expiringUsers) {
        try {
          if (!profile.userId || !SNOWFLAKE_REGEX.test(String(profile.userId))) continue;
          const user = await client.users
            .fetch(profile.userId)
            .catch(() => null);
          if (!user) continue;

          const expTs = Math.floor(profile.premiumUntil.getTime() / 1000);
          const warningPayload = buildContainerV2({
            accentColorHex: ui.getColor("premium_vip"),
            authorName: "Naura V.I.P Service",
            title: "⏳ Masa Aktif V.I.P Hampir Berakhir!",
            description: [
              `Hei **${user.username}**!`,
              ``,
              `Langganan **V.I.P Premium** kamu akan berakhir dalam **3 Hari** (<t:${expTs}:R>).`,
              ``,
              `Perpanjang sekarang agar tidak kehilangan akses ke:`,
              `・ 🎵 Musik 24/7 tanpa henti`,
              `・ ⚔️ Dungeon Unlimited beyond Floor 50`,
              `・ 💰 Bonus Gaji & Bunga Deposito`,
              `・ 🎨 Gold Glow Card & AI Studio`,
              ``,
              `Gunakan \`/premium info\` untuk melihat paket perpanjangan!`,
              ``,
              `-# Harga mulai dari Rp 25.000 / 30 hari. Terima kasih atas dukunganmu! 💎`,
            ].join("\n"),
            footerText: ui.getFooter("premium"),
          });

          await user.send(warningPayload).catch(() => {});
        } catch (err) {
          logger.warn("[cronManager:init] Permintaan API eksternal gagal: " + (err?.message || err));
        }
      }

      if (expiringUsers.length > 0) {
        logger.info(
          `[Cron Premium] Warning H-3 dikirim ke ${expiringUsers.length} user.`,
        );
      }
    });

    // 6. Analytics Precomputation - Runs every 30 minutes
    runGuardedCronJob("Analytics Precomputation", "*/30 * * * *", async () => {
      const redisManager = require("./redisManager");
      const UserProfile = require("../models/UserProfile");
      const UserSurvival = require("../models/UserSurvival");
      const UserPet = require("../models/UserPet");

      const totalUsers = await UserProfile.count();
      const totalGuilds = client.guilds ? client.guilds.cache.size : 0;
      const totalPets = await UserPet.count();

      const ecoStats = await UserProfile.findAll({
        attributes: [
          [fn("SUM", col("economy_wallet")), "totalWallet"],
          [fn("SUM", col("economy_bank")), "totalBank"],
        ],
        raw: true,
      });

      const survivalStats = await UserSurvival.findAll({
        attributes: [
          [fn("SUM", col("coupons")), "totalCoupons"],
          [fn("SUM", col("starFragments")), "totalFragments"],
        ],
        raw: true,
      });

      const overview = {
        totalUsers,
        totalGuilds,
        totalPets,
        economy: {
          totalWallet: Number(ecoStats[0]?.totalWallet) || 0,
          totalBank: Number(ecoStats[0]?.totalBank) || 0,
          totalCoupons: Number(survivalStats[0]?.totalCoupons) || 0,
          totalFragments: Number(survivalStats[0]?.totalFragments) || 0,
        },
        timestamp: Date.now(),
      };

      await redisManager.setCache(
        "analytics:cache:overview",
        JSON.stringify(overview),
        1900,
      );
      logger.info("[Cron Analytics] Precomputed dashboard analytics cache.");
    });

    // 7. World Boss Global Raid Auto-Spawn - Runs every Sunday at 15:00 WIB (08:00 UTC)
    runGuardedCronJob("World Boss Global Raid Auto-Spawn", "0 8 * * 0", async () => {
      const worldBossEngine = require("../survival/engines/worldBossEngine");
      const activeBoss = await worldBossEngine.getActiveBoss();
      if (!activeBoss) {
        logger.info(
          "[Cron WorldBoss] Spawning Sunday Special World Boss (15:00 WIB)...",
        );
        await worldBossEngine.spawnBoss({
          bossId: `boss_sunday_${Date.now()}`,
          name: "Calamity Leviathan Prime",
          title: "Penguasa Kehampaan Neo-Hoshino (Event Mingguan)",
          element: "DARK",
          maxHp: 1500000,
          durationMinutes: 180,
          rewardsPool: { starFragments: 15000, coupons: 100 },
        });
      }
    });

    // 8. Prediction Market Auto-Lock Check - Runs every minute
    runGuardedCronJob("Prediction Market Auto-Lock", "* * * * *", async () => {
      const PredictionMarket = require("../models/PredictionMarket");
      const expiredMarkets = await PredictionMarket.findAll({
        where: {
          status: "OPEN",
          lockTime: {
            [Op.lte]: new Date(),
          },
        },
      });

      for (const market of expiredMarkets) {
        market.status = "LOCKED";
        await market.save({ fields: ["status"] });
        const redisManager = require("./redisManager");
        if (redisManager.isReady) {
          await redisManager.deleteCache(
            `prediction:market:${market.marketId}`,
          );
        }
        logger.info(
          `[Cron Prediction] Market ${market.marketId} automatically LOCKED as lockTime passed.`,
        );
      }
    });

    // 9. Daily Morning Newspaper Publication (The Hoshino Times) - Runs every day at 08:00 WIB (01:00 UTC)
    runGuardedCronJob("Daily Morning Newspaper Publication", "0 1 * * *", async () => {
      const ServerChronicleEngine = require("../ai/serverChronicleEngine");
      logger.info(
        "[Cron Chronicle] Triggering daily morning newspaper publication (08:00 WIB)...",
      );
      if (typeof ServerChronicleEngine.publishMorningChronicle === "function") {
        await ServerChronicleEngine.publishMorningChronicle(client);
      }
    });

    // 10. Weekly Clan Territory War Reset - Runs every Monday at 00:00 WIB (Sunday 17:00 UTC)
    runGuardedCronJob("Weekly Clan Territory War Reset", "0 17 * * 0", async () => {
      const TerritoryWarEngine = require("../services/territoryWarEngine");
      logger.info(
        "[Cron Territory] Resetting weekly control points for Clan Territory War...",
      );
      await TerritoryWarEngine.resetWeeklyWar();
    });

    // 11. Hourly Server Stock Market Fluctuation Tick (Every hour at minute 0)
    runGuardedCronJob("Hourly Server Stock Market Fluctuation", "0 * * * *", async () => {
      const StockMarketEngine = require("../services/stockMarketEngine");
      logger.info(
        "[Cron Stock] Updating hourly stock market prices and candle cycles...",
      );
      await StockMarketEngine.updateMarketTick();
    });

    // 12. Monthly Galactic Coliseum Championship Reset (1st of every month at 00:00 WIB / 17:00 UTC)
    runGuardedCronJob("Monthly Galactic Coliseum Reset", "0 17 1 * *", async () => {
      const ColiseumTeam = require("../models/ColiseumTeam");
      logger.info(
        "[Cron Coliseum] Resetting monthly tournament divisions and distributing trophies...",
      );
      const teams = await ColiseumTeam.findAll();
      for (const t of teams) {
        t.eloRating = Math.max(1200, Math.floor(t.eloRating * 0.9));
        t.divisionTier =
          t.eloRating >= 2100
            ? "MASTER"
            : t.eloRating >= 1900
              ? "DIAMOND"
              : t.eloRating >= 1700
                ? "PLATINUM"
                : t.eloRating >= 1500
                  ? "GOLD"
                  : t.eloRating >= 1300
                    ? "SILVER"
                    : "BRONZE";
        await t.save({ fields: ["eloRating", "divisionTier"] });
      }
    });

    // 13. Autonomous Notification Dispatcher - Runs every 30 minutes
    runGuardedCronJob("Autonomous Notification Dispatcher", "*/30 * * * *", async () => {
      logger.debug("[Cron Notification] Autonomous notification cycle tick.");
    });

    // 14. Daily Central Bank Exchange Volume Reset (00:00 UTC)
    runGuardedCronJob("Daily Central Bank Exchange Volume Reset", "0 0 * * *", async () => {
      const redisManager = require("./redisManager");
      if (redisManager.client && redisManager.client.isReady) {
        await redisManager.client.set("economy:volume:nsf:daily", 0);
        logger.info("[Cron Bank] Daily Central Bank exchange volume has been reset to 0.");
      }
    });

    // 15. Weekly Astral Lottery Jackpot Draw (Sunday at 20:00 WIB / 13:00 UTC)
    runGuardedCronJob("Weekly Astral Lottery Jackpot Draw", "0 13 * * 0", async () => {
      const recyclingPoolEngine = require("../survival/engines/recyclingPoolEngine");
      logger.info("[Cron Lottery] Executing weekly Astral Lottery jackpot draw...");
      const result = await recyclingPoolEngine.runWeeklyLottery();
      if (result.ok) {
        logger.info(
          `[Cron Lottery] Jackpot drawn! Winner: ${result.winnerUserId} received ${result.prizeAmount} NSF.`,
        );
        // Siarkan notifikasi penghargaan ke pemenang undian
        if (result.winnerUserId && SNOWFLAKE_REGEX.test(String(result.winnerUserId))) {
          const winnerUser = await client.users
            .fetch(result.winnerUserId)
            .catch(() => null);
          if (winnerUser) {
            const notifPayload = buildContainerV2({
              accentColorHex: "#F59E0B",
              authorName: "Naura Wilds • Astral Lottery",
              title: "🏆 Selamat! Kamu Memenangkan Astral Lottery!",
              description: [
                `Halo <@${result.winnerUserId}>!`,
                "",
                `Tiket undianmu terpilih sebagai pemenang jackpot mingguan!`,
                `Kamu telah menerima hadiah sebesar **${Number(result.prizeAmount).toLocaleString("id-ID")} NSF** langsung ke dompet survivalmu.`,
                "",
                "-# 🎟️ *Terima kasih telah aktif berpartisipasi dan berkontribusi pada ekonomi sirkular Naura Wilds.*",
              ].join("\n"),
              footerText: "Naura Hoshino Ecosystem • Astral Lottery",
            });
            await winnerUser.send(notifPayload).catch((err) => {
              logger.warn(
                `[Cron Lottery] Gagal mengirim notifikasi pemenang: ${err.message}`,
              );
            });
          }
        }
      }
    });

    // 16. Naura Wilds 5-Hour Energy Replenishment Tick (Every 5 hours at minute 0)
    runGuardedCronJob("Naura Wilds 5-Hour Energy Replenishment", "0 */5 * * *", async () => {
      const UserSurvival = require("../models/UserSurvival");
      logger.info("[Cron Survival] Memulai siklus pemulihan stamina 5 jam...");
      const lowStaminaUsers = await UserSurvival.findAll({
        where: { stamina: { [Op.lt]: 100 } },
        attributes: ["userId"],
      });
      for (const u of lowStaminaUsers) {
        if (!u.userId || !SNOWFLAKE_REGEX.test(String(u.userId))) continue;
        await cacheManager.updateUserSurvival(u.userId, { stamina: 100 });
      }
      logger.info(
        `[Cron Survival] Stamina ${lowStaminaUsers.length} petualang berhasil dipulihkan penuh via cacheManager.`,
      );
    });
  },
};
