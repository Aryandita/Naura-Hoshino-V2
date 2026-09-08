"use strict";

/**
 * @namespace src/managers/notificationManager.js
 * @deprecated Gunakan src/services/notificationCenter.js sebagai single source of truth.
 * Modul ini mengekspor kembali seluruh API notificationCenter untuk kompatibilitas penuh.
 */
const notificationCenter = require("../services/notificationCenter");

module.exports = {
  ...notificationCenter,
  sendNotification: notificationCenter.sendDirectNotification,
  ensureDmAuthorized: notificationCenter.ensureDmAuthorized,
};
