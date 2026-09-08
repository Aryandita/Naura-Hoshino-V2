const cron = require("node-cron");
const { logger } = require("../managers/logger");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");
const GuildSettings = require("../models/GuildSettings");
const UserBirthday = require("../models/UserBirthday");

const clusterManager = require("./clusterManager");

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
    cron.schedule("0 2 * * *", async () => {
      logger.info("[Cron] Running Auto Backup Database...");
      const backupManager = require("./backupManager");
      await backupManager.runBackup();
    });

    // 0.5 Tempban Expiration Check - Runs every minute
    let isTempbanCheckRunning = false;
    cron.schedule("* * * * *", async () => {
      if (isTempbanCheckRunning) return;
      isTempbanCheckRunning = true;
      try {
        const UserStrike = require("../models/UserStrike");
        const expiredTempbans = await UserStrike.findAll({
          where: {
            isTempBanned: true,
            tempbanExpiresAt: {
              [require("sequelize").Op.lt]: new Date(),
            },
          },
        });

        for (const record of expiredTempbans) {
          try {
            const guild = await client.guilds.fetch(record.guildId);
            if (guild) {
              await guild.members
                .unban(record.userId, "Masa Tempban selesai")
                .catch(() => {});
            }
          } catch (err) {
            logger.error(
              `[Cron] Gagal unban user ${record.userId}: ${err.message}`,
            );
          }
          record.isTempBanned = false;
          record.tempbanExpiresAt = null;
          await record.save({ fields: ["isTempBanned", "tempbanExpiresAt"] });
        }
      } catch (err) {
        logger.error("[Cron] Gagal memproses Tempban:", err);
      }
      isTempbanCheckRunning = false;
    });

    // 0.6 Daily Quest Reset - Runs at 00:00 every day
    cron.schedule("0 0 * * *", async () => {
      // Tidak melakukan apa-apa. Reset quest sekarang menggunakan sistem *lazy-evaluation*
      // yang dilakukan oleh `questGenerator.js` saat user bertindak atau membuka papan misi.
      // Melakukan bulk update di sini akan menghapus progress misi mingguan secara tidak sengaja.
    });

    // 0.7 Role Lease Expiration Check - Runs every minute
    let isRoleLeaseCheckRunning = false;
    cron.schedule("* * * * *", async () => {
      if (isRoleLeaseCheckRunning) return;
      isRoleLeaseCheckRunning = true;
      try {
        const RoleLease = require("../models/RoleLease");
        const expiredLeases = await RoleLease.findAll({
          where: {
            expiresAt: {
              [require("sequelize").Op.lt]: new Date(),
            },
          },
        });

        for (const lease of expiredLeases) {
          try {
            const guild = await client.guilds.fetch(lease.guildId);
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
          } catch (err) {
            logger.error(
              `[Cron] Gagal memproses kadaluwarsa role lease ${lease.id}:`,
              err,
            );
          }
          await lease.destroy();
        }
      } catch (err) {
        logger.error("[Cron] Gagal memproses Role Lease:", err);
      }
      isRoleLeaseCheckRunning = false;
    });

    // 0.75 Survival Periodic Vital Decay - Runs every 30 minutes
    let isVitalDecayRunning = false;
    cron.schedule("*/30 * * * *", async () => {
      if (isVitalDecayRunning) return;
      isVitalDecayRunning = true;
      try {
        const {
          processVitalDecayCycle,
        } = require("../survival/helpers/survivalVitalDecay");
        await processVitalDecayCycle();
      } catch (err) {
        logger.error("[Cron] Gagal memproses siklus Vital Decay:", err);
      }
      isVitalDecayRunning = false;
    });

    // 0.8 Custom Reminders Check - Runs every minute
    let isReminderCheckRunning = false;
    cron.schedule("* * * * *", async () => {
      if (isReminderCheckRunning) return;
      isReminderCheckRunning = true;
      try {
        const UserReminder = require("../models/UserReminder");
        const { sendNotification } = require("./notificationManager");
        const expiredReminders = await UserReminder.findAll({
          where: {
            remindAt: {
              [require("sequelize").Op.lt]: new Date(),
            },
          },
        });

        for (const rem of expiredReminders) {
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
      } catch (err) {
        logger.error("[Cron] Gagal memproses Reminders:", err);
      }
      isReminderCheckRunning = false;
    });

    // 0.9 Stamina Full Check - Runs every 5 minutes
    let isStaminaCheckRunning = false;
    cron.schedule("*/5 * * * *", async () => {
      if (isStaminaCheckRunning) return;
      isStaminaCheckRunning = true;
      try {
        const UserSurvival = require("../models/UserSurvival");
        const UserProfile = require("../models/UserProfile");
        const { sendNotification } = require("./notificationManager");
        const cacheManager = require("./cacheManager");

        // Cari user yang staminanya >= 100
        const fullStaminaUsers = await UserSurvival.findAll({
          where: { stamina: { [require("sequelize").Op.gte]: 100 } },
          include: [
            {
              model: UserProfile,
              attributes: ["userId", "notification_prefs"],
            },
          ],
        });

        for (const survival of fullStaminaUsers) {
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
                (prefsObj) => {
                  const obj =
                    prefsObj && typeof prefsObj === "object" ? prefsObj : {};
                  obj.sent_stamina = true;
                  return obj;
                },
              );
            }
          }
        }
      } catch (err) {
        logger.error("[Cron] Gagal memproses Stamina Notif:", err);
      }
      isStaminaCheckRunning = false;
    });

    // 0.77 Survival Cafe Idle Revenue Notification - Runs every 2 hours
    let isIdleRevenueCheckRunning = false;
    cron.schedule("0 */2 * * *", async () => {
      if (isIdleRevenueCheckRunning) return;
      isIdleRevenueCheckRunning = true;
      try {
        const UserCafe = require("../models/UserCafe");
        const { sendNotification } = require("./notificationManager");
        const cacheManager = require("./cacheManager");
        const { Op } = require("sequelize");

        const readyCafes = await UserCafe.findAll({
          where: {
            uncollectedRevenue: { [Op.gte]: 500 },
          },
        });

        for (const cafe of readyCafes) {
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
                (prefsObj) => {
                  const obj =
                    prefsObj && typeof prefsObj === "object" ? prefsObj : {};
                  obj.sent_idle_revenue = true;
                  return obj;
                },
              );
            }
          }
        }
      } catch (err) {
        logger.error("[Cron] Gagal memproses Notif Idle Revenue Kafe:", err);
      }
      isIdleRevenueCheckRunning = false;
    });

    // 0.78 Stock Market Price Alert Notification - Runs every 4 hours
    let isStockAlertCheckRunning = false;
    cron.schedule("0 */4 * * *", async () => {
      if (isStockAlertCheckRunning) return;
      isStockAlertCheckRunning = true;
      try {
        const ServerStock = require("../models/ServerStock");
        const UserStockHolding = require("../models/UserStockHolding");
        const { sendNotification } = require("./notificationManager");
        const cacheManager = require("./cacheManager");
        const { Op } = require("sequelize");

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
                    (prefsObj) => {
                      const obj =
                        prefsObj && typeof prefsObj === "object" ? prefsObj : {};
                      obj.sent_stock_alert = true;
                      return obj;
                    },
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        logger.error("[Cron] Gagal memproses Notif Stock Alert:", err);
      }
      isStockAlertCheckRunning = false;
    });

    // 0.79 Vote Top.gg Reminder Notification - Runs every 2 hours
    let isVoteReminderCheckRunning = false;
    cron.schedule("0 */2 * * *", async () => {
      if (isVoteReminderCheckRunning) return;
      isVoteReminderCheckRunning = true;
      try {
        const UserSurvival = require("../models/UserSurvival");
        const { sendNotification } = require("./notificationManager");
        const cacheManager = require("./cacheManager");

        const survivals = await UserSurvival.findAll({
          attributes: ["userId", "rpg_state"],
        });
        const now = Date.now();
        const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

        for (const survival of survivals) {
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
                (prefsObj) => {
                  const obj =
                    prefsObj && typeof prefsObj === "object" ? prefsObj : {};
                  obj.sent_vote_reminder = true;
                  return obj;
                },
              );
            }
          }
        }
      } catch (err) {
        logger.error("[Cron] Gagal memproses Notif Vote Reminder:", err);
      }
      isVoteReminderCheckRunning = false;
    });

    // Reset notif status every day at 00:00 (also Quest reset notif)
    cron.schedule("0 0 * * *", async () => {
      try {
        const UserProfile = require("../models/UserProfile");
        const { sendNotification } = require("./notificationManager");
        const cacheManager = require("./cacheManager");
        const profiles = await UserProfile.findAll();

        for (const profile of profiles) {
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
            );
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
      } catch (e) {
        logger.error("[Cron] Gagal memproses reset notif harian:", e);
      }
    });

    // 0.9 Daily Server Chronicle Broadcast - Runs at 01:00 UTC (08:00 WIB) every day
    cron.schedule("0 1 * * *", async () => {
      logger.info(
        "[Cron] Menerbitkan Koran Harian 'The Hoshino Times' ke guild...",
      );
      try {
        const ServerChronicleEngine = require("../ai/serverChronicleEngine");
        const { drawChronicleNewspaper } = require("../canvas/chronicleCanvas");
        const { AttachmentBuilder } = require("discord.js");

        for (const [guildId, guild] of client.guilds.cache) {
          try {
            const settings = await GuildSettings.findOne({
              where: { guildId },
            });
            const s = settings?.settings || {};
            const channelId =
              s.chronicleChannelId || s.channels?.general || s.channels?.news;
            if (!channelId) continue;

            const channel = await guild.channels
              .fetch(channelId)
              .catch(() => null);
            if (!channel || !channel.isTextBased()) continue;

            const chronicleData =
              await ServerChronicleEngine.generateChronicleData(guild);
            const imgBuffer = await drawChronicleNewspaper(chronicleData);
            const attachment = new AttachmentBuilder(imgBuffer, {
              name: "hoshino-times.png",
            });

            const payload = buildContainerV2({
              accentColorHex: "#FFB6C1",
              title: `📰 THE HOSHINO TIMES - Edisi Pagi ${chronicleData.date}`,
              description: `Selamat pagi warga **${guild.name}**! Edisi harian koran server telah terbit.\n\n👑 **Member of the Day:** **${chronicleData.topUser.username}** (\`${chronicleData.topUser.count} pesan\`)\n⚡ **Headline:** *${chronicleData.headline}*`,
              footerText: ui.getFooter("utility"),
              media: attachment,
            });

            await channel.send({ ...payload, files: [attachment] });
          } catch (gErr) {
            logger.warn(
              `[Cron] Gagal kirim chronicle ke guild ${guildId}: ${gErr.message}`,
            );
          }
        }
      } catch (err) {
        logger.error("[Cron] Gagal memproses broadcast koran harian:", err);
      }
    });

    // 1. QOTD Scheduler - Runs every minute to check if it's time to post
    let isQotdRunning = false;
    cron.schedule("* * * * *", async () => {
      if (isQotdRunning) return;
      isQotdRunning = true;

      const now = new Date();
      const currentHourStr = now.getHours().toString().padStart(2, "0");
      const currentMinStr = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHourStr}:${currentMinStr}`;
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      try {
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
            // Optionally remove the question so it doesn't repeat:
            // currentSettings.qotd.questions.splice(qIndex, 1);

            guildData.settings = currentSettings;
            guildData.changed("settings", true);
            await guildData.save({ fields: ["settings"] });
          }
        }
      } catch (err) {
        logger.error("[Cron QOTD Error]", err);
      } finally {
        isQotdRunning = false;
      }
    });

    // 2. Birthday Announcer - Runs at 00:00 every day
    cron.schedule("0 0 * * *", async () => {
      logger.info("[Cron] Checking for birthdays...");
      const today = new Date();
      const d = today.getDate();
      const m = today.getMonth() + 1; // 1-12

      try {
        const birthdaysToday = await UserBirthday.findAll({
          where: { day: d, month: m },
        });
        if (birthdaysToday.length === 0) return;

        // Kumpulkan semua userId birthday hari ini untuk batch fetch
        const birthdayUserIds = birthdaysToday.map((b) => b.userId);

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

          // ✅ FIX N+1: Batch fetch semua member sekaligus per guild
          let fetchedMembers;
          try {
            fetchedMembers = await guild.members.fetch({
              user: birthdayUserIds,
            });
          } catch {
            continue;
          }

          let bdayMsg = "";
          for (const bday of birthdaysToday) {
            const member = fetchedMembers.get(bday.userId);
            if (member) {
              let ageText = "";
              if (bday.year) {
                const age = today.getFullYear() - bday.year;
                ageText = ` yang ke-${age}`;
              }
              bdayMsg += `🎉 Selamat Ulang Tahun${ageText} kepada <@${member.id}>!\n`;
            }
          }

          if (bdayMsg.length > 0) {
            const bdayPayload = buildContainerV2({
              accentColorHex: "#ff9ff3",
              authorName: "Naura Birthday Reminder",
              title: "🎂 Hari Ulang Tahun!",
              description: bdayMsg,
              footerText: ui.getFooter("core"),
            });
            await channel.send(bdayPayload).catch(() => {});
          }
        }
      } catch (err) {
        logger.error("[Cron Birthday Error]", err);
      }
    });

    // 3. Friendship Streak Checker - Runs every hour to reset lost streaks
    cron.schedule("0 * * * *", async () => {
      logger.info("[Cron] Checking friendship streaks...");
      try {
        const UserFriend = require("../models/UserFriend");
        const { Op } = require("sequelize");

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
      } catch (err) {
        logger.error("[Cron Streak Reset Error]", err);
      }
    });

    // 4. Stale Cooldown Cleanup - Runs every day at 04:00 AM
    cron.schedule("0 4 * * *", async () => {
      logger.info("[Cron] Cleaning up expired cooldowns entries...");
      try {
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
            }
          }
        }
      } catch (err) {
        logger.error("[Cron Cooldown Cleanup Error]", err);
      }
    });

    // 5. Premium VIP Lifecycle Manager - Runs every day at 08:00 WIB (01:00 UTC)
    cron.schedule("0 1 * * *", async () => {
      logger.info("[Cron] Running Premium VIP Lifecycle check...");
      try {
        const UserProfile = require("../models/UserProfile");
        const { Op } = require("sequelize");
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
          } catch (_) {}
        }

        if (expiringUsers.length > 0) {
          logger.info(
            `[Cron Premium] Warning H-3 dikirim ke ${expiringUsers.length} user.`,
          );
        }
      } catch (err) {
        logger.error("[Cron Premium Lifecycle Error]", err);
      }
    });

    // 6. Analytics Precomputation - Runs every 30 minutes
    cron.schedule("*/30 * * * *", async () => {
      try {
        const redisManager = require("./redisManager");
        const UserProfile = require("../models/UserProfile");
        const UserSurvival = require("../models/UserSurvival");
        const UserPet = require("../models/UserPet");
        const { fn, col } = require("sequelize");

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
      } catch (err) {
        logger.error("[Cron Analytics Precompute Error]", err);
      }
    });

    // 7. World Boss Global Raid Auto-Spawn - Runs every Sunday at 15:00 WIB (08:00 UTC)
    cron.schedule("0 8 * * 0", async () => {
      try {
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
      } catch (err) {
        logger.error("[Cron WorldBoss Spawn Error]", err);
      }
    });

    // 8. Prediction Market Auto-Lock Check - Runs every minute
    cron.schedule("* * * * *", async () => {
      try {
        const PredictionMarket = require("../models/PredictionMarket");
        const { Op } = require("sequelize");
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
      } catch (err) {
        logger.error("[Cron Prediction Auto-Lock Error]", err);
      }
    });

    // 9. Daily Morning Newspaper Publication (The Hoshino Times) - Runs every day at 08:00 WIB (01:00 UTC)
    cron.schedule("0 1 * * *", async () => {
      try {
        const ServerChronicleEngine = require("../ai/serverChronicleEngine");
        logger.info(
          "[Cron Chronicle] Triggering daily morning newspaper publication (08:00 WIB)...",
        );
        await ServerChronicleEngine.publishMorningChronicle(client);
      } catch (err) {
        logger.error("[Cron Chronicle Morning Publication Error]", err);
      }
    });

    // 10. Weekly Clan Territory War Reset - Runs every Monday at 00:00 WIB (Sunday 17:00 UTC)
    cron.schedule("0 17 * * 0", async () => {
      try {
        const TerritoryWarEngine = require("../services/territoryWarEngine");
        logger.info(
          "[Cron Territory] Resetting weekly control points for Clan Territory War...",
        );
        await TerritoryWarEngine.resetWeeklyWar();
      } catch (err) {
        logger.error("[Cron Territory War Reset Error]", err);
      }
    });

    // 11. Hourly Server Stock Market Fluctuation Tick (Every hour at minute 0)
    cron.schedule("0 * * * *", async () => {
      try {
        const StockMarketEngine = require("../services/stockMarketEngine");
        logger.info(
          "[Cron Stock] Updating hourly stock market prices and candle cycles...",
        );
        await StockMarketEngine.updateMarketTick();
      } catch (err) {
        logger.error("[Cron Stock Tick Error]", err);
      }
    });

    // 12. Monthly Galactic Coliseum Championship Reset (1st of every month at 00:00 WIB / 17:00 UTC)
    cron.schedule("0 17 1 * *", async () => {
      try {
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
      } catch (err) {
        logger.error("[Cron Coliseum Reset Error]", err);
      }
    });

    // 13. Autonomous Notification Dispatcher - Runs every 30 minutes
    cron.schedule("*/30 * * * *", async () => {
      try {
        logger.debug("[Cron Notification] Autonomous notification cycle tick.");
      } catch (err) {
        logger.error("[Cron Notification Center Error]", err);
      }
    });
  },
};
