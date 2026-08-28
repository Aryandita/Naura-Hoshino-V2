"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const UserLeveling = require("../../models/UserLeveling");
const voiceXp = require("./voiceXp");
const { MIGRATIONS } = require("../../managers/dbMigrator");

test("UserLeveling schema contains voiceMinutes attribute", () => {
  assert.ok(UserLeveling.rawAttributes, "UserLeveling must have rawAttributes");
  assert.ok(
    UserLeveling.rawAttributes.voiceMinutes,
    "UserLeveling must define voiceMinutes attribute",
  );
  assert.equal(
    UserLeveling.rawAttributes.voiceMinutes.type.key,
    "INTEGER",
    "voiceMinutes must be an INTEGER",
  );
  assert.equal(
    UserLeveling.rawAttributes.voiceMinutes.defaultValue,
    0,
    "voiceMinutes default value must be 0",
  );
});

test("dbMigrator contains migration v34_add_voiceMinutes_to_user_leveling", () => {
  const migration = MIGRATIONS.find(
    (m) => m.id === "v34_add_voiceMinutes_to_user_leveling",
  );
  assert.ok(
    migration,
    "v34_add_voiceMinutes_to_user_leveling migration must exist",
  );
  assert.ok(
    migration.sql.includes("voiceMinutes"),
    "SQL must alter voiceMinutes",
  );
  assert.ok(
    migration.pgSql.includes("voiceMinutes"),
    "pgSql must alter voiceMinutes",
  );
});

test("voiceXp handler exports name and execute function", () => {
  assert.equal(voiceXp.name, "voiceXp");
  assert.equal(typeof voiceXp.execute, "function");
});

test("voiceXp ignores bot members", async () => {
  const fakeOldState = { channelId: null };
  const fakeNewState = {
    channelId: "voice-123",
    guild: { id: "guild-123" },
    member: { id: "bot-123", user: { bot: true } },
  };

  // Should return without error or action
  await assert.doesNotReject(async () => {
    await voiceXp.execute(fakeOldState, fakeNewState, {});
  });
});
