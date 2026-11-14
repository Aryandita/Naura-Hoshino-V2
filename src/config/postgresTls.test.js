"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const tls = require("node:tls");
const { validatePostgresUrl, postgresSslOptions } = require("./postgresTls");

test("PostgreSQL URL cannot override TLS, including encoded and repeated keys", () => {
  for (const query of ["sslmode=disable", "ssl=0", "sslmode=no-verify", "uselibpqcompat=true&sslmode=require", "sslrootcert=/tmp/ca", "%73slmode=disable", "application_name=ok&sslmode=verify-full&sslmode=disable", "SSL=0"]) {
    assert.throws(() => validatePostgresUrl("postgres://user:secret@localhost/db?" + query), /must not contain SSL parameters/);
  }
  assert.doesNotThrow(() => validatePostgresUrl("postgres://user:secret@localhost/db?application_name=naura"));
  assert.throws(() => validatePostgresUrl("not a url"), /Invalid PostgreSQL/);
  assert.throws(() => validatePostgresUrl("postgres://localhost/db?sslmode=disable", "mysql"), /does not match/);
  assert.throws(() => validatePostgresUrl("mysql://localhost/db", "postgres"), /does not match/);
  assert.doesNotThrow(() => validatePostgresUrl("mysql://localhost/db", "mysql"));
});

test("TLS verifies server and optionally loads the configured CA", () => {
  assert.deepEqual(postgresSslOptions(true, ""), { require: true, rejectUnauthorized: true });
  assert.equal(postgresSslOptions(false, ""), false);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "naura-tls-"));
  try {
    const ca = path.join(dir, "ca.pem");
    fs.writeFileSync(ca, tls.rootCertificates[0]);
    assert.equal(postgresSslOptions(true, ca).ca, tls.rootCertificates[0]);
    fs.writeFileSync(ca, "");
    assert.throws(() => postgresSslOptions(true, ca), /empty/);
    assert.throws(() => postgresSslOptions(true, path.join(dir, "missing")), /Cannot read/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Exercise the real Sequelize constructor through the application config without
// loading .env or opening a database connection.
test("application configuration rejects URL protocol mismatch before Sequelize", async () => {
  const envId = require.resolve("./env");
  const loggerId = require.resolve("../managers/logger");
  const databaseId = require.resolve("./database");
  const oldEnv = require.cache[envId];
  const oldLogger = require.cache[loggerId];
  const oldDatabase = require.cache[databaseId];
  const config = { DATABASE_URL: "postgres://user:secret@localhost/db?sslmode=disable", DB_DIALECT: "mysql", DB_SSL: true, DB_POOL_BUDGET: 5 };
  try {
    require.cache[envId] = { id: envId, filename: envId, loaded: true, exports: config };
    require.cache[loggerId] = { id: loggerId, filename: loggerId, loaded: true, exports: { logger: { debug() {}, error() {} } } };
    delete require.cache[databaseId];
    assert.throws(() => require("./database"), /does not match/);
    config.DB_DIALECT = "postgres";
    delete require.cache[databaseId];
    assert.throws(() => require("./database"), /must not contain SSL parameters/);
    config.DATABASE_URL = "postgres://user:secret@localhost/db?application_name=naura";
    delete require.cache[databaseId];
    const { sequelize } = require("./database");
    assert.equal(sequelize.options.dialectOptions.ssl.rejectUnauthorized, true);
    await sequelize.close();
  } finally {
    for (const [id, original] of [[envId, oldEnv], [loggerId, oldLogger], [databaseId, oldDatabase]]) {
      if (original) require.cache[id] = original; else delete require.cache[id];
    }
  }
});

