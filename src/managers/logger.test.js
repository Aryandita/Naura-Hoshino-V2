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

test("logger: centralized naura.log contains ASCII Art session header and all levels", () => {
  const logsDir = path.resolve(__dirname, "../../logs");
  const centralFile = path.join(logsDir, "naura.log");

  // Tulis berbagai level log
  logger.info("Centralized Log: Info message test");
  logger.success("Centralized Log: Success message test");
  logger.warn("Centralized Log: Warning message test");
  logger.system("Centralized Log: System message test");
  logger.music("Centralized Log: Music audio test");
  logger.db("Centralized Log: Database query test");
  logger.debug("Centralized Log: Debug statement test");
  logger.error("Centralized Log: Error event test", new Error("Simulated central error"));

  assert.ok(fs.existsSync(centralFile), "File naura.log harus terbentuk di folder logs");

  const content = fs.readFileSync(centralFile, "utf8");

  // Periksa keberadaan ASCII Art banner
  assert.ok(
    content.includes("NAURA HOSHINO"),
    "File log terpusat harus memuat ASCII Art banner 'NAURA HOSHINO'"
  );
  assert.ok(
    content.includes("CENTRALIZED SYSTEM LOG"),
    "File log terpusat harus memuat sub-judul 'CENTRALIZED SYSTEM LOG'"
  );

  // Periksa seluruh level log tercatat di file terpusat
  assert.ok(content.includes("[INFO    ]"), "Harus mencatat level INFO");
  assert.ok(content.includes("[SUCCESS ]"), "Harus mencatat level SUCCESS");
  assert.ok(content.includes("[WARN    ]"), "Harus mencatat level WARN");
  assert.ok(content.includes("[SYSTEM  ]"), "Harus mencatat level SYSTEM");
  assert.ok(content.includes("[AUDIO   ]"), "Harus mencatat level AUDIO");
  assert.ok(content.includes("[DATABASE]"), "Harus mencatat level DATABASE");
  assert.ok(content.includes("[DEBUG   ]"), "Harus mencatat level DEBUG");
  assert.ok(content.includes("[ERROR   ]"), "Harus mencatat level ERROR");

  // Periksa helper readLogs dan getLogStats
  const stats = logger.getLogStats();
  assert.ok(stats.exists, "getLogStats harus melaporkan file ada");
  assert.ok(stats.totalLines > 5, "totalLines harus lebih besar dari 5");
  assert.ok(stats.errorCount >= 1, "errorCount harus minimal 1");
  assert.ok(stats.warnCount >= 1, "warnCount harus minimal 1");

  const errorLogs = logger.readLogs({ level: "ERROR" });
  assert.ok(errorLogs.length >= 1, "readLogs({ level: 'ERROR' }) harus mengembalikan entri error");

  const searchLogs = logger.readLogs({ search: "Music audio test" });
  assert.ok(searchLogs.length >= 1, "readLogs({ search }) harus menemukan entri yang sesuai");

  // Bersihkan log pengujian
  try {
    fs.rmSync(logsDir, { recursive: true, force: true });
  } catch (_) {}
});

test("logger: printBanner runs without error", () => {
  assert.doesNotThrow(() => {
    logger.printBanner();
  }, "logger.printBanner() harus berjalan tanpa error");
});
