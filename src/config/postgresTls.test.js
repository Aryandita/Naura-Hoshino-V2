"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const tls = require("node:tls");
const {
  validatePostgresUrl,
  postgresSslOptions,
  isSupabasePostgresHost,
} = require("./postgresTls");

test("PostgreSQL URL cannot override TLS, target, or credentials, including encoded and repeated keys", () => {
  for (const query of ["sslmode=disable", "ssl=0", "sslmode=no-verify", "uselibpqcompat=true&sslmode=require", "sslrootcert=/tmp/ca", "%73slmode=disable", "application_name=ok&sslmode=verify-full&sslmode=disable", "SSL=0"]) {
    assert.throws(() => validatePostgresUrl("postgres://user:secret@localhost/db?" + query), /must not contain SSL parameters/);
  }
  for (const query of ["host=evil.example", "hostaddr=127.0.0.1", "port=5433", "password=override", "options=-c%20ssl=off"]) {
    assert.throws(() => validatePostgresUrl("postgres://user:secret@localhost/db?" + query), /must not override connection target/);
  }
  assert.throws(() => validatePostgresUrl("postgres:///db"), /must include a hostname/);
  assert.doesNotThrow(() => validatePostgresUrl("postgres://user:secret@localhost/db?application_name=naura"));
  assert.throws(() => validatePostgresUrl("not a url"), /Invalid PostgreSQL/);
  assert.throws(() => validatePostgresUrl("postgres://localhost/db?sslmode=disable", "mysql"), /does not match/);
  assert.throws(() => validatePostgresUrl("mysql://localhost/db", "postgres"), /does not match/);
  assert.doesNotThrow(() => validatePostgresUrl("mysql://localhost/db", "mysql"));
});

test("TLS verifies server, validates PEM CA, and rejects dangerous overrides", () => {
  assert.deepEqual(postgresSslOptions(true, "", {}), { require: true, rejectUnauthorized: true });
  assert.equal(postgresSslOptions(false, "", {}), false);
  assert.throws(() => postgresSslOptions(false, "/tmp/ca.pem", {}), /cannot be set when DB_SSL is disabled/);
  assert.throws(() => postgresSslOptions(true, "", { NODE_TLS_REJECT_UNAUTHORIZED: "0" }), /NODE_TLS_REJECT_UNAUTHORIZED=0/);
  for (const mode of ["disable", "allow", "prefer", "no-verify", "DISABLE"]) {
    assert.throws(() => postgresSslOptions(true, "", { PGSSLMODE: mode }), /Insecure PGSSLMODE/);
  }
  assert.deepEqual(postgresSslOptions(true, "", { PGSSLMODE: "verify-full" }), { require: true, rejectUnauthorized: true });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "naura-tls-"));
  try {
    const ca = path.join(dir, "ca.pem");
    fs.writeFileSync(ca, tls.rootCertificates[0]);
    assert.equal(postgresSslOptions(true, ca, {}).ca, tls.rootCertificates[0]);
    fs.writeFileSync(ca, "not a pem certificate");
    assert.throws(() => postgresSslOptions(true, ca, {}), /valid PEM/);
    fs.writeFileSync(ca, "");
    assert.throws(() => postgresSslOptions(true, ca, {}), /empty/);
    assert.throws(() => postgresSslOptions(true, path.join(dir, "missing"), {}), /Cannot read/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("isSupabasePostgresHost recognizes Supabase endpoints and rejects local hosts", () => {
  assert.equal(isSupabasePostgresHost("db.pzwuextkmfqphxzckvfz.supabase.co"), true);
  assert.equal(isSupabasePostgresHost("aws-0-ap-southeast-1.pooler.supabase.com"), true);
  assert.equal(isSupabasePostgresHost("postgresql://postgres.pzwuextkmfqphxzckvfz:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"), true);
  assert.equal(isSupabasePostgresHost("localhost"), false);
  assert.equal(isSupabasePostgresHost("127.0.0.1"), false);
  assert.equal(isSupabasePostgresHost(""), false);
});

// Exercise the real Sequelize constructor through the application config without
// loading .env or opening a database connection.
test("application configuration rejects URL protocol mismatch and Supabase TLS disable before Sequelize", async () => {
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
    config.DATABASE_URL = "postgres://postgres.pzwuextkmfqphxzckvfz:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";
    config.DB_SSL = false;
    delete require.cache[databaseId];
    assert.throws(() => require("./database"), /Refusing to disable PostgreSQL TLS/);
    config.DATABASE_URL = "postgres://user:secret@localhost/db?application_name=naura";
    config.DB_SSL = true;
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
