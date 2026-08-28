'use strict';

/**
 * @namespace: src/ai/vibeMonitor.js
 * @type: Engine / Listener
 * @description: Naura Mood & Vibe, Reaksi kontekstual dan empati alami bot di channel
 */

const { logger } = require('../managers/logger');

// Cooldown tracker in-memory
const userCooldowns = new Map();
const channelCooldowns = new Map();

const USER_COOLDOWN_MS = 180000; // 3 menit per user
const CHANNEL_COOLDOWN_MS = 60000; // 1 menit per channel

const VIBE_PATTERNS = [
    {
        type: 'celebration',
        emojis: ['🎉', '✨', '🔥', '👑'],
        regex: /\b(dapet\s+ur|gacha\s+ur|dapet\s+ssr|gacha\s+ssr|level\s+100|menang\s+duel|win\s+streak|hoki\s+banget|ez\s+dungeon|juara\s+1)\b/i,
    },
    {
        type: 'sympathy',
        emojis: ['🥺', '💙', '🫂', '🍵'],
        regex: /\b(kalah\s+duel|streak\s+putus|zonk\s+gacha|mati\s+di\s+dungeon|kalah\s+terus|apes\s+banget|sial\s+banget)\b/i,
    },
    {
        type: 'affection',
        emojis: ['🌸', '💖', '🥰', '✨'],
        regex: /\b(makasih\s+naura|terima\s+kasih\s+naura|love\s+naura|naura\s+cantik|naura\s+lucu|naura\s+terbaik|naura\s+kawaii)\b/i,
    },
];

class VibeMonitor {
    /**
     * Evaluasi pesan untuk reaksi kontekstual
     * @param {import('discord.js').Message} message
     */
    async handleMessage(message) {
        if (!message || message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const channelId = message.channel.id;
        const now = Date.now();

        // Cek cooldown
        const lastUser = userCooldowns.get(userId) || 0;
        const lastChannel = channelCooldowns.get(channelId) || 0;
        if (now - lastUser < USER_COOLDOWN_MS || now - lastChannel < CHANNEL_COOLDOWN_MS) {
            return;
        }

        const text = message.content || '';
        if (text.length < 4 || text.length > 300) return;

        for (const pattern of VIBE_PATTERNS) {
            if (pattern.regex.test(text)) {
                // Pilih emoji acak dari kategori pola
                const emoji = pattern.emojis[Math.floor(Math.random() * pattern.emojis.length)];

                userCooldowns.set(userId, now);
                channelCooldowns.set(channelId, now);

                try {
                    await message.react(emoji);
                } catch (e) {
                    // Abaikan jika bot tidak punya izin Add Reactions di channel
                }
                break;
            }
        }
    }
}

module.exports = new VibeMonitor();
