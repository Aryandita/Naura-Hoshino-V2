"use strict";

const { Events } = require("discord.js");
const entitlementService = require("../services/entitlementService");
const { logger } = require("../managers/logger");

module.exports = {
  name: Events.EntitlementDelete || "entitlementDelete",
  async execute(entitlement, client) {
    try {
      await entitlementService.handleEntitlementDelete(entitlement);
    } catch (err) {
      logger.error(
        `[Events:entitlementDelete] Error processing entitlement deletion: ${err.message}`,
      );
    }
  },
};
