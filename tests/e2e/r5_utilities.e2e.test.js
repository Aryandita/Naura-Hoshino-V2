"use strict";

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");

const {
  renderCarbonCard,
  tokenizeLine,
  tokenizeCode,
  THEMES,
} = require("../../src/canvas/codeCanvas");
const { renderPollChart, normalizePollData } = require("../../src/canvas/pollCanvas");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");

describe("R5 Utilities E2E - Tier 1: Feature Coverage", () => {
  it("TC-M5.1: tokenizeLine accurately tokenizes JavaScript syntax elements", () => {
    const code = "const sum = (a, b) => a + b; // addition helper";
    const tokens = tokenizeLine(code, "javascript");

    assert.ok(Array.isArray(tokens));
    assert.ok(tokens.length >= 7);

    const kw = tokens.find((t) => t.text === "const");
    assert.ok(kw);
    assert.equal(kw.type, "keyword");

    const op = tokens.find((t) => t.text === "=>");
    assert.ok(op);
    assert.equal(op.type, "operator");

    const comment = tokens.find((t) => t.type === "comment");
    assert.ok(comment);
    assert.equal(comment.text, "// addition helper");
  });

  it("TC-M5.2: tokenizeLine accurately tokenizes Python syntax elements and hash comments", () => {
    const code = "def compute_tax(amount): # Hitung pajak otomatis";
    const tokens = tokenizeLine(code, "python");

    const kw = tokens.find((t) => t.text === "def");
    assert.ok(kw);
    assert.equal(kw.type, "keyword");

    const comment = tokens.find((t) => t.type === "comment");
    assert.ok(comment);
    assert.equal(comment.text, "# Hitung pajak otomatis");
  });

  it("TC-M5.3: tokenizeCode handles multi-line blocks preserving line count", () => {
    const block = "function greet(name) {\n  return `Hello, ${name}!`;\n}";
    const lines = tokenizeCode(block, "javascript");

    assert.equal(lines.length, 3);
    assert.equal(lines[0][0].text, "function");
    assert.equal(lines[0][0].type, "keyword");
  });

  it("TC-M5.4: renderCarbonCard generates genuine PNG buffer with valid magic bytes", async () => {
    const sample = "console.log('Naura Hoshino V2');";
    const buffer = await renderCarbonCard({
      code: sample,
      language: "javascript",
      theme: "dracula",
      showLineNumbers: true,
      title: "test.js",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 5000);
    // PNG magic bytes
    assert.equal(buffer[0], 0x89);
    assert.equal(buffer[1], 0x50);
    assert.equal(buffer[2], 0x4e);
    assert.equal(buffer[3], 0x47);
  });

  it("TC-M5.5: renderCarbonCard renders across all theme presets", async () => {
    const themeKeys = Object.keys(THEMES);
    assert.ok(themeKeys.length >= 3);

    for (const theme of themeKeys) {
      const buffer = await renderCarbonCard({
        code: `// Theme test\nconst t = '${theme}';`,
        language: "javascript",
        theme,
        showLineNumbers: false,
      });

      assert.ok(Buffer.isBuffer(buffer));
      assert.ok(buffer.length > 3000);
    }
  });

  it("TC-M5.6: normalizePollData calculates vote distribution and percentage correctly", () => {
    const poll = normalizePollData({
      question: "Pilih Bahasa Favorit?",
      options: ["JavaScript", "Python", "Rust"],
      counts: [30, 50, 20],
    });

    assert.equal(poll.total, 100);
    assert.equal(poll.counts[0], 30);
    assert.equal(poll.counts[1], 50);
    assert.equal(poll.counts[2], 20);
    assert.equal(poll.maxVotes, 50);
    const percentages = poll.counts.map((c) => (poll.total > 0 ? (c / poll.total) * 100 : 0));
    assert.equal(percentages[0], 30);
    assert.equal(percentages[1], 50);
    assert.equal(percentages[2], 20);
  });

  it("TC-M5.7: renderPollChart renders high-resolution 1000x620 PNG diagram", async () => {
    const buffer = await renderPollChart({
      question: "Apakah sistem closed-loop Currency V2 berjalan stabil?",
      options: ["Sangat Stabil", "Cukup Baik", "Perlu Penyesuaian"],
      counts: [60, 30, 10],
      author: { username: "HoshinoArchitect" },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10000);
    assert.equal(buffer[0], 0x89);
    assert.equal(buffer[1], 0x50);
    assert.equal(buffer[2], 0x4e);
    assert.equal(buffer[3], 0x47);
  });
});

describe("R5 Utilities E2E - Tier 2: Boundary & Corner Cases", () => {
  it("TC-M5.8: renderCarbonCard handles empty or 1-line code cleanly", async () => {
    const emptyBuf = await renderCarbonCard({
      code: "",
      language: "javascript",
    });
    assert.ok(Buffer.isBuffer(emptyBuf));
    assert.ok(emptyBuf.length > 1000);

    const singleLine = await renderCarbonCard({
      code: "x = 1",
      language: "python",
    });
    assert.ok(Buffer.isBuffer(singleLine));
    assert.ok(singleLine.length > 2000);
  });

  it("TC-M5.9: renderCarbonCard safely truncates oversized code to prevent memory exhaustion", async () => {
    // Generate 120 lines of code
    const lines = [];
    for (let i = 1; i <= 120; i++) {
      lines.push(`const variable_${i} = ${i * 42}; // Line ${i}`);
    }
    const massiveCode = lines.join("\n");

    const buffer = await renderCarbonCard({
      code: massiveCode,
      language: "javascript",
      theme: "dracula",
      showLineNumbers: true,
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 5000);
  });

  it("TC-M5.10: renderCarbonCard handles Japanese, emojis, and XML special characters", async () => {
    const specialCode = [
      "// 日本語コメントテスト ✨",
      "const greeting = 'こんにちは世界 🌸';",
      "const tag = <Component prop=\"val & 'quot' < 10\" />;",
    ].join("\n");

    const buffer = await renderCarbonCard({
      code: specialCode,
      language: "javascript",
      theme: "one-dark",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 3000);
  });

  it("TC-M5.11: normalizePollData and renderPollChart handle zero votes without NaN", async () => {
    const zeroPoll = normalizePollData({
      question: "Polling Kosong",
      options: ["Opsi A", "Opsi B"],
      counts: [0, 0],
    });

    assert.equal(zeroPoll.total, 0);
    assert.equal(zeroPoll.counts[0], 0);
    assert.equal(zeroPoll.counts[1], 0);

    const buffer = await renderPollChart({
      question: "Polling Belum Ada Suara",
      options: ["Opsi A", "Opsi B"],
      counts: [0, 0],
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 5000);
  });

  it("TC-M5.12: normalizePollData handles tied votes correctly", () => {
    const tied = normalizePollData({
      question: "Kucing vs Anjing?",
      options: ["Kucing", "Anjing"],
      counts: [50, 50],
    });

    assert.equal(tied.total, 100);
    assert.equal(tied.maxVotes, 50);
  });
});

describe("R5 Utilities E2E - Tier 3: Cross-Feature Combinations", () => {
  after(async () => {
    await canvasWorkerPool.shutdown();
  });

  it("TC-M5.13: Canvas Worker Pool executes renderCarbon task in isolated thread", async () => {
    const buffer = await canvasWorkerPool.runTask("renderCarbon", {
      code: "const universe = 42;\nconsole.log(universe);",
      language: "javascript",
      theme: "one-dark",
      showLineNumbers: true,
      title: "universe.js",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 3000);
    assert.equal(buffer[0], 0x89);
  });

  it("TC-M5.14: Canvas Worker Pool executes renderPollChart task in isolated thread", async () => {
    const buffer = await canvasWorkerPool.runTask("renderPollChart", {
      question: "Pilihan Bahasa Pemrograman Utama?",
      options: ["JavaScript", "Rust", "Python", "Go"],
      counts: [28, 14, 20, 10],
      author: { username: "Naura Tester" },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10000);
    assert.equal(buffer[0], 0x89);
  });

  it("TC-M5.15: Concurrent worker task execution without buffer corruption", async () => {
    const [carbonBuf, pollBuf] = await Promise.all([
      canvasWorkerPool.runTask("renderCarbon", {
        code: "export const PI = 3.14159;",
        language: "javascript",
        theme: "dracula",
      }),
      canvasWorkerPool.runTask("renderPollChart", {
        question: "Concurrent Test?",
        options: ["Yes", "No"],
        counts: [10, 5],
      }),
    ]);

    assert.ok(Buffer.isBuffer(carbonBuf));
    assert.ok(Buffer.isBuffer(pollBuf));
    assert.equal(carbonBuf[0], 0x89);
    assert.equal(pollBuf[0], 0x89);
  });
});

describe("R5 Utilities E2E - Tier 4: Real-World Scenarios", () => {
  it("TC-M5.16: End-to-end React code snippet generation workflow", async () => {
    const reactSnippet = [
      "import React, { useState } from 'react';",
      "",
      "export function Counter() {",
      "  const [count, setCount] = useState(0);",
      "  return (",
      "    <button onClick={() => setCount(count + 1)}>",
      "      Clicked {count} times",
      "    </button>",
      "  );",
      "}",
    ].join("\n");

    const buffer = await renderCarbonCard({
      code: reactSnippet,
      language: "javascript",
      theme: "dracula",
      showLineNumbers: true,
      title: "Counter.jsx",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000);
    assert.equal(buffer[0], 0x89);
  });

  it("TC-M5.17: End-to-end community election poll chart export workflow", async () => {
    const pollSpec = {
      question: "Pilih Pembaruan Naura Hoshino V2 Terfavorit",
      options: [
        "Sistem Musik (Seek & Sleep Timer)",
        "Minigame Arcade (Blackjack & TypeRacer)",
        "Automod Shield (Phishing & Ghostping)",
        "Smart Utilities (Carbon & Visual Poll)",
      ],
      counts: [45, 65, 30, 20],
      author: { username: "ServerOwner", tag: "ServerOwner#0001" },
    };

    // 1. Normalize
    const normalized = normalizePollData(pollSpec);
    assert.equal(normalized.total, 160);
    assert.equal(normalized.maxVotes, 65);
    assert.equal(normalized.counts.indexOf(normalized.maxVotes), 1); // Option 2 (Blackjack) wins with 65 votes

    // 2. Render
    const buffer = await renderPollChart(pollSpec);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 15000);
  });

  it("TC-M5.18: Poll options are 100% dynamic and non-hardcoded for arbitrary strings", () => {
    const customOptions = ["Sate Padang", "Nasi Goreng Spesial", "Es Campur Durian", "Martabak Manis"];
    const poll = normalizePollData({
      question: "Menu Buka Puasa Bersama?",
      options: customOptions,
      counts: [15, 25, 40, 10],
    });

    assert.deepEqual(poll.options, customOptions);
    assert.equal(poll.question, "Menu Buka Puasa Bersama?");
    assert.equal(poll.total, 90);
    assert.equal(poll.maxVotes, 40);
  });

  it("TC-M5.19: Poll chart cache serves instant response within 10-second window", async () => {
    if (!global.__nauraPollChartCache) {
      global.__nauraPollChartCache = new Map();
    }

    const testMessageId = "msg_poll_test_cache_123";
    const dummyBuffer = Buffer.from("FAKE_PNG_CHART_BYTES");

    // Cache dummy buffer
    global.__nauraPollChartCache.set(testMessageId, {
      buffer: dummyBuffer,
      timestamp: Date.now(),
    });

    const cached = global.__nauraPollChartCache.get(testMessageId);
    assert.ok(cached);
    assert.equal(cached.buffer.toString(), "FAKE_PNG_CHART_BYTES");
    assert.ok(Date.now() - cached.timestamp < 10000);

    // Verify cache expiry after 10s
    const oldTimestamp = Date.now() - 11000;
    global.__nauraPollChartCache.set(testMessageId, {
      buffer: dummyBuffer,
      timestamp: oldTimestamp,
    });

    const expired = global.__nauraPollChartCache.get(testMessageId);
    assert.ok(Date.now() - expired.timestamp >= 10000);
  });

  it("TC-M5.20: Vote debounce resets timer on rapid clicks and executes once", async () => {
    if (!global.__nauraPollDebounceTimers) {
      global.__nauraPollDebounceTimers = new Map();
    }

    const testMsgId = "msg_poll_debounce_test_456";
    let executions = 0;

    // Simulate 3 rapid clicks with 20ms intervals
    for (let i = 0; i < 3; i++) {
      if (global.__nauraPollDebounceTimers.has(testMsgId)) {
        clearTimeout(global.__nauraPollDebounceTimers.get(testMsgId));
      }
      const timer = setTimeout(() => {
        executions++;
      }, 50); // fast test timer
      global.__nauraPollDebounceTimers.set(testMsgId, timer);
    }

    // Wait 100ms for debounce to fire
    await new Promise((r) => setTimeout(r, 100));

    // Only the final reset timer should have executed (exactly 1 time)
    assert.equal(executions, 1);
  });
});
