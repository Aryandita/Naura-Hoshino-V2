"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DataTypes } = require("sequelize");
const {
  PRODUCTION_SUPABASE_PROJECT_ID,
  DEFAULT_STAGING_SUPABASE_PROJECT_ID,
  STAGING_REQUIRED_TABLES,
  resolveEffectivePostgresTarget,
  assertPrologueStagingSafety,
  verifyPrologueStagingDatabase,
  getSyntheticUserProfile,
  getSyntheticUserSurvival,
  isAllowedPrologueStagingInteraction,
} = require("./prologueStagingIsolation");
const { remediateStagingTableGrants } = require("../managers/dbMigrator");
const {
  executeRemoteStagingSmokeWithDb,
} = require("../../scripts/run-isolated-story-tests");

test("assertPrologueStagingSafety tidak aktif saat PROLOGUE_STAGING_MODE false", () => {
  const res = assertPrologueStagingSafety({
    PROLOGUE_STAGING_MODE: false,
    STORY_STAGING_MODE: false,
    DATABASE_URL: `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_ID}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  });
  assert.deepStrictEqual(res, { staging: false });
});

test("assertPrologueStagingSafety menolak proyek produksi dan menerima staging valid", () => {
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_ID}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
        GUILD_ID: "123456789012345678",
      }),
    /produksi/i,
  );

  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: `postgresql://postgres.${DEFAULT_STAGING_SUPABASE_PROJECT_ID}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
        SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`,
        GUILD_ID: "123456789012345678",
      }),
    /produksi/i,
  );

  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: `postgresql://postgres.${DEFAULT_STAGING_SUPABASE_PROJECT_ID}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
        GUILD_ID: "",
      }),
    /GUILD_ID/i,
  );

  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DB_DIALECT: "sqlite",
        GUILD_ID: "123456789012345678",
      }),
    /PostgreSQL/i,
  );

  const valid = assertPrologueStagingSafety({
    PROLOGUE_STAGING_MODE: true,
    STORY_STAGING_PROJECT_ID: DEFAULT_STAGING_SUPABASE_PROJECT_ID,
    DATABASE_URL: `postgresql://postgres.${DEFAULT_STAGING_SUPABASE_PROJECT_ID}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    SUPABASE_URL: `https://${DEFAULT_STAGING_SUPABASE_PROJECT_ID}.supabase.co`,
    GUILD_ID: "123456789012345678",
  });
  assert.equal(valid.staging, true);
  assert.equal(valid.projectId, DEFAULT_STAGING_SUPABASE_PROJECT_ID);
  assert.equal(valid.guildId, "123456789012345678");
  assert.equal(valid.loopback, false);
});

test("assertPrologueStagingSafety mengatur target loopback dengan ALLOW_LOCAL_PROLOGUE_STAGING", () => {
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: "postgresql://naura_story_test:pw@127.0.0.1:55439/postgres",
        GUILD_ID: "123456789012345678",
      }),
    /ALLOW_LOCAL_PROLOGUE_STAGING/,
  );

  const ok = assertPrologueStagingSafety({
    PROLOGUE_STAGING_MODE: true,
    ALLOW_LOCAL_PROLOGUE_STAGING: "true",
    DATABASE_URL: "postgresql://naura_story_test:pw@127.0.0.1:55439/postgres",
    GUILD_ID: "123456789012345678",
  });
  assert.equal(ok.loopback, true);
});

test("data sintetis read-only memenuhi kebutuhan starter /survival profile story", () => {
  const profile = getSyntheticUserProfile("987654321");
  const survival = getSyntheticUserSurvival("987654321");
  assert.equal(profile.userId, "987654321");
  assert.ok(
    profile.inventory.some((item) => item && item.id === "survival_started"),
  );
  assert.equal(profile.toJSON().stagingSynthetic, true);
  assert.equal(survival.userId, "987654321");
  assert.equal(survival.hp, 100);
  assert.equal(survival.toJSON().stagingSynthetic, true);
});

test("isAllowedPrologueStagingInteraction membatasi interaksi hanya ke jalur prolog", () => {
  assert.equal(
    isAllowedPrologueStagingInteraction({
      isChatInputCommand: () => true,
      commandName: "survival",
      options: {
        getSubcommandGroup: () => "profile",
        getSubcommand: () => "story",
      },
    }),
    true,
  );
  assert.equal(
    isAllowedPrologueStagingInteraction({
      isChatInputCommand: () => true,
      commandName: "survival",
      options: {
        getSubcommandGroup: () => "economy",
        getSubcommand: () => "market",
      },
    }),
    false,
  );
  assert.equal(
    isAllowedPrologueStagingInteraction({
      isChatInputCommand: () => true,
      commandName: "play",
      options: {
        getSubcommandGroup: () => null,
        getSubcommand: () => null,
      },
    }),
    false,
  );
  assert.equal(
    isAllowedPrologueStagingInteraction({
      isMessageComponent: () => true,
      customId: "sol_deadbeef12345678_0",
    }),
    true,
  );
  assert.equal(
    isAllowedPrologueStagingInteraction({
      isMessageComponent: () => true,
      customId: "music_pause_btn",
    }),
    false,
  );
});

test("verifyPrologueStagingDatabase menolak tabel hilang dan memeriksa keutuhan 5 tabel", async () => {
  const runtimeEnv = {
    PROLOGUE_STAGING_MODE: true,
    DATABASE_URL: `postgresql://postgres.${DEFAULT_STAGING_SUPABASE_PROJECT_ID}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    GUILD_ID: "123456789012345678",
  };
  const incompleteDb = {
    options: { dialect: "postgres" },
    async query() {
      return [
        [
          {
            cache_write_journal: "cache_write_journal",
            business_operations: "business_operations",
            economy_transfer_taxes: null,
            economy_event_outbox: "economy_event_outbox",
            slice_of_life_progress_v1: null,
          },
        ],
      ];
    },
  };
  await assert.rejects(
    verifyPrologueStagingDatabase(incompleteDb, runtimeEnv),
    /economy_transfer_taxes, slice_of_life_progress_v1/,
  );

  assert.equal(STAGING_REQUIRED_TABLES.length, 5);
});

test("remediateStagingTableGrants mengeksekusi pencabutan PUBLIC/anon/authenticated pada Postgres", async () => {
  const executedSql = [];
  const fakePg = {
    options: { dialect: "postgres" },
    async query(sql) {
      executedSql.push(sql);
      return [[]];
    },
  };
  const res = await remediateStagingTableGrants(fakePg);
  assert.equal(res.remediated, true);
  assert.equal(executedSql.length, 1);
  assert.match(executedSql[0], /REVOKE ALL ON TABLE public\.%I FROM anon/);
  assert.match(
    executedSql[0],
    /REVOKE ALL ON TABLE public\.%I FROM authenticated/,
  );
  assert.match(executedSql[0], /slice_of_life_progress_v1/);

  const skipped = await remediateStagingTableGrants({
    options: { dialect: "sqlite" },
  });
  assert.equal(skipped.remediated, false);
});

test("assertPrologueStagingSafety menolak seluruh konfigurasi target campuran dan spoofing host/user", () => {
  const ref = DEFAULT_STAGING_SUPABASE_PROJECT_ID;
  const guildId = "123456789012345678";

  // 1. Repro persis temuan Codex: DATABASE_URL ke host sintetis lain, DB_USER tidak terpakai membawa ref staging
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: "postgresql://user:pw@synthetic.example.com:5432/postgres",
        DB_USER: `postgres.${ref}`,
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  // 2. DATABASE_URL membawa username ref staging tetapi host bukan endpoint Supabase
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: `postgresql://postgres.${ref}:pw@synthetic.example.com:5432/postgres`,
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  // 3. Pooler host bersifat multi-tenant: menolak user tanpa ref staging walau DB_USER membawa ref staging
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL:
          "postgresql://postgres:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
        DB_USER: `postgres.${ref}`,
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL:
          "postgresql://postgres:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  // 4. DATABASE_URL valid staging tetapi DB_HOST / DB_USER bertentangan
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
        DB_HOST: "synthetic.example.com",
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
        DB_USER: "postgres.otherproject123456",
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  // 5. Endpoint SDK Supabase menunjuk host sintetis / proyek lain
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
        SUPABASE_URL: "https://synthetic.example.com",
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DATABASE_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
        SUPABASE_PROJECT_ID: "otherproject123456",
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  // 6. Mode diskret harus memvalidasi DB_HOST dan DB_USER yang sebenarnya dipakai koneksi
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        DB_HOST: "synthetic.example.com",
        DB_USER: `postgres.${ref}`,
        DB_NAME: "postgres",
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  const validDiscrete = assertPrologueStagingSafety({
    PROLOGUE_STAGING_MODE: true,
    DB_HOST: `db.${ref}.supabase.co`,
    DB_USER: "postgres",
    DB_NAME: "postgres",
    GUILD_ID: guildId,
  });
  assert.equal(validDiscrete.connectionMode, "discrete");
  assert.equal(validDiscrete.pgHost, `db.${ref}.supabase.co`);
  assert.equal(validDiscrete.pgUser, "postgres");

  // 7. Mode loopback lokal menolak pencampuran kredensial pooler remote
  assert.throws(
    () =>
      assertPrologueStagingSafety({
        PROLOGUE_STAGING_MODE: true,
        ALLOW_LOCAL_PROLOGUE_STAGING: "true",
        DATABASE_URL: `postgresql://postgres.${ref}:pw@127.0.0.1:55439/postgres`,
        GUILD_ID: guildId,
      }),
    /MIXED_TARGET_REJECTED/,
  );

  // 8. Query parameter host/user di DATABASE_URL juga ditolak
  assert.throws(
    () =>
      resolveEffectivePostgresTarget({
        DATABASE_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?host=synthetic.example.com`,
      }),
    /override|host|URL/i,
  );
});

test("verifyPrologueStagingDatabase menolak instance Sequelize yang host/usernamenya menyimpang dari safety target", async () => {
  const ref = DEFAULT_STAGING_SUPABASE_PROJECT_ID;
  const runtimeEnv = {
    PROLOGUE_STAGING_MODE: true,
    DATABASE_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    GUILD_ID: "123456789012345678",
  };
  const mismatchedSequelize = {
    options: { dialect: "postgres" },
    config: {
      host: "synthetic.example.com",
      username: `postgres.${ref}`,
    },
    async query() {
      return [[]];
    },
  };
  await assert.rejects(
    verifyPrologueStagingDatabase(mismatchedSequelize, runtimeEnv),
    /MIXED_TARGET_REJECTED/,
  );
});

test("executeRemoteStagingSmokeWithDb melaporkan lulus hanya setelah DROP TABLE dan to_regclass bersih terverifikasi", async () => {
  const ref = DEFAULT_STAGING_SUPABASE_PROJECT_ID;
  const runtimeEnv = {
    STORY_REMOTE_STAGING_TEST: "true",
    STORY_STAGING_PROJECT_ID: ref,
    DATABASE_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  };

  function createFakeSequelize({ failDrop = false, leftoverTable = false } = {}) {
    let row = null;
    const events = [];
    return {
      events,
      options: { dialect: "postgres" },
      config: {
        host: "aws-0-ap-southeast-1.pooler.supabase.com",
        username: `postgres.${ref}`,
      },
      async authenticate() {
        events.push("authenticate");
      },
      define() {
        return {
          async findByPk() {
            return row ? { get: () => ({ ...row }) } : null;
          },
          async findOrCreate({ defaults }) {
            if (!row) row = { ...defaults };
            return [{ get: () => ({ ...row }) }];
          },
          async update(values, { where }) {
            if (
              row &&
              !row.completed &&
              row.scene === where.scene &&
              row.revision === where.revision
            ) {
              row = { ...values };
              return [1];
            }
            return [0];
          },
        };
      },
      async query(sql, opts) {
        events.push(sql);
        if (sql.startsWith("DROP TABLE")) {
          if (failDrop) {
            throw new Error("simulated drop failure");
          }
          return [[]];
        }
        if (sql.includes("to_regclass")) {
          return [[{ reg: leftoverTable ? opts?.replacements?.qualifiedName : null }]];
        }
        return [[]];
      },
      async close() {
        events.push("close");
      },
    };
  }

  const okLogs = [];
  const okErrLogs = [];
  const okSeq = createFakeSequelize();
  const okRes = await executeRemoteStagingSmokeWithDb({
    sequelize: okSeq,
    DataTypes,
    runtimeEnv,
    verifyDbFn: async () => ({ ok: true }),
    log: (msg) => {
      okSeq.events.push(`LOG:${msg}`);
      okLogs.push(msg);
    },
    errorLog: (msg) => okErrLogs.push(msg),
  });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.cleanupVerified, true);
  assert.equal(okErrLogs.length, 0);
  assert.equal(okLogs.length, 1);
  assert.match(okLogs[0], new RegExp(okRes.smokeTable));
  const dropIdx = okSeq.events.findIndex((e) => e.startsWith("DROP TABLE"));
  const regIdx = okSeq.events.findIndex((e) => e.includes("to_regclass"));
  const closeIdx = okSeq.events.indexOf("close");
  const logIdx = okSeq.events.findIndex((e) => e.startsWith("LOG:"));
  assert.ok(dropIdx > 0 && regIdx > dropIdx && closeIdx > regIdx && logIdx > closeIdx);

  const dropFailLogs = [];
  const dropFailErrLogs = [];
  await assert.rejects(
    executeRemoteStagingSmokeWithDb({
      sequelize: createFakeSequelize({ failDrop: true }),
      DataTypes,
      runtimeEnv,
      verifyDbFn: async () => ({ ok: true }),
      log: (msg) => dropFailLogs.push(msg),
      errorLog: (msg) => dropFailErrLogs.push(msg),
    }),
    /slice_of_life_progress_v1_smoke_.*simulated drop failure/,
  );
  assert.equal(dropFailLogs.length, 0);
  assert.equal(dropFailErrLogs.length, 1);
  assert.match(dropFailErrLogs[0], /slice_of_life_progress_v1_smoke_/);

  const leftoverLogs = [];
  await assert.rejects(
    executeRemoteStagingSmokeWithDb({
      sequelize: createFakeSequelize({ leftoverTable: true }),
      DataTypes,
      runtimeEnv,
      verifyDbFn: async () => ({ ok: true }),
      log: (msg) => leftoverLogs.push(msg),
      errorLog: () => {},
    }),
    /masih ada menurut to_regclass/i,
  );
  assert.equal(leftoverLogs.length, 0);
});
