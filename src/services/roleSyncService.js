"use strict";

const { PermissionFlagsBits } = require("discord.js");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

/**
 * Mengevaluasi daftar role yang berhak didapatkan anggota berdasarkan statistik pemain.
 * Fungsi murni (pure function) tanpa side-effect untuk pengujian deterministik.
 *
 * @param {Array<{type: string, threshold: number, roleId: string}>} rules
 * @param {{level?: number, survival_level?: number, wealth?: number, fragments?: number}} stats
 * @returns {string[]} Daftar roleId yang memenuhi syarat
 */
function evaluateMilestoneRoles(rules = [], stats = {}) {
  if (!Array.isArray(rules) || rules.length === 0) return [];

  const eligibleRoleIds = new Set();

  for (const rule of rules) {
    if (!rule || !rule.roleId || typeof rule.threshold !== "number") continue;

    const threshold = rule.threshold;
    const type = rule.type || "level";

    let statValue = 0;
    if (type === "level") {
      statValue = stats.level || 1;
    } else if (type === "survival_level") {
      statValue = stats.survival_level || 1;
    } else if (type === "wealth") {
      statValue = stats.wealth || 0;
    } else if (type === "fragments") {
      statValue = stats.fragments || 0;
    }

    if (statValue >= threshold) {
      eligibleRoleIds.add(rule.roleId);
    }
  }

  return Array.from(eligibleRoleIds);
}

/**
 * Mengambil daftar konfigurasi hadiah role di suatu server.
 * @param {string} guildId
 * @returns {Promise<Array<{type: string, threshold: number, roleId: string}>>}
 */
async function getRoleRewards(guildId) {
  if (!guildId) return [];
  const settings = await cacheManager.getGuildSettings(guildId);
  return settings?.settings?.levelRoles || [];
}

/**
 * Mendaftarkan atau memperbarui aturan hadiah role di server.
 * @param {string} guildId
 * @param {{type: string, threshold: number, roleId: string}} rule
 * @returns {Promise<boolean>}
 */
async function addRoleReward(guildId, rule) {
  if (!guildId || !rule?.roleId || typeof rule.threshold !== "number") return false;

  const guildSettings = await cacheManager.getGuildSettings(guildId);
  if (!guildSettings) return false;

  const currentSettings = guildSettings.settings || {};
  const currentRoles = Array.isArray(currentSettings.levelRoles) ? [...currentSettings.levelRoles] : [];

  const existingIdx = currentRoles.findIndex(
    (r) => r.type === rule.type && r.threshold === rule.threshold,
  );

  if (existingIdx >= 0) {
    currentRoles[existingIdx] = rule;
  } else {
    currentRoles.push(rule);
  }

  currentSettings.levelRoles = currentRoles;
  guildSettings.settings = currentSettings;

  await guildSettings.save({ fields: ["settings"] });
  return true;
}

/**
 * Menghapus aturan hadiah role di server.
 * @param {string} guildId
 * @param {string} roleId
 * @returns {Promise<boolean>}
 */
async function removeRoleReward(guildId, roleId) {
  if (!guildId || !roleId) return false;

  const guildSettings = await cacheManager.getGuildSettings(guildId);
  if (!guildSettings) return false;

  const currentSettings = guildSettings.settings || {};
  const currentRoles = Array.isArray(currentSettings.levelRoles) ? currentSettings.levelRoles : [];
  const filtered = currentRoles.filter((r) => r.roleId !== roleId);

  if (filtered.length === currentRoles.length) return false;

  currentSettings.levelRoles = filtered;
  guildSettings.settings = currentSettings;

  await guildSettings.save({ fields: ["settings"] });
  return true;
}

/**
 * Menyinkronkan role Discord seorang anggota berdasarkan level dan pencapaiannya.
 * @param {import('discord.js').GuildMember} member
 * @param {object} [customStats]
 * @returns {Promise<{added: string[], totalEligible: number}>}
 */
async function syncMemberRoles(member, customStats = null) {
  if (!member || !member.guild) {
    return { added: [], totalEligible: 0 };
  }

  // Guard Clause 1: Bot membutuhkan izin ManageRoles
  const botMember = member.guild.members.me;
  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { added: [], totalEligible: 0 };
  }

  let stats = customStats;
  if (!stats) {
    const userProfile = await cacheManager.getUserProfile(member.id);
    const userSurvival = await cacheManager.getUserSurvival(member.id);

    stats = {
      level: userProfile?.leveling_level || 1,
      survival_level: userSurvival?.survival_level || 1,
      wealth: (userProfile?.economy_wallet || 0) + (userProfile?.economy_bank || 0),
      fragments: userSurvival?.starFragments || 0,
    };
  }

  const rules = await getRoleRewards(member.guild.id);
  const eligibleRoleIds = evaluateMilestoneRoles(rules, stats);

  const added = [];

  for (const roleId of eligibleRoleIds) {
    // Lewati jika user sudah memiliki role tersebut
    if (member.roles.cache.has(roleId)) continue;

    const role = member.guild.roles.cache.get(roleId);
    if (!role) continue;

    // Pastikan posisi role bot lebih tinggi dari role target
    if (botMember.roles.highest.comparePositionTo(role) <= 0) {
      logger.warn(
        `[RoleSync] Posisi role Naura tidak cukup tinggi untuk menyematkan role @${role.name} di ${member.guild.name}.`,
      );
      continue;
    }

    try {
      await member.roles.add(role, "Naura Achievement Milestone Role Sync");
      added.push(role.name);
    } catch (err) {
      logger.error(`[RoleSync] Gagal memberikan role @${role.name}:`, err.message);
    }
  }

  return { added, totalEligible: eligibleRoleIds.length };
}

module.exports = {
  evaluateMilestoneRoles,
  getRoleRewards,
  addRoleReward,
  removeRoleReward,
  syncMemberRoles,
};
