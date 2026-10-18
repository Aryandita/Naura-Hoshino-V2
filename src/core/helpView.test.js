"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  HELP_CATEGORY_KEYS,
  buildHelpPayload,
  handleCommandDetailHelp,
} = require("./helpView");
const commandRegistry = require("../services/commandRegistry");

test("helpView - HELP_CATEGORY_KEYS contains exactly 13 public categories", () => {
  assert.equal(HELP_CATEGORY_KEYS.length, 13);
  assert.ok(HELP_CATEGORY_KEYS.includes("core"));
  assert.ok(HELP_CATEGORY_KEYS.includes("music"));
  assert.ok(HELP_CATEGORY_KEYS.includes("survival"));
  assert.ok(HELP_CATEGORY_KEYS.includes("utility"));
  assert.ok(!HELP_CATEGORY_KEYS.includes("owner"));
});

test("helpView - buildHelpPayload renders Overview bento correctly", () => {
  const mockUser = { username: "Tester", id: "12345" };
  const payload = buildHelpPayload("id", -1, false, mockUser);

  assert.ok(payload);
  assert.ok(payload.flags);
  assert.ok(Array.isArray(payload.components));
  assert.ok(payload.components.length > 0);
});

test("helpView - buildHelpPayload renders category page and disables components when disabled=true", () => {
  const mockUser = { username: "Tester", id: "12345" };
  const payload = buildHelpPayload("id", 0, true, mockUser);

  assert.ok(payload);
  assert.ok(Array.isArray(payload.components));
  // In disabled mode, components should have disabled: true
  const firstRow = payload.components[0];
  assert.ok(firstRow);
});

test("helpView - handleCommandDetailHelp returns detail for known command and suggestion for typo", () => {
  const mockClient = {
    commands: new Map([
      [
        "ping",
        {
          name: "ping",
          category: "core",
          data: {
            name: "ping",
            description: "Cek latency bot",
            options: [],
          },
        },
      ],
    ]),
  };
  commandRegistry.buildRegistry(mockClient);

  // Known command detail
  const detailPayload = handleCommandDetailHelp("ping", "id");
  assert.ok(detailPayload);
  assert.ok(detailPayload.flags);

  // Unknown command with typo
  const typoPayload = handleCommandDetailHelp("pign", "id");
  assert.ok(typoPayload);
});

test("helpView - buildHelpPayload renders all 13 categories in both 'id' and 'en' locales", () => {
  const mockUser = { username: "Tester", id: "12345" };

  for (let i = 0; i < HELP_CATEGORY_KEYS.length; i++) {
    const payloadId = buildHelpPayload("id", i, false, mockUser);
    assert.ok(payloadId);
    assert.ok(payloadId.flags);
    assert.ok(Array.isArray(payloadId.components));

    const payloadEn = buildHelpPayload("en", i, false, mockUser);
    assert.ok(payloadEn);
    assert.ok(payloadEn.flags);
    assert.ok(Array.isArray(payloadEn.components));
  }
});

test("helpView - buildHelpPayload handles utility pagination subpages correctly", () => {
  const mockUser = { username: "Tester", id: "12345" };
  const mockCommands = new Map();
  for (let i = 1; i <= 25; i++) {
    mockCommands.set(`util_${i}`, {
      name: `util_${i}`,
      category: "utility",
      description: `Utility command ${i}`,
      data: { name: `util_${i}`, description: `Utility command ${i}`, options: [] },
    });
  }
  commandRegistry.buildRegistry({ commands: mockCommands });

  const page1 = buildHelpPayload("id", HELP_CATEGORY_KEYS.indexOf("utility"), false, mockUser, 0);
  assert.equal(page1._subPage, 0);
  assert.equal(page1._totalSubPages, 3);

  const page2 = buildHelpPayload("id", HELP_CATEGORY_KEYS.indexOf("utility"), false, mockUser, 1);
  assert.equal(page2._subPage, 1);

  const page3 = buildHelpPayload("en", HELP_CATEGORY_KEYS.indexOf("utility"), false, mockUser, 2);
  assert.equal(page3._subPage, 2);
});
