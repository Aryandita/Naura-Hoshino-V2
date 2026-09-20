"use strict";

const { Sequelize } = require("sequelize");
const env = require("./env");

const isSupabaseConfig = Boolean(
  (env.DB_HOST && env.DB_HOST.includes("supabase")) ||
  (env.DATABASE_URL && env.DATABASE_URL.includes("supabase")) ||
  env.SUPABASE_URL ||
  env.SUPABASE_KEY,
);

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

  if (env.DATABASE_URL) {
    return new Sequelize(env.DATABASE_URL, {
      dialect,
      logging: false,
      dialectOptions,
      pool: poolConfig,
      retry: retryConfig,
    });
  }

  const defaultPort = dialect === "postgres" ? 5432 : 3306;
  return new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
    host: env.DB_HOST,
    port: env.DB_PORT || defaultPort,
    dialect,
    logging: false,
    dialectOptions,
    pool: poolConfig,
    retry: retryConfig,
  });
};

const sequelize = createSequelizeInstance();

module.exports = {
  sequelize,
  hasMySQLConfig,
  hasSupabaseConfig,
  hasDatabaseConfig: isExternalDb,
  isSupabaseConfig,
  SHARD_COUNT,
  POOL_MAX,
};
