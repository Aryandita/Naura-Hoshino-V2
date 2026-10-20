"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  displayAsciiArtBanner,
  displayStatsCard,
  colorizeLogLine,
} = require("../scripts/view-logs");

test("view-logs: displayAsciiArtBanner renders without throwing", () => {
  assert.doesNotThrow(() => {
    displayAsciiArtBanner();
  }, "displayAsciiArtBanner harus berjalan tanpa error");
});

test("view-logs: displayStatsCard formats metrics without throwing", () => {
  const sampleStats = {
    exists: true,
    path: "logs/naura.log",
    sizeBytes: 1024,
    sizeFormatted: "1.00 KB",
    totalLines: 50,
    errorCount: 2,
    warnCount: 3,
    infoCount: 45,
    lastModified: new Date(),
  };

  assert.doesNotThrow(() => {
    displayStatsCard(sampleStats);
  }, "displayStatsCard harus berjalan tanpa error");
});

test("view-logs: colorizeLogLine applies correct ANSI styling according to level", () => {
  const errorLine = "[2026-10-20 12:00:00.000] [ERROR   ] [Origin: src/test.js:10:2] Critical test failure";
  const colorizedError = colorizeLogLine(errorLine);
  assert.ok(colorizedError.includes("ERROR"), "Harus memuat badge ERROR");
  assert.ok(colorizedError.includes("\x1b[41m"), "Harus memuat kode warna latar merah");
  assert.ok(colorizedError.includes("[src/test.js:10:2]"), "Harus mempertahankan origin");

  const infoLine = "[2026-10-20 12:00:00.000] [INFO    ] System initialized successfully";
  const colorizedInfo = colorizeLogLine(infoLine);
  assert.ok(colorizedInfo.includes("INFO"), "Harus memuat badge INFO");
  assert.ok(colorizedInfo.includes("\x1b[46m"), "Harus memuat kode warna latar cyan");

  const successLine = "[2026-10-20 12:00:00.000] [SUCCESS ] All operations completed";
  const colorizedSuccess = colorizeLogLine(successLine);
  assert.ok(colorizedSuccess.includes("SUCCESS"), "Harus memuat badge SUCCESS");
  assert.ok(colorizedSuccess.includes("\x1b[42m"), "Harus memuat kode warna latar hijau");

  const warnLine = "[2026-10-20 12:00:00.000] [WARN    ] High memory usage detected";
  const colorizedWarn = colorizeLogLine(warnLine);
  assert.ok(colorizedWarn.includes("WARN"), "Harus memuat badge WARN");
  assert.ok(colorizedWarn.includes("\x1b[43m"), "Harus memuat kode warna latar kuning");

  const bannerLine = "  ██╗  ██╗  █████╗  ██╗   ██╗ ██████╗   █████╗     NAURA HOSHINO";
  const colorizedBanner = colorizeLogLine(bannerLine);
  assert.ok(colorizedBanner.includes("\x1b[38;5;218m"), "Banner harus diwarnai pink");
});
