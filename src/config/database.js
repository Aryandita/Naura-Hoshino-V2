"use strict";

const { Sequelize } = require("sequelize");
const env = require("./env");

const hasMySQLConfig =
  !env.USE_SQLITE &&
  Boolean(
    env.DB_NAME &&
      env.DB_USER &&
      env.DB_HOST &&
      env.DB_HOST !== "sqlite" &&
      (env.USE_MYSQL ||
        (env.DB_HOST !== "127.0.0.1" && env.DB_HOST !== "localhost")),
  );
const SHARD_COUNT = env.TOTAL_SHARDS > 0 ? env.TOTAL_SHARDS : 1;
const POOL_MAX =
  env.DB_POOL_MAX > 0
    ? env.DB_POOL_MAX
    : Math.max(5, Math.floor(env.DB_POOL_BUDGET / SHARD_COUNT));

const sequelize = hasMySQLConfig
  ? new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
      host: env.DB_HOST,
      port: env.DB_PORT,
      dialect: "mysql",
      logging: false,
      dialectOptions: { connectTimeout: 120000 },
      pool: {
        max: POOL_MAX,
        min: 2,
        acquire: 120000,
        idle: 15000,
        evict: 5000,
      },
    })
  : new Sequelize({
      dialect: "sqlite",
      storage: "./naura_fallback.sqlite",
      logging: false,
    });

module.exports = {
  sequelize,
  hasMySQLConfig,
  SHARD_COUNT,
  POOL_MAX,
};
