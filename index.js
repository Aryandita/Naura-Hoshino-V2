const env = require("./src/config/env");

// Inisialisasi Sentry paling awal untuk menangkap semua potensi error
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}

const { Client, Collection } = require("discord.js");
const path = require("path");

// Penambal bahasa memasang interaction.localeLang, interaction.t(), dan padanannya
// pada message. Harus dipasang sebelum command dimuat agar command apa pun dapat
// membaca bahasa pilihan user sejak interaksi pertama.
const { applyLocalePatch } = require("./src/utils/localePatch");
applyLocalePatch();

const { CommandHandler } = require("./src/managers/CommandHandler");
const { loadEvents } = require("./src/managers/eventLoader");
const clientOptions = require("./src/config/clientOptions");
const MusicManager = require("./src/managers/musicManager");
const redisManager = require("./src/managers/redisManager");
const mongoManager = require("./src/managers/mongoManager");
const { logger } = require("./src/managers/logger");
const RssManager = require("./src/managers/rssManager");
const { connectToDatabase } = require("./src/managers/dbManager");
const { seedInitialData } = require("./src/managers/dbSeeder");


let Cluster;
try {
  Cluster = require("discord-hybrid-sharding");
} catch (_) {}

const isClusterChild = Boolean(
  Cluster && typeof Cluster.data?.CLUSTER === "number",
);
// Identitas shard. SHARD_ID hanya terisi bila proses ini dijalankan oleh ShardingManager.
const isShardChild = typeof env.SHARD_ID !== "undefined";
const isPrimaryShard = isClusterChild
  ? Cluster.data.CLUSTER === 0
  : !isShardChild || env.SHARD_ID === "0";

// Saat berjalan mandiri (node index.js), validasi tetap berjalan informatif
if (!env.validateEnv({ fatal: false })) {
  logger.warn(
    `[BOOT] Konfigurasi environment belum lengkap. Menjalankan sistem dengan SQLite fallback & Web Dashboard.`,
  );
}

const client = new Client({
  intents: clientOptions.intents,
  partials: clientOptions.partials,
  // Batas cache dan penyapu dipusatkan di src/config/clientOptions.js supaya pemakaian
  // memori bisa diaudit di satu tempat, bukan tersebar di pemanggilan Client.
  makeCache: clientOptions.makeCache,
  sweepers: clientOptions.sweepers,
  rest: clientOptions.rest,
  ...(isClusterChild
    ? {
        shards: Cluster.data.SHARD_LIST,
        shardCount: Cluster.data.TOTAL_SHARDS,
      }
    : {}),
});

if (isClusterChild) {
  client.cluster = new Cluster.Client(client);
}

client.commands = new Collection();
client.musicManager = new MusicManager(client);
client.rssManager = new RssManager(client);

// Inisialisasi ServiceContainer dan EventBus sebagai Composition Root
const container = require("./src/core/container");
const eventBus = require("./src/core/eventBus");

container.value("env", env);
container.value("logger", logger);
container.value("eventBus", eventBus);
container.value("redisManager", redisManager);
container.value("mongoManager", mongoManager);
container.value("cacheManager", require("./src/managers/cacheManager"));
container.value("client", client);
container.value("musicManager", client.musicManager);
container.value("rssManager", client.rssManager);
const lifecycleManager = require("./src/managers/lifecycleManager");
container.value("lifecycleManager", lifecycleManager);
container.singleton("economyContract", () => require("./src/domain/contracts/economyContract"));
container.singleton("survivalContract", () => require("./src/domain/contracts/survivalContract"));
container.singleton("musicContract", () => require("./src/domain/contracts/musicContract"));

const { setupErrorHandlers } = require("./src/managers/errorHandler");
setupErrorHandlers(client);

loadEvents(client, path.join(__dirname, "src", "events"));

async function startBot() {
  console.log(
    "\n\x1b[46m\x1b[30m \u2699\ufe0f BOOT SEQUENCE \x1b[0m \x1b[36mMemulai proses inisialisasi sistem...\x1b[0m\n",
  );

  const sysStatus = {
    db: "\x1b[31m\ud83d\udd34 OFFLINE   \x1b[0m",
    mongo: "\x1b[33m\ud83d\udfe1 SKIPPED   \x1b[0m",
    redis: "\x1b[33m\ud83d\udfe1 SKIPPED   \x1b[0m",
    music: "\x1b[32m\ud83d\udfe2 INITIALIZED\x1b[0m",
    cmds: "\x1b[33m\ud83d\udfe1 BACKGROUND\x1b[0m",
    rss: "\x1b[32m\ud83d\udfe2 ACTIVE    \x1b[0m",
  };

  try {
    const commandPath = path.join(__dirname, "plugin");
    const commandHandler = new CommandHandler(client, commandPath);

    // Slash Command bersifat global, jadi cukup dideploy SEKALI per boot.
    // --deploy    : paksa deploy (dipakai `npm run deploy`)
    // --no-deploy : lewati deploy sepenuhnya
    const shouldDeploy =
      !process.argv.includes("--no-deploy") &&
      (process.argv.includes("--deploy") || isPrimaryShard);

    if (!shouldDeploy) {
      logger.info(
        `[DEPLOY] Shard #${env.SHARD_ID} melewati deploy slash command (ditangani shard utama).`,
      );
    }

    await commandHandler.load(shouldDeploy);
    sysStatus.cmds = "\x1b[32m\ud83d\udfe2 LOADED    \x1b[0m";

    try {
      const dbConnected = await connectToDatabase();
      if (dbConnected) {
        sysStatus.db = "\x1b[32m\ud83d\udfe2 CONNECTED \x1b[0m";
        await seedInitialData();
      } else {
        sysStatus.db = "\x1b[31m\ud83d\udd34 FALLBACK  \x1b[0m";
      }
    } catch (error) {
      sysStatus.db = "\x1b[31m\ud83d\udd34 ERROR     \x1b[0m";
      logger.error("[BOOT] Koneksi database gagal:", error.message);
    }

    if (env.MONGODB_URI) {
      try {
        const mongoConnected = await Promise.race([
          mongoManager.connect(),
          new Promise((resolve) => setTimeout(() => resolve(false), 4000)),
        ]);
        if (mongoConnected) {
          sysStatus.mongo = "\x1b[32m\ud83d\udfe2 CONNECTED \x1b[0m";
        } else {
          sysStatus.mongo = "\x1b[33m\ud83d\udfe1 CONNECTING\x1b[0m";
        }
      } catch (mongoErr) {
        sysStatus.mongo = "\x1b[31m\ud83d\udd34 ERROR     \x1b[0m";
        logger.error("[BOOT] Koneksi MongoDB gagal:", mongoErr.message);
      }
    }

    if (env.REDIS_URL) {
      try {
        await Promise.race([
          redisManager.connect(),
          new Promise((resolve) => setTimeout(() => resolve(false), 4000)),
        ]);
        sysStatus.redis = "\x1b[32m\ud83d\udfe2 CONNECTED \x1b[0m";
        if (redisManager.isReady) {
          eventBus.attachRedisBridge(redisManager).catch(() => {});
        }
      } catch (redisErr) {
        sysStatus.redis = "\x1b[33m\ud83d\udfe1 STANDBY   \x1b[0m";
      }
    }

    client.once("clientReady", () => {
      if (client.musicManager.initialize) client.musicManager.initialize();
      if (client.rssManager.init) client.rssManager.init();

      // Boot screen dicetak di sini, bukan setelah setTimeout, agar status yang
      // ditampilkan benar-benar mencerminkan koneksi yang sudah jadi.
      const { displayBootScreen } = require("./src/utils/bootScreen");
      displayBootScreen(client, sysStatus);

      // Pendengar invalidasi cache lintas shard. Dipasang di SEMUA shard, bukan
      // hanya shard utama, karena setiap shard memegang peta state di memorinya
      // sendiri (misalnya client.globalChatChannels).
      const cacheInvalidator = require("./src/managers/cacheInvalidator");
      cacheInvalidator.initSubscriber(client);

      // Web Dashboard dijalankan pada shard utama
      if (!isPrimaryShard) {
        logger.info(
          `[DASHBOARD] Shard #${env.SHARD_ID} melewati Web Dashboard (dijalankan shard utama).`,
        );
      }
    });

    if (isPrimaryShard) {
      try {
        const dashboardInstance = require("./dashboard/server.js")(container);
        if (dashboardInstance) {
          container.value("dashboardServer", dashboardInstance);
        }
      } catch (err) {
        logger.error(
          "\x1b[41m\x1b[37m 💥 ERROR \x1b[0m \x1b[31mGagal menjalankan Web Dashboard:\x1b[0m",
          err.message,
        );
      }
    }

    const cronManager = require("./src/managers/cronManager");
    cronManager.init(client);

    const clusterManager = require("./src/managers/clusterManager");
    clusterManager.startStatsPublisher(client);

    // Start periodic API health check (hanya di primary shard)
    if (isPrimaryShard) {
      try {
        const apiHealthService = require("./src/services/apiHealthService");
        apiHealthService.startPeriodicCheck(300000); // Check setiap 5 menit
        logger.info("[BOOT] API Health Check service started (interval: 5 minutes)");
      } catch (err) {
        logger.warn("[BOOT] Failed to start API Health Check:", err.message);
      }
    }

    if (env.TOKEN) {
      try {
        await client.login(env.TOKEN);
      } catch (loginErr) {
        logger.error(
          "[BOOT] Gagal login ke Discord Gateway:",
          loginErr.message,
        );
      }
    } else {
      logger.info(
        "[BOOT] DISCORD_TOKEN tidak disetel. Web Dashboard aktif pada port 3000.",
      );
    }
  } catch (error) {
    logger.error(
      "\n\x1b[41m\x1b[37m 💥 FATAL ERROR \x1b[0m \x1b[31mTerjadi kesalahan fatal saat booting:\x1b[0m\n",
      error,
    );
    process.exitCode = 1;
  }
}

startBot();

async function shutdown() {
  await lifecycleManager.executeShutdown(client, {
    user: "OS Signal",
    reason: "Signal SIGINT/SIGTERM diterima",
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Listener sinyal IPC dari manager (ShardingManager / ClusterManager)
function handleIpcMessage(msg) {
  if (msg?.type === "MANAGER_SHUTDOWN") {
    lifecycleManager.executeShutdown(client, {
      user: "Cluster Manager",
      reason: "Perintah shutdown terdistribusi dari manager",
    });
  } else if (msg?.type === "MAINTENANCE_SYNC") {
    lifecycleManager.applyMaintenanceLocally(client, msg.enabled, msg.reason);
  }
}

if (typeof process.on === "function") {
  process.on("message", handleIpcMessage);
}

try {
  const { parentPort } = require("node:worker_threads");
  if (parentPort && typeof parentPort.on === "function") {
    parentPort.on("message", handleIpcMessage);
  }
} catch (_) {}
