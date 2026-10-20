"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateClanQuestsForClan,
} = require("../src/survival/engines/questGenerator");
const outlawBountyEngine = require("../src/survival/engines/outlawBountyEngine");

test("Clan Quest Engine - generateClanQuestsForClan scales with clan level", () => {
  const fakeClan1 = { id: "clan_test_1", level: 1, members: ["user_1"] };
  const questBoard1 = generateClanQuestsForClan(fakeClan1);

  assert.ok(Array.isArray(questBoard1.weekly));
  assert.equal(questBoard1.weekly.length, 3);
  assert.ok(questBoard1.weekly[0].target >= 15);
  assert.ok(questBoard1.weekly[0].reward > 0);
  assert.match(questBoard1.lastWeeklyReset, /^\d{4}-\d{2}-\d{2}$/);

  const fakeClan5 = { id: "clan_test_5", level: 5, members: ["user_1", "user_2"] };
  const questBoard5 = generateClanQuestsForClan(fakeClan5);
  assert.ok(questBoard5.weekly.every((q) => q.target >= 15 && q.reward > 0));
});

test("Outlaw Bounty Engine - getWantedBoard returns array cleanly", async () => {
  const list = await outlawBountyEngine.getWantedBoard();
  assert.ok(Array.isArray(list));
});

test("Clan Bounty Board - slash command has bounty choice and clanButtons routes to bounty", () => {
  const clanButtons = require("../src/interactions/buttons/clanButtons");
  const bountyBtn = clanButtons.find((b) => b.id === "clan_hub_bounty");
  assert.ok(bountyBtn);
  assert.strictEqual(bountyBtn.defer, "update");

  // Verify slash command option choices
  const { SlashCommandBuilder } = require("discord.js");
  const { addRpgSubcommands } = require("../src/survival/helpers/survivalGroupsRpg");
  const builder = new SlashCommandBuilder().setName("survival").setDescription("Test");
  addRpgSubcommands(builder);
  const json = builder.toJSON();
  const clanSub = json.options.find((o) => o.name === "clan");
  const aksiOpt = clanSub.options.find((o) => o.name === "aksi");
  const bountyChoice = aksiOpt.choices.find((c) => c.value === "bounty");
  assert.ok(bountyChoice, "bounty choice should be present in /survival clan options");
});
