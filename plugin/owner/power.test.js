"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const powerCommand = require("./power");

test("power command - metadata, subcommands, and aliases integrity", () => {
  assert.ok(powerCommand.data);
  const json = powerCommand.data.toJSON();
  assert.equal(json.name, "power");
  assert.ok(json.options.some((opt) => opt.name === "panel"));
  assert.ok(json.options.some((opt) => opt.name === "restart"));
  assert.ok(json.options.some((opt) => opt.name === "shutdown"));
  assert.ok(json.options.some((opt) => opt.name === "flush"));

  assert.equal(powerCommand.category, "owner");
  assert.ok(Array.isArray(powerCommand.aliases));
  assert.ok(powerCommand.aliases.includes("restart"));
  assert.ok(powerCommand.aliases.includes("shutdown"));
  assert.ok(powerCommand.aliases.includes("reboot"));
});

test("power command - denies execution for non-owner interaction", async () => {
  let repliedPayload = null;
  const mockInteraction = {
    user: { id: "not-an-owner-9999" },
    options: {
      getSubcommand: () => "panel",
    },
    reply: (payload) => {
      repliedPayload = payload;
      return Promise.resolve(payload);
    },
  };

  await powerCommand.execute(mockInteraction);

  assert.ok(repliedPayload);
  assert.ok(repliedPayload.components);
});

test("power command - denies execution for non-owner prefix message", async () => {
  let errorSent = false;
  const mockMessage = {
    author: { id: "not-an-owner-9999" },
    content: "n!power",
    reply: () => {
      errorSent = true;
      return Promise.resolve();
    },
  };

  const mockClient = {};
  await powerCommand.executePrefix(mockMessage, [], mockClient);

  assert.equal(errorSent, true);
});
