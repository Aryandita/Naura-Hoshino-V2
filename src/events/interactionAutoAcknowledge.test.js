"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");
const { attachAutoAcknowledgeGuard } = require("./interactionCreate");

test("Auto-Acknowledge Guard - harus mengabaikan interaction yang null atau tidak memiliki deferReply", () => {
  const cleanup1 = attachAutoAcknowledgeGuard(null);
  assert.equal(typeof cleanup1, "function");
  cleanup1();

  const cleanup2 = attachAutoAcknowledgeGuard({});
  assert.equal(typeof cleanup2, "function");
  cleanup2();
});

test("Auto-Acknowledge Guard - harus mengabaikan autocomplete interaction", () => {
  let deferCalled = false;
  const mockInteraction = {
    isAutocomplete: () => true,
    deferReply: async () => {
      deferCalled = true;
    },
    replied: false,
    deferred: false,
  };

  const cleanup = attachAutoAcknowledgeGuard(mockInteraction, 50);
  return new Promise((resolve) => {
    setTimeout(() => {
      cleanup();
      assert.equal(deferCalled, false);
      resolve();
    }, 100);
  });
});

test("Auto-Acknowledge Guard - harus memanggil deferReply dengan flags Ephemeral saat timeout tercapai", () => {
  let deferCalled = false;
  let passedOptions = null;

  const mockInteraction = {
    isAutocomplete: () => false,
    deferReply: async (opts) => {
      deferCalled = true;
      passedOptions = opts;
    },
    replied: false,
    deferred: false,
  };

  const cleanup = attachAutoAcknowledgeGuard(mockInteraction, 40);

  return new Promise((resolve) => {
    setTimeout(() => {
      cleanup();
      assert.equal(deferCalled, true);
      assert.deepEqual(passedOptions, { flags: MessageFlags.Ephemeral });
      resolve();
    }, 90);
  });
});

test("Auto-Acknowledge Guard - tidak memanggil deferReply bila dibatalkan sebelum timeout", () => {
  let deferCalled = false;

  const mockInteraction = {
    isAutocomplete: () => false,
    deferReply: async () => {
      deferCalled = true;
    },
    replied: false,
    deferred: false,
  };

  const cleanup = attachAutoAcknowledgeGuard(mockInteraction, 80);
  cleanup(); // Dibatalkan langsung

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(deferCalled, false);
      resolve();
    }, 120);
  });
});

test("Auto-Acknowledge Guard - tidak memanggil deferReply bila interaction sudah replied atau deferred", () => {
  let deferCalled1 = false;
  let deferCalled2 = false;

  const mockInteractionReplied = {
    isAutocomplete: () => false,
    deferReply: async () => {
      deferCalled1 = true;
    },
    replied: true,
    deferred: false,
  };

  const mockInteractionDeferred = {
    isAutocomplete: () => false,
    deferReply: async () => {
      deferCalled2 = true;
    },
    replied: false,
    deferred: true,
  };

  const cleanup1 = attachAutoAcknowledgeGuard(mockInteractionReplied, 40);
  const cleanup2 = attachAutoAcknowledgeGuard(mockInteractionDeferred, 40);

  return new Promise((resolve) => {
    setTimeout(() => {
      cleanup1();
      cleanup2();
      assert.equal(deferCalled1, false);
      assert.equal(deferCalled2, false);
      resolve();
    }, 90);
  });
});
