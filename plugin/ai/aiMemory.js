'use strict';

const redisManager = require('../../src/managers/redisManager');
const MEMORY_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

class AIMemory {
    static async getMemoryContext(userId) {
        if (!redisManager.isReady) return '';
        const memory = await redisManager.getCache(`ai:memory:${userId}`);
        if (memory && typeof memory === 'string' && memory.trim() !== '') {
            return `\n[Catatan Ingatan AI tentang User]: ${memory}\n`;
        }
        return '';
    }

    static async appendMemory(userId, summary) {
        if (!redisManager.isReady || !summary) return;
        await redisManager.setCache(`ai:memory:${userId}`, summary, MEMORY_TTL);
    }

    static async compressHistoryIfNeeded(geminiClient, historyArray, userId) {
        if (!historyArray || historyArray.length < 20) return historyArray; // Only compress if too long

        try {
            // Take the oldest 10 messages to summarize
            const toSummarize = historyArray.slice(0, 10);
            const remainder = historyArray.slice(10);
            
            const conversationText = toSummarize.map(msg => 
                `${msg.role}: ${msg.parts.map(p => p.text).join(' ')}`
            ).join('\n');

            const prompt = `Rangkum poin-poin penting dari percakapan berikut dalam 2-3 kalimat singkat. Fokus pada preferensi user, nama, atau detail penting lainnya. Jika tidak ada yang penting, balas dengan "TIDAK_ADA_YANG_PENTING".\n\nPercakapan:\n${conversationText}`;

            const responseText = await geminiClient.generate({ parts: [{ text: prompt }] });
            
            if (responseText && !responseText.includes('TIDAK_ADA_YANG_PENTING')) {
                const existingMemory = await redisManager.getCache(`ai:memory:${userId}`) || '';
                let newMemory = existingMemory ? `${existingMemory} | ${responseText}` : responseText;
                
                // Cap memory length
                if (newMemory.length > 800) {
                    newMemory = newMemory.substring(newMemory.length - 800);
                }
                
                await this.appendMemory(userId, newMemory);
            }

            return remainder; // Return the shortened history
        } catch (e) {
            console.error('[AIMemory] Gagal kompresi histori:', e);
            return historyArray.slice(-10); // Fallback: just drop old messages
        }
    }
}

module.exports = AIMemory;
