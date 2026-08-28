'use strict';

/**
 * @namespace: src/services/webhookDispatcher.js
 * @type: Service / Webhook Integration
 * @description: Layanan pengiriman event bot ke webhook pihak ketiga (Zapier, Make, Discord webhook, Custom API)
 */

const { logger } = require('../managers/logger');

const EVENT_TYPES = {
    MEMBER_LEVEL_UP: 'member.level_up',
    TICKET_CREATED: 'ticket.created',
    LARGE_TRANSACTION: 'economy.large_transaction',
    SEASON_TIER_CLAIMED: 'season.tier_claimed',
    WORLD_BOSS_DEFEATED: 'world_boss.defeated',
};

class WebhookDispatcher {
    /**
     * Kirim event payload ke endpoint eksternal secara non-blocking
     * @param {string} webhookUrl
     * @param {string} eventType
     * @param {object} payload
     * @returns {Promise<boolean>}
     */
    async dispatch(webhookUrl, eventType, payload = {}) {
        if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
            return false;
        }

        const body = {
            event: eventType,
            timestamp: new Date().toISOString(),
            source: 'Naura Hoshino V2 Ecosystem',
            data: payload,
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Naura-Hoshino-WebhookDispatcher/2.1.0',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return res.ok;
        } catch (err) {
            logger.warn(`[WebhookDispatcher] Gagal mengirim event '${eventType}' ke webhook: ${err.message}`);
            return false;
        }
    }
}

module.exports = new WebhookDispatcher();
module.exports.EVENT_TYPES = EVENT_TYPES;
