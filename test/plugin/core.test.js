"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../../plugin/core/core");

test("core command - metadata and subcommands", () => {
  assert.equal(core.data.name, "core");
  assert.ok(Array.isArray(core.aliases));
  assert.ok(core.aliases.includes("ping"));
  assert.ok(core.aliases.includes("stats"));
  assert.ok(core.aliases.includes("help"));

  const subNames = core.data.options
    .filter((opt) => opt.toJSON().type === 1)
    .map((opt) => opt.toJSON().name);

  assert.ok(subNames.includes("ping"));
  assert.ok(subNames.includes("stats"));
  assert.ok(subNames.includes("info"));
  assert.ok(subNames.includes("about"));
  assert.ok(subNames.includes("help"));
  assert.ok(subNames.includes("language"));
  assert.ok(subNames.includes("partner"));
  assert.equal(subNames.length, 7);
});

test("core command - executePrefix handles invalid subcommand gracefully", async () => {
  let replyContent = null;
  const mockMessage = {
    content: "n!core unknowncmd",
    author: { id: "123", username: "Tester" },
    guild: null,
    member: null,
    createdTimestamp: Date.now(),
    reply: async (msg) => {
      replyContent = msg;
      return msg;
    },
  };

  await core.executePrefix(mockMessage, ["unknowncmd"], {});
  assert.ok(replyContent);
  assert.ok(typeof replyContent === "string");
  assert.ok(replyContent.includes("tidak valid") || replyContent.includes("Invalid"));
});
