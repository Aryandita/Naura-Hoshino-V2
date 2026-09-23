"use strict";

/**
 * inspect-db.js - Polyglot Database & Cache Diagnostic Inspector
 * Memeriksa status kesehatan koneksi PostgreSQL/Supabase, Redis, MongoDB, dan fallback SQLite.
 * Dilengkapi pembatas batas waktu (timeout guard) 5 detik agar tidak memblokir proses di lingkungan terbatas.
 *
 * Penggunaan:
 *   node scripts/inspect-db.js
 *   npm run db:inspect
 */

const fs = require("fs");
const path = require("path");
const env = require("../src/config/env");
const { sequelize } = require("../src/managers/dbManager");
const UserProfile = require("../src/models/UserProfile");
const UserSurvival = require("../src/models/UserSurvival");
const ServerTreasury = require("../src/models/ServerTreasury");
const redisManager = require("../src/managers/redisManager");
const mongoManager = require("../src/managers/mongoManager");
const mongoose = require("mongoose");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

/**
 * Bungkus promise dengan batas waktu maksimal
 */
function withTimeout(
  promise,
  timeoutMs = 5000,
  errorMsg = "Batas waktu koneksi terlampaui (Timeout)",
) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${errorMsg} (${timeoutMs / 1000}s)`)),
        timeoutMs,
      ),
    ),
  ]);
}

async function inspectPostgres() {
  const start = Date.now();
  try {
    await withTimeout(
      sequelize.authenticate(),
      5000,
      "Koneksi PostgreSQL/Supabase timeout",
    );
    const latency = Date.now() - start;

    const [userCount, survivalCount, treasuryCount] = await Promise.all([
      withTimeout(UserProfile.count(), 3000).catch(() => "N/A"),
      withTimeout(UserSurvival.count(), 3000).catch(() => "N/A"),
      withTimeout(ServerTreasury.count(), 3000).catch(() => "N/A"),
    ]);

    let migrationCount = 0;
    try {
      const [results] = await withTimeout(
        sequelize.query("SELECT count(*) as count FROM schema_migrations;"),
        3000,
      );
      migrationCount = results?.[0]?.count || 0;
    } catch {
      migrationCount = "Belum diinisialisasi";
    }

    const dialect = (sequelize.options.dialect || "postgres").toUpperCase();

    return {
      ok: true,
      dialect,
      latency,
      details: {
        "Host / Dialect": dialect,
        "Latensi Ping": `${latency}ms`,
        "UserProfile Records": userCount,
        "UserSurvival Records": survivalCount,
        "ServerTreasury Records": treasuryCount,
        "Skema Migrasi Selesai": migrationCount,
      },
    };
  } catch (err) {
    return {
      ok: false,
      dialect: "POSTGRESQL",
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

async function inspectRedis() {
  const start = Date.now();
  try {
    if (!env.REDIS_URL && !process.env.REDIS_URL) {
      return {
        ok: false,
        skipped: true,
        reason: "REDIS_URL tidak dikonfigurasi di environment.",
      };
    }

    // Sambungkan redis jika belum ready
    if (!redisManager.isReady) {
      await withTimeout(redisManager.connect(), 4000, "Koneksi Redis timeout");
    }

    if (!redisManager.isReady || !redisManager.client) {
      return {
        ok: false,
        skipped: true,
        reason: "Redis server tidak merespons (In-Memory cache aktif)",
      };
    }

    const client = redisManager.client;
    const pingRes = await withTimeout(
      client.ping(),
      2000,
      "Ping Redis timeout",
    );
    const latency = Date.now() - start;

    let dbSize = 0;
    try {
      dbSize = await withTimeout(client.dbSize(), 2000);
    } catch {
      dbSize = "N/A";
    }

    return {
      ok: true,
      latency,
      details: {
        "Status Ping": pingRes,
        "Latensi Ping": `${latency}ms`,
        "Total Keys Tersimpan": dbSize,
        "Mode Cache": "Redis Cluster / Standalone (Aktif)",
      },
    };
  } catch (err) {
    return {
      ok: false,
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

async function inspectMongo() {
  const start = Date.now();
  try {
    if (!env.MONGODB_URI) {
      return {
        ok: false,
        skipped: true,
        reason: "MONGODB_URI tidak dikonfigurasi (Audit logs opsional).",
      };
    }

    if (!mongoManager.isReady) {
      await withTimeout(
        mongoManager.connect(),
        4000,
        "Koneksi MongoDB timeout",
      );
    }

    const latency = Date.now() - start;
    const collections = await withTimeout(
      mongoose.connection.db.listCollections().toArray(),
      3000,
    );

    return {
      ok: true,
      latency,
      details: {
        "Status Koneksi": "Terhubung ke Cloud Atlas",
        Latensi: `${latency}ms`,
        "Total Koleksi": collections.length,
        "Nama Koleksi":
          collections
            .map((c) => c.name)
            .slice(0, 5)
            .join(", ") || "(Kosong)",
      },
    };
  } catch (err) {
    return {
      ok: false,
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

function inspectSqlite() {
  const sqlitePath = path.resolve(__dirname, "..", "database.sqlite");
  if (fs.existsSync(sqlitePath)) {
    const stat = fs.statSync(sqlitePath);
    const sizeKb = (stat.size / 1024).toFixed(2);
    return {
      ok: true,
      details: {
        "Lokasi File": "database.sqlite",
        "Ukuran File": `${sizeKb} KB`,
        Status: "Tersedia sebagai fallback offline",
      },
    };
  }
  return {
    ok: true,
    details: {
      Status: "Tidak aktif (Menggunakan PostgreSQL/Supabase Cloud utama)",
    },
  };
}

async function run() {
  console.log(
    `\n${C.bold}${C.cyan}====================================================${C.reset}`,
  );
  console.log(
    `${C.bold}${C.cyan}  NAURA HOSHINO V2 - POLYGLOT DATABASE INSPECTOR    ${C.reset}`,
  );
  console.log(
    `${C.bold}${C.cyan}====================================================${C.reset}\n`,
  );

  console.log(
    `${C.gray}[1/4] Memeriksa Relational Database (PostgreSQL / Supabase)...${C.reset}`,
  );
  const pgResult = await inspectPostgres();

  console.log(`${C.gray}[2/4] Memeriksa In-Memory Cache (Redis)...${C.reset}`);
  const redisResult = await inspectRedis();

  console.log(`${C.gray}[3/4] Memeriksa Document Store (MongoDB)...${C.reset}`);
  const mongoResult = await inspectMongo();

  console.log(`${C.gray}[4/4] Memeriksa Fallback Store (SQLite)...${C.reset}`);
  const sqliteResult = inspectSqlite();

  console.log(`\n${C.bold}HASIL DIAGNOSTIK KONEKSI DATABASE:${C.reset}\n`);

  // 1. PostgreSQL / Supabase
  if (pgResult.ok) {
    console.log(
      `  ${C.green}[OK]${C.reset} ${C.bold}PostgreSQL / Supabase Cloud${C.reset} (${pgResult.latency}ms)`,
    );
    for (const [k, v] of Object.entries(pgResult.details)) {
      console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
    }
  } else {
    console.log(
      `  ${C.red}[FAIL]${C.reset} ${C.bold}PostgreSQL / Supabase Cloud${C.reset}`,
    );
    console.log(`       - Error: ${C.red}${pgResult.error}${C.reset}`);
  }
  console.log("");

  // 2. Redis
  if (redisResult.ok) {
    console.log(
      `  ${C.green}[OK]${C.reset} ${C.bold}Redis Cache & Distributed Mutex${C.reset} (${redisResult.latency}ms)`,
    );
    for (const [k, v] of Object.entries(redisResult.details)) {
      console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
    }
  } else if (redisResult.skipped) {
    console.log(
      `  ${C.yellow}[LEWATI]${C.reset} ${C.bold}Redis Cache${C.reset}: ${redisResult.reason}`,
    );
  } else {
    console.log(`  ${C.red}[FAIL]${C.reset} ${C.bold}Redis Cache${C.reset}`);
    console.log(`       - Error: ${C.red}${redisResult.error}${C.reset}`);
  }
  console.log("");

  // 3. MongoDB
  if (mongoResult.ok) {
    console.log(
      `  ${C.green}[OK]${C.reset} ${C.bold}MongoDB Audit & Chat Logs${C.reset} (${mongoResult.latency}ms)`,
    );
    for (const [k, v] of Object.entries(mongoResult.details)) {
      console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
    }
  } else if (mongoResult.skipped) {
    console.log(
      `  ${C.yellow}[LEWATI]${C.reset} ${C.bold}MongoDB${C.reset}: ${mongoResult.reason}`,
    );
  } else {
    console.log(`  ${C.red}[FAIL]${C.reset} ${C.bold}MongoDB${C.reset}`);
    console.log(`       - Error: ${C.red}${mongoResult.error}${C.reset}`);
  }
  console.log("");

  // 4. SQLite
  console.log(
    `  ${C.green}[OK]${C.reset} ${C.bold}SQLite Local Fallback${C.reset}`,
  );
  for (const [k, v] of Object.entries(sqliteResult.details)) {
    console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
  }

  console.log(
    `\n${C.bold}${C.cyan}====================================================${C.reset}\n`,
  );

  // Bersihkan koneksi
  try {
    await sequelize.close();
  } catch {}
  try {
    if (redisManager.isReady) await redisManager.disconnect();
  } catch {}
  try {
    if (mongoManager.isReady) await mongoose.disconnect();
  } catch {}

  process.exit(pgResult.ok ? 0 : 1);
}

run().catch((err) => {
  console.error("Kesalahan tak terduga saat inspeksi database:", err);
  process.exit(1);
});
