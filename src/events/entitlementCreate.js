"use strict";

const { Events } = require("discord.js");
const entitlementService = require("../services/entitlementService");
const { logger } = require("../managers/logger");

module.exports = {
  name: Events.EntitlementCreate || "entitlementCreate",
  async execute(entitlement, client) {
    try {
      await entitlementService.handleEntitlementCreate(entitlement);
    } catch (err) {
      logger.error(`[Events:entitlementCreate] Error processing entitlement: ${err.message}`);
    }
  },
};
