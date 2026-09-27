"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("New Moderation & Utility Plugins - Command Definitions & Schema Integrity", () => {
  const moderation = require("../../plugin/admin/moderation");
  assert.ok(moderation.data);
  assert.equal(moderation.data.name, "moderation");
  const modSubcommands = moderation.data.options.map((o) => o.name);
  assert.ok(modSubcommands.includes("purge"));
  assert.ok(modSubcommands.includes("nuke"));
  assert.ok(modSubcommands.includes("roleall"));
  assert.ok(modSubcommands.includes("timeout"));
  assert.ok(modSubcommands.includes("untimeout"));
  assert.ok(modSubcommands.includes("kick"));
  assert.ok(modSubcommands.includes("ban"));
  assert.ok(modSubcommands.includes("unban"));
  assert.equal(typeof moderation.execute, "function");

  const modnote = require("../../plugin/admin/modnote");
  assert.ok(modnote.data);
  assert.equal(modnote.data.name, "modnote");
  const noteSubcommands = modnote.data.options.map((o) => o.name);
  assert.ok(noteSubcommands.includes("add"));
  assert.ok(noteSubcommands.includes("list"));
  assert.ok(noteSubcommands.includes("delete"));
  assert.equal(typeof modnote.execute, "function");

  const shield = require("../../plugin/admin/shield");
  assert.ok(shield.data);
  assert.equal(shield.data.name, "shield");
  const shieldSubcommands = shield.data.options.map((o) => o.name);
  assert.ok(shieldSubcommands.includes("on"));
  assert.ok(shieldSubcommands.includes("off"));
  assert.ok(shieldSubcommands.includes("status"));
  assert.equal(typeof shield.execute, "function");

  const serverinfo = require("../../plugin/utility/serverinfo");
  assert.ok(serverinfo.data);
  assert.equal(serverinfo.data.name, "serverinfo");
  assert.equal(typeof serverinfo.execute, "function");

  const userinfo = require("../../plugin/utility/userinfo");
  assert.ok(userinfo.data);
  assert.equal(userinfo.data.name, "userinfo");
  assert.equal(typeof userinfo.execute, "function");

  const worldclock = require("../../plugin/utility/worldclock");
  assert.ok(worldclock.data);
  assert.equal(worldclock.data.name, "worldclock");
  const worldSubcommands = worldclock.data.options.map((o) => o.name);
  assert.ok(worldSubcommands.includes("view"));
  assert.ok(worldSubcommands.includes("convert"));
  assert.equal(typeof worldclock.execute, "function");

  const embedmaker = require("../../plugin/utility/embedmaker");
  assert.ok(embedmaker.data);
  assert.equal(embedmaker.data.name, "embedmaker");
  assert.equal(typeof embedmaker.execute, "function");
});
