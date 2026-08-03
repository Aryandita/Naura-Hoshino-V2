const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { logger } = require('../../src/managers/logger');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../../src/config/env');
const ui = require('../../src/config/ui');
const nauraExpression = require('../../src/utils/nauraExpression');
const { checkModeration, checkRateLimit, simulateTypingDelay, performWebSearchIfNeeded, updateGeminiHistory, getGeminiHistory } = require('./aiHelper');

// Safety check so it doesn't crash if GEMINI_API_KEY is not defined
const genAI = env.GEMINI_API
    ? new GoogleGenerativeAI(env.GEMINI_API)
    : env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
      : null;

/** Emoji dengan cadangan, supaya kunci yang belum terdaftar tidak bikin teks bolong. */
function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

/** Wajah Naura untuk sebuah suasana, dengan cadangan emoji biasa. */
function face(mood, fallback) {
    return nauraExpression.getEmoji(mood) || ui.getEmoji(mood) || fallback;
}

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
            return ui.sendError(message, `Maaf ya, Naura tidak bisa menjawab pesan itu karena ${modResult.reason.toLowerCase()}. Yuk ngobrol yang lain, Naura tetap senang menemanimu.`);
        }

        // 2. Rate Limit Check
        const rateLimit = await checkRateLimit(message.author.id, isOwner, isPremiumUser);
        if (!rateLimit.allowed) {
            return ui.sendError(message, `Pelan-pelan ya, Naura masih mengejar napas. Beri Naura ${rateLimit.retryAfter} detik lagi, nanti Naura balas lagi dengan senang hati.`);
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
                    title: 'Naura belum bisa melihatnya',
                    description: `Maaf ya, mata Naura sedang buram — layanan pembaca gambar lagi bermasalah. Coba kirim lagi sebentar lagi, Naura tunggu.`,
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
                    await redisManager.setCache(sessionKey, data.session_id, 86400);
                }

                // Bentuk balasan Verba tidak selalu sama. Diperiksa dulu daripada
                // membiarkan akses berantai melempar TypeError di tengah percakapan.
                replyText = data?.choices?.[0]?.message?.content
                    || data?.message?.content
                    || data?.content
                    || '';

                if (!replyText) throw new Error('Balasan Verba API kosong atau formatnya tidak dikenali.');

                // Save history for Gemini Fallback Sync
                await updateGeminiHistory(message.author.id, 'user', userMessage || '(Menyapa)');
                await updateGeminiHistory(message.author.id, 'model', replyText);

            } catch (verbaError) {
                logger.error(`[VERBA API ERROR] ${verbaError.message}`);

                const userRole = isOwner ? 'Owner' : (isPremiumUser ? 'Premium User' : 'User');
                logger.info(`[AI Router] Beralih ke Gemini (Fallback) untuk ${userRole} (${message.author.username})`);
                usedEngine = 'Gemini AI (Fallback)';

                try {
                    if (!genAI) throw new Error('GEMINI_API_KEY is not defined in .env');

                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const promptText = `${persona}${previousBotMessage}\n\nPesan dari ${userRole} (${message.author.username}): ${userMessage || '(Menyapa)'}`;
                    const history = await getGeminiHistory(message.author.id);
                    const chatSession = model.startChat({ history });
                    const response = await chatSession.sendMessage(promptText);
                    replyText = response.response.text();

                    // Save history
                    await updateGeminiHistory(message.author.id, 'user', promptText);
                    await updateGeminiHistory(message.author.id, 'model', replyText);
                } catch (geminiError) {
                    logger.error('[GEMINI FALLBACK ERROR]', geminiError);

                    // ==========================================
                    // FALLBACK KE-3: OLLAMA (Local AI)
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
                        await updateGeminiHistory(message.author.id, 'user', promptText);
                        await updateGeminiHistory(message.author.id, 'model', replyText);
                    } catch (ollamaError) {
                        logger.error('[OLLAMA FALLBACK ERROR]', ollamaError);
                        return ui.sendError(
                            message,
                            'Maaf ya, semua jalur berpikir Naura sedang tertidur. Naura benar-benar ingin menjawabmu — coba sapa Naura lagi sebentar lagi.'
                        );
                    }
                }
            }
        }

        // Jaring pengaman terakhir: Naura tidak boleh mengirim pesan kosong.
        if (!replyText || !replyText.trim()) {
            replyText = 'Hmm, Naura sempat kehilangan kata-kata sebentar. Boleh tanyakan sekali lagi?';
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
        if (chunks.length === 0) chunks.push(replyText);

        // Judul balasan. Dulu bagian ini tidak pernah diisi, sehingga Container V2
        // menampilkan tulisan "undefined" tepat di atas jawaban Naura.
        const replyTitle = `${face('happy', e('naura', '💬'))} Naura menjawab`;

        for (let i = 0; i < chunks.length; i++) {
            const isFirst = i === 0;
            const isLast = i === chunks.length - 1;

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                authorName: isFirst ? 'Naura AI' : undefined,
                title: isFirst ? replyTitle : undefined,
                iconURL: isFirst ? client.user.displayAvatarURL() : undefined,
                description: chunks[i] || '...',
                footerText: isLast
                    ? `Powered by Naura Intelligent System • ${usedEngine} • Untuk ${message.author.username}`
                    : undefined
            });

            if (isFirst) {
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
