"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const ui = require("./ui");
const env = require("./env");
const { NauraEmbedBuilder } = require("../utils/NauraEmbedBuilder");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");

test("UI Footer Configuration - Resolves version dynamically from env.BOT_VERSION", () => {
  const currentVersion = env.BOT_VERSION || "2.3.0";

  const coreFooter = ui.getFooter("core");
  assert.ok(
    coreFooter.includes(`v${currentVersion}`),
    `Footer core harus memuat v${currentVersion}`,
  );
  assert.ok(
    coreFooter.includes("Aryandita"),
    "Footer core harus memuat pembuat",
  );

  const utilityFooter = ui.getFooter("utility");
  assert.ok(
    utilityFooter.includes(`v${currentVersion}`),
    `Footer utility harus memuat v${currentVersion}`,
  );

  const survivalFooter = ui.getFooter("survival");
  assert.ok(
    survivalFooter.includes(`v${currentVersion}`),
    `Footer survival harus memuat v${currentVersion}`,
  );

  const musicFooter = ui.getFooter("music");
  assert.ok(
    musicFooter.includes(`v${currentVersion}`),
    `Footer music harus memuat v${currentVersion}`,
  );

  const premiumFooter = ui.getFooter("premium");
  assert.ok(
    premiumFooter.includes(`v${currentVersion}`),
    `Footer premium harus memuat v${currentVersion}`,
  );
});

test("UI Footer - Fallback to core when category is invalid or missing", () => {
  const fallback = ui.getFooter("unknown_category");
  const core = ui.getFooter("core");
  assert.equal(
    fallback,
    core,
    "Kategori tidak dikenal harus fallback ke footer core",
  );
});

test("NauraEmbedBuilder - Default footer is synchronized with ui.getFooter('core')", () => {
  const embed = new NauraEmbedBuilder();
  assert.ok(embed.data.footer, "Embed harus memiliki footer");
  assert.equal(embed.data.footer.text, ui.getFooter("core"));
});

test("NauraContainerBuilder - Default footer uses ui.getFooter('core')", () => {
  const container = buildContainerV2({
    title: "Test Container",
    description: "Testing footer binding",
  });

  assert.ok(container.components, "Container harus memiliki komponen");
  // Cari footer komponen (lapisan footer berformat -# Footer)
  const containerJson = JSON.stringify(container);
  const coreFooterClean = ui.stripCustomEmojis(ui.getFooter("core"));
  assert.ok(
    containerJson.includes(coreFooterClean),
    "Container V2 payload harus menyertakan teks footer terpusat",
  );
});

test("NauraContainerBuilder - Standardized Error, Loading, and Maintenance V2 Containers", () => {
  const {
    buildErrorContainerV2,
    buildLoadingContainerV2,
    buildMaintenanceContainerV2,
  } = require("../utils/NauraContainerBuilder");

  // 1. Error Container V2
  const errorContainer = buildErrorContainerV2({
    errorMessage: "Contoh pesan kesalahan sistem",
    withBanner: true,
  });
  assert.equal(
    errorContainer.flags,
    32768,
    "Harus menyertakan IsComponentsV2 flag",
  );
  assert.ok(
    Array.isArray(errorContainer.components),
    "Harus memiliki komponen V2",
  );
  assert.ok(
    errorContainer.files.length > 0,
    "Harus menyertakan banner atau icon file attachment",
  );

  // 2. Loading Container V2
  const loadingContainer = buildLoadingContainerV2({
    loadingMessage: "Sedang memproses permintaan data...",
    withBanner: true,
  });
  assert.equal(
    loadingContainer.flags,
    32768,
    "Harus menyertakan IsComponentsV2 flag",
  );
  assert.ok(
    Array.isArray(loadingContainer.components),
    "Harus memiliki komponen V2",
  );
  assert.ok(
    loadingContainer.files.length > 0,
    "Harus menyertakan banner loading file attachment",
  );

  // 3. Maintenance Container V2
  const maintenanceContainer = buildMaintenanceContainerV2({
    maintenanceMessage: "Sedang dalam peningkatan performa server...",
  });
  assert.equal(
    maintenanceContainer.flags,
    32768,
    "Harus menyertakan IsComponentsV2 flag",
  );
  assert.ok(
    Array.isArray(maintenanceContainer.components),
    "Harus memiliki komponen V2",
  );
  assert.ok(
    maintenanceContainer.files.length > 0,
    "Maintenance container harus otomatis membawa banner attachment",
  );
});

test("UI Helpers - sendError, sendMaintenance, and sendLoading methods exist", () => {
  assert.equal(
    typeof ui.sendError,
    "function",
    "ui.sendError harus berupa function",
  );
  assert.equal(
    typeof ui.sendMaintenance,
    "function",
    "ui.sendMaintenance harus berupa function",
  );
  assert.equal(
    typeof ui.sendLoading,
    "function",
    "ui.sendLoading harus berupa function",
  );
});
