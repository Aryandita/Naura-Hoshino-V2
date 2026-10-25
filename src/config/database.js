"use strict";

const { Sequelize } = require("sequelize");
const env = require("./env");
const { logger } = require("../managers/logger");

const isSupabaseConfig = Boolean(
  (env.DB_HOST && env.DB_HOST.includes("supabase")) ||
    (env.DATABASE_URL && env.DATABASE_URL.includes("supabase")) ||
    env.SUPABASE_URL ||
    env.SUPABASE_KEY,
);

const poolMetrics = {
  totalAcquired: 0,
  totalReleased: 0,
  currentUsed: 0,
  peakUsed: 0,
  acquireErrors: 0,
  lastAcquireTime: null,
};

const isExternalDb =
  !env.USE_SQLITE &&
  Boolean(
    env.DATABASE_URL ||
    (env.DB_NAME &&
      env.DB_USER &&
      env.DB_PASS &&
      env.DB_HOST &&
      env.DB_HOST !== "sqlite" &&
      (env.USE_MYSQL ||
        env.DB_DIALECT === "postgres" ||
        isSupabaseConfig ||
        (env.DB_HOST !== "127.0.0.1" && env.DB_HOST !== "localhost"))),
  );

const hasMySQLConfig = isExternalDb;
const hasSupabaseConfig = isExternalDb && isSupabaseConfig;
const SHARD_COUNT = env.TOTAL_SHARDS > 0 ? env.TOTAL_SHARDS : 1;
const POOL_MAX =
  env.DB_POOL_MAX > 0
    ? env.DB_POOL_MAX
    : Math.max(5, Math.floor(env.DB_POOL_BUDGET / SHARD_COUNT));

const determineDialect = () => {
  if (env.DB_DIALECT) return env.DB_DIALECT.toLowerCase();
  if (
    env.DATABASE_URL &&
    (env.DATABASE_URL.startsWith("postgres://") ||
      env.DATABASE_URL.startsWith("postgresql://"))
  ) {
    return "postgres";
  }
  if (
    env.DB_PORT === 5432 ||
    env.DB_PORT === 6543 ||
    (env.DB_HOST &&
      (env.DB_HOST.includes("supabase") || env.DB_HOST.includes("postgres"))) ||
    env.SUPABASE_URL
  ) {
    return "postgres";
  }
  return "postgres";
};

const dialect = determineDialect();

const getDialectOptions = () => {
  const isSupabase =
    isSupabaseConfig ||
    (env.DB_HOST && env.DB_HOST.includes("supabase")) ||
    (env.DATABASE_URL && env.DATABASE_URL.includes("supabase"));

  const needsSsl = env.DB_SSL || isSupabase;

  if (dialect === "postgres") {
    return {
      connectTimeout: 120000,
      keepAlive: true,
      statement_timeout: 30000,
      ...(needsSsl
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : {}),
    };
  }

  return { connectTimeout: 120000 };
};

const createSequelizeInstance = () => {
  if (!isExternalDb) {
    return new Sequelize({
      dialect: "sqlite",
      storage: "./naura_fallback.sqlite",
      logging: false,
    });
  }

  const poolConfig = {
    max: POOL_MAX,
    min: 0,
    acquire: 120000,
    idle: 10000,
    evict: 10000,
  };

  const retryConfig = {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /ConnectionResetError/,
      /read ECONNRESET/,
      /ETIMEDOUT/,
    ],
  };

  const dialectOptions = getDialectOptions();

  let instance;
  if (env.DATABASE_URL) {
    instance = new Sequelize(env.DATABASE_URL, {
      dialect,
      logging: false,
      dialectOptions,
      pool: poolConfig,
      retry: retryConfig,
    });
  } else {
    const defaultPort = dialect === "postgres" ? 5432 : 3306;
    instance = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
      host: env.DB_HOST,
      port: env.DB_PORT || defaultPort,
      dialect,
      logging: false,
      dialectOptions,
      pool: poolConfig,
      retry: retryConfig,
    });
  }

  try {
    if (instance.connectionManager?.pool && typeof instance.connectionManager.pool.on === "function") {
      instance.connectionManager.pool.on("acquire", () => {
        poolMetrics.totalAcquired++;
        poolMetrics.currentUsed++;
        poolMetrics.lastAcquireTime = Date.now();
        if (poolMetrics.currentUsed > poolMetrics.peakUsed) {
          poolMetrics.peakUsed = poolMetrics.currentUsed;
        }
      });

      instance.connectionManager.pool.on("release", () => {
        poolMetrics.totalReleased++;
        poolMetrics.currentUsed = Math.max(0, poolMetrics.currentUsed - 1);
      });

      instance.connectionManager.pool.on("error", (err) => {
        poolMetrics.acquireErrors++;
        logger.error("[Database] Pool acquire error: " + (err?.message || err));
      });
    }
  } catch (err) {
    logger.debug("[Database] Gagal memasang pool metrics listener: " + (err?.message || err));
  }

  return instance;
};

const sequelize = createSequelizeInstance();

function getPoolMetrics() {
  return {
    ...poolMetrics,
    poolMax: POOL_MAX,
    utilizationPercent:
      POOL_MAX > 0 ? Math.round((poolMetrics.currentUsed / POOL_MAX) * 100) : 0,
  };
}

module.exports = {
  sequelize,
  hasMySQLConfig,
  hasSupabaseConfig,
  hasDatabaseConfig: isExternalDb,
  isSupabaseConfig,
  SHARD_COUNT,
  POOL_MAX,
  getPoolMetrics,
};
