"use strict";

const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");

class AutomationEngine {
  constructor() {
    this.TRIGGERS = {
      MEMBER_JOIN: "MEMBER_JOIN",
      LEVEL_UP: "LEVEL_UP",
      REACTION_ADD: "REACTION_ADD",
      TICKET_CREATE: "TICKET_CREATE",
      SURVIVAL_LEVEL_UP: "SURVIVAL_LEVEL_UP",
      QUEST_COMPLETE: "QUEST_COMPLETE",
      BOSS_KILLED: "BOSS_KILLED",
      SEASON_TIER_UP: "SEASON_TIER_UP",
    };
  }

  /**
   * Dispatch trigger event ke seluruh workflow aktif di guild
   * @param {string} triggerType
   * @param {object} eventContext - { guild, member, user, channel, metadata }
   */
  async handleTrigger(triggerType, eventContext) {
    const { guild } = eventContext;
    if (!guild) return;

    try {
      const settings = await cacheManager.getGuildSettings(guild.id);
      const automations = settings?.settings?.automations || [];

      const activeFlows = automations.filter(
        (a) => a.enabled && a.trigger === triggerType,
      );

      for (const flow of activeFlows) {
        await this._executeFlow(flow, eventContext);
      }
    } catch (e) {
      logger.error(
        `[AutomationEngine] Gagal mengeksekusi trigger ${triggerType}:`,
        e,
      );
    }
  }

  /**
   * Eksekusi satu alur workflow
   */
  async _executeFlow(flow, ctx) {
    // 1. Condition Check
    if (Array.isArray(flow.conditions) && flow.conditions.length > 0) {
      for (const cond of flow.conditions) {
        if (!this._evaluateCondition(cond, ctx)) {
          return; // Condition not met, skip execution
        }
      }
    }

    // 2. Action Execution
    if (Array.isArray(flow.actions)) {
      for (const act of flow.actions) {
        try {
          await this._executeAction(act, ctx);
        } catch (err) {
          logger.warn(
            `[AutomationEngine] Gagal menjalankan aksi ${act.type}: ${err.message}`,
          );
        }
      }
    }
  }

  _evaluateCondition(cond, ctx) {
    const { member } = ctx;
    switch (cond.type) {
      case "HAS_ROLE":
        return member?.roles?.cache?.has(cond.roleId);
      case "MIN_LEVEL":
        return (ctx.level || ctx.survivalLevel || 0) >= cond.value;
      case "MIN_TIER":
        return (ctx.tier || 0) >= cond.value;
      case "KEYWORD_MATCH":
        return String(ctx.text || "")
          .toLowerCase()
          .includes(String(cond.keyword).toLowerCase());
      default:
        return true;
    }
  }

  async _executeAction(action, ctx) {
    const { member, user, guild } = ctx;

    switch (action.type) {
      case "ADD_ROLE":
        if (member && action.roleId) {
          await member.roles.add(action.roleId).catch(() => {});
        }
        break;

      case "SEND_DM":
        if (user && action.message) {
          const container = buildContainerV2({
            title: action.title || "🌸 Pesan Otomatisasi Naura",
            description: action.message
              .replace(/{user}/g, `<@${user.id}>`)
              .replace(/{server}/g, guild?.name || ""),
            color: action.color || "#FFB6C1",
          });
          await user.send(container).catch(() => {});
        }
        break;

      case "REWARD_CURRENCY":
        if (user && action.amount > 0) {
          await cacheManager.incrementUserSurvival(
            user.id,
            "starFragments",
            action.amount,
          );
        }
        break;

      case "WEBHOOK_POST":
        if (action.url) {
          await fetch(action.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "naura_automation",
              userId: user?.id,
              guildId: guild?.id,
              timestamp: new Date().toISOString(),
              payload: action.payload || {},
            }),
          }).catch(() => {});
        }
        break;
    }
  }
}

module.exports = new AutomationEngine();
