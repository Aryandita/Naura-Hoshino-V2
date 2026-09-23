"use strict";

const { Events } = require("discord.js");
const entitlementService = require("../services/entitlementService");
const { logger } = require("../managers/logger");

module.exports = {
  name: Events.EntitlementUpdate || "entitlementUpdate",
  async execute(entitlement, client) {
    try {
      await entitlementService.handleEntitlementUpdate(entitlement);
    } catch (err) {
      logger.error(
        `[Events:entitlementUpdate] Error processing entitlement: ${err.message}`,
      );
    }
  },
};
