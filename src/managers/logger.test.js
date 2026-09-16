"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { logger, parseErrorOrigin } = require("./logger");

test("logger: parseErrorOrigin correctly extracts file, line, and function", () => {
  function sampleFailingFunction() {
    return new Error("Sample failure for testing origin parser");
  }

  const err = sampleFailingFunction();
  const origin = parseErrorOrigin(err);

  assert.ok(origin, "Origin should not be empty");
  assert.match(
    origin,
    /src\/managers\/logger\.test\.js:\d+:\d+/,
    "Origin should pinpoint logger.test.js with line and col"
  );
  assert.ok(
    origin.includes("sampleFailingFunction"),
    "Origin should identify the function name"
  );
});

test("logger: ensures logs directory is created lazily on error logging", () => {
  const logsDir = path.resolve(__dirname, "../../logs");
  const dateStr = new Date().toISOString().slice(0, 10);
  const expectedLogFile = path.join(logsDir, `error-${dateStr}.log`);

  // Panggil logger.error dengan test error
  const testError = new Error("Testing lazy error log file generation");
  logger.error("Unit Test Failure Simulation", testError, {
    testContext: "logger.test.js",
  });

  // Pastikan folder logs dan file log harian terbentuk
  assert.ok(fs.existsSync(logsDir), "Folder logs harus dibuat secara lazy saat ada error");
  assert.ok(
    fs.existsSync(expectedLogFile),
    `File log harian ${expectedLogFile} harus terbentuk`
  );

  // Baca isi file log dan periksa kontennya
  const content = fs.readFileSync(expectedLogFile, "utf8");
  assert.ok(
    content.includes("Unit Test Failure Simulation"),
    "File log harus memuat pesan error"
  );
  assert.ok(
    content.includes("Testing lazy error log file generation"),
    "File log harus memuat detail error"
  );
  assert.ok(
    content.includes("src/managers/logger.test.js"),
    "File log harus memuat origin file sumber error"
  );
  assert.ok(
    content.includes("logger.test.js"),
    "File log harus memuat context yang diberikan"
  );

  // Bersihkan log pengujian
  try {
    fs.rmSync(logsDir, { recursive: true, force: true });
  } catch (_) {}
});
