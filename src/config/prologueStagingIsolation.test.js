"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRODUCTION_SUPABASE_PROJECT_ID,
  DEFAULT_STAGING_SUPABASE_PROJECT_ID,
  STAGING_REQUIRED_TABLES,
  assertPrologueStagingSafety,
  verifyPrologueStagingDatabase,
  getSyntheticUserProfile,
  getSyntheticUserSurvival,
  isAllowedPrologueStagingInteraction,
} = require("./prologueStagingIsolation");
const { remediateStagingTableGrants } = require("../managers/dbMigrator");

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
