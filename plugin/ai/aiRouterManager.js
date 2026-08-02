const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { logger } = require('../../src/managers/logger');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../../src/config/env');
const ui = require('../../src/config/ui');
const { checkModeration, checkRateLimit, simulateTypingDelay, performWebSearchIfNeeded, updateGeminiHistory, getGeminiHistory } = require('./aiHelper');

// Safety check so it doesn't crash if GEMINI_API_KEY is not defined
const genAI = env.GEMINI_API
    ? new GoogleGenerativeAI(env.GEMINI_API)
    : env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
      : null;

class AIRouterManager {
    static async processMessage(
        client,
        message,
        userMessage,
        persona,
        previousBotMessage,
        isOwner,
        isPremiumUser,
        settings
    ) {
        let replyText = '';
        let usedEngine = 'Verba AI';

        // Inject Dashboard Settings Context
        if (settings && settings.settings && settings.settings.ai) {
            const aiSettings = settings.settings.ai;
            if (aiSettings.customPersona) {
                persona += `\n[Sifat Khusus Server]: ${aiSettings.customPersona}`;
            }
            if (aiSettings.serverKnowledge) {
                persona += `\n[Aturan/FAQ Server (Jadikan Pedoman Menjawab)]: ${aiSettings.serverKnowledge}`;
            }
        }

        // 1. Auto-Moderation Check
        const modResult = await checkModeration(userMessage);
        if (modResult.flagged) {
            return ui.sendError(message, `Maaf, Naura tidak bisa merespons pesanmu karena: ${modResult.reason}.`);
        }

        // 2. Rate Limit Check
        const rateLimit = await checkRateLimit(message.author.id, isOwner, isPremiumUser);
        if (!rateLimit.allowed) {
            return ui.sendError(message, `Sabar yaa! Naura pusing ditanya terus. Kasih jeda ${rateLimit.retryAfter} detik lagi dong~ 😵‍💫`);
        }

        const attachment = message.attachments.first();

        if (attachment) {
            usedEngine = 'Gemini Vision';
            try {
                const res = await fetch(attachment.url);
                const arrayBuffer = await res.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                const searchResult = await performWebSearchIfNeeded(userMessage || '');
                let parts = [
                    {
                        text: `${persona}${previousBotMessage}\n\nPesan: ${userMessage || 'Tolong jelaskan gambar ini.'}${searchResult ? searchResult : ''}`
                    },
                    { inlineData: { data: buffer.toString('base64'), mimeType: attachment.contentType } }
                ];

                if (!genAI) throw new Error('GEMINI_API_KEY is not defined in .env');
                
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const response = await model.generateContent(parts);
                replyText = response.response.text();
            } catch (error) {
                logger.error('[GEMINI VISION ERROR]', error);
                const errPayload = buildErrorContainerV2({
                    title: 'Gagal Memproses Gambar',
                    description: `${ui.getEmoji('error') || '❌'} Gagal memproses gambar. Layanan Gemini sedang gangguan.`,
                    footerText: ui.getFooter('core')
                });
                return message.reply(errPayload).catch(() => {});
            }
        } else {
            try {
                const contextPrompt = `${persona}${previousBotMessage}\n\nPesan dari User (${message.author.username}): ${userMessage || '(Menyapa)'}`;

                let targetSlug = env.VERBA_SLUG_GENERAL || env.VERBA_CHARACTER_SLUG || 'naura';
                if (isOwner) {
                    targetSlug = env.VERBA_SLUG_OWNER || env.VERBA_CHARACTER_SLUG || 'naura';
                } else if (isPremiumUser) {
                    targetSlug = env.VERBA_SLUG_PREMIUM || env.VERBA_CHARACTER_SLUG || 'naura';
                }

                const requestBody = {
                    character: targetSlug,
                    messages: [{ role: 'user', content: contextPrompt }]
                };

                const redisManager = require('../../src/managers/redisManager');
                const sessionKey = `verba_session_${message.author.id}`;
                const sessionId = await redisManager.getCache(sessionKey);
                if (sessionId) {
                    requestBody.session_id = sessionId;
                }

                const response = await fetch('https://api.verba.ink/v1/response', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${env.VERBA_API_KEY}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    body: JSON.stringify(requestBody)
                });

                const rawText = await response.text();
                if (!response.ok) {
                    let errorMessage = `HTTP ${response.status}`;
                    try {
                        const errorData = JSON.parse(rawText);
                        errorMessage = errorData.error?.message || errorData.message || errorMessage;
                    } catch (e) {
                        errorMessage = `${errorMessage} - Non-JSON response`;
                    }
                    throw new Error(`Verba API error: ${errorMessage}`);
                }

                let data;
                try {
                    data = JSON.parse(rawText);
                } catch (parseError) {
                    throw new Error(`Invalid JSON response dari Verba API (HTTP ${response.status})`);
                }

                if (data.session_id) {
                    const sessionKey = `verba_session_${message.author.id}`;
                    await redisManager.setCache(sessionKey, data.session_id, 86400);
                }

                replyText = data.choices[0].message.content;

                // Save history for Gemini Fallback Sync
                await updateGeminiHistory(message.author.id, "user", userMessage || '(Menyapa)');
                await updateGeminiHistory(message.author.id, "model", replyText);

            } catch (verbaError) {
                logger.error(`\x1b[33m[VERBA API ERROR] ${verbaError.message}\x1b[0m`);
                
                const userRole = isOwner ? 'Owner' : (isPremiumUser ? 'Premium User' : 'User');
                console.error(
                    `\x1b[33mBeralih ke Gemini (Fallback) untuk ${userRole} (${message.author.username})\x1b[0m`
                );
                usedEngine = 'Gemini AI (Fallback)';

                try {
                    if (!genAI) throw new Error('GEMINI_API_KEY is not defined in .env');
                    
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const promptText = `${persona}${previousBotMessage}\n\nPesan dari ${userRole} (${message.author.username}): ${userMessage || '(Menyapa)'}`;
                    const history = await getGeminiHistory(message.author.id);
                    const chatSession = model.startChat({
                        history: history,
                    });
                    const response = await chatSession.sendMessage(promptText);
                    replyText = response.response.text();

                    // Save history
                    await updateGeminiHistory(message.author.id, "user", promptText);
                    await updateGeminiHistory(message.author.id, "model", replyText);
                } catch (geminiError) {
                    logger.error('[GEMINI FALLBACK ERROR]', geminiError);
                    
                    // ==========================================
                    // 🧠 FALLBACK KE-3: OLLAMA (Local AI)
                    // ==========================================
                    try {
                        usedEngine = 'Ollama Local AI (Fallback)';
                        logger.info(`[AI Router] Beralih ke Ollama untuk ${userRole} (${message.author.username})`);
                        
                        const { Ollama } = require('ollama');
                        const ollamaClient = new Ollama({ host: env.OLLAMA_BASE_URL });
                        const promptText = `${persona}${previousBotMessage}\n\nPesan dari ${userRole} (${message.author.username}): ${userMessage || '(Menyapa)'}`;
                        
                        const ollamaResponse = await ollamaClient.chat({
                            model: env.OLLAMA_MODEL,
                            messages: [{ role: 'user', content: promptText }],
                        });
                        replyText = ollamaResponse.message.content;

                        // Save history
                        await updateGeminiHistory(message.author.id, "user", promptText);
                        await updateGeminiHistory(message.author.id, "model", replyText);
                    } catch (ollamaError) {
                        logger.error('[OLLAMA FALLBACK ERROR]', ollamaError);
                        return ui.sendError(
                            message,
                            'Waduh, jaringan AI Naura (Verba, Gemini, maupun Ollama) sedang down. Coba lagi nanti ya! 😵‍💫'
                        );
                    }
                }
            }
        }

        // 3. Dynamic Typing Delay
        await simulateTypingDelay(replyText);

        const lines = replyText.split('\n');
        let chunks = [];
        let currentChunk = '';
        let inCodeBlock = false;

        for (const line of lines) {
            if (line.includes('```')) {
                const backticksCount = (line.match(/```/g) || []).length;
                if (backticksCount % 2 !== 0) inCodeBlock = !inCodeBlock;
            }

            if (currentChunk.length + line.length + 1 > 3900) {
                if (inCodeBlock) {
                    chunks.push(currentChunk + '\n```');
                    currentChunk = '```\n' + line + '\n';
                } else {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                }
            } else {
                currentChunk += line + '\n';
            }
        }
        if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());

        for (let i = 0; i < chunks.length; i++) {
            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                authorName: i === 0 ? 'Naura AI' : undefined,
                iconURL: i === 0 ? client.user.displayAvatarURL() : undefined,
                description: chunks[i] || '...',
                footerText: i === chunks.length - 1 ? `Powered by Naura Inteligent System • Dipesan oleh ${message.author.username}` : undefined
            });

            if (i === 0) {
                await message.reply(payload).catch(() => {});
            } else {
                await message.channel.send(payload).catch(() => {});
            }
        }

        if (settings && settings.aiVoiceEnabled && message.member && message.member.voice.channel) {
            const VoiceManager = require('../../src/managers/voiceManager');
            VoiceManager.speak(replyText, message.member).catch(err => {
                logger.error('[TTS EXECUTION ERROR]', err);
            });
        }
    }
}

module.exports = AIRouterManager;
