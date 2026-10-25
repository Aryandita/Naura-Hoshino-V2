"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const MAX_BRANCHES = 5;
const SUPPLY_CHAIN_STAGES = ["raw", "processed", "finished"];

class FranchiseEngine {
  static async openBranch(userId, location, businessType) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      const branches = survival?.franchiseBranches || [];

      if (branches.length >= MAX_BRANCHES) {
        return { ok: false, reason: "MAX_BRANCHES_REACHED" };
      }

      const branch = {
        id: `branch_${Date.now()}`,
        location,
        businessType,
        openedAt: Date.now(),
        revenue: 0,
        staffCount: 1,
        reputation: 50,
      };

      branches.push(branch);
      await cacheManager.updateUserSurvival(userId, { franchiseBranches: branches });
      logger.info(`[Franchise] ${userId} opened branch at ${location}`);
      return { ok: true, branchId: branch.id };
    } catch (error) {
      logger.error(`[Franchise] Open error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async collectRevenue(userId, branchId) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      const branches = survival?.franchiseBranches || [];
      const branchIndex = branches.findIndex((b) => b.id === branchId);

      if (branchIndex === -1) return { ok: false, reason: "BRANCH_NOT_FOUND" };

      const branch = branches[branchIndex];
      const baseRevenue = Math.floor(branch.reputation * branch.staffCount * 0.5);
      branch.revenue += baseRevenue;

      await cacheManager.updateUserSurvival(userId, { franchiseBranches: branches });
      return { ok: true, collected: baseRevenue, totalRevenue: branch.revenue };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static processSupplyChain(materials, stage) {
    const conversions = {
      raw: { input: "ore_iron", output: "iron_ingot", ratio: 2 },
      processed: { input: "iron_ingot", output: "steel_plate", ratio: 3 },
      finished: { input: "steel_plate", output: "masterwork_blade", ratio: 1 },
    };

    const conversion = conversions[stage];
    if (!conversion) return { ok: false, reason: "INVALID_STAGE" };

    const inputCount = materials[conversion.input] || 0;
    if (inputCount < conversion.ratio) return { ok: false, reason: "INSUFFICIENT_MATERIALS" };

    const outputCount = Math.floor(inputCount / conversion.ratio);
    return { ok: true, input: conversion.input, consumed: outputCount * conversion.ratio, output: conversion.output, produced: outputCount };
  }
}

module.exports = { FranchiseEngine, MAX_BRANCHES, SUPPLY_CHAIN_STAGES };
