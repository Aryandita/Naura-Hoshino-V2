const { logger } = require('./logger');
const ui = require('../config/ui');
const env = require('../config/env');
const redisManager = require('./redisManager');

// @google/genai dan ollama keduanya berat dan keduanya hanya terpakai ketika ada
// permintaan AI yang benar-benar masuk. Sebelumnya keduanya di-require di baris atas,
// jadi setiap shard membayar biaya muatnya saat boot meski tidak ada satu pun perintah
// AI dipakai sepanjang uptime. Sekarang require-nya ditunda sampai pemakaian pertama.
let GoogleGenAICtor = null;
let OllamaCtor = null;

function loadGoogleGenAI() {
    if (!GoogleGenAICtor) {
        ({ GoogleGenAI: GoogleGenAICtor } = require('@google/genai'));
    }
    return GoogleGenAICtor;
}

function loadOllama() {
    if (!OllamaCtor) {
        ({ Ollama: OllamaCtor } = require('ollama'));
    }
    return OllamaCtor;
}

const SESSION_TTL_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const QUEUE_DELAY_MS = 1500;
const CHUNK_LIMIT = 1950;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

class AIManager {
    constructor() {
        // Gemini dipakai khusus untuk membaca gambar (Vision) dan sebagai fallback teks.
        const geminiKeys = Array.isArray(env.GEMINI_API_KEYS) && env.GEMINI_API_KEYS.length > 0
            ? env.GEMINI_API_KEYS
            : [env.GEMINI_API].filter(Boolean);

        this.apiKeys = geminiKeys;
        this.currentKeyIndex = 0;

        // Klien SDK dibuat belakangan, bukan di constructor.
        this._genAI = null;
        this._ollama = null;

        this._defaultModel = 'gemini-2.5-flash';
        this._defaultSystemInstruction = 'Nama kamu adalah Naura Hoshino, asisten Discord virtual yang ceria, ramah, dan sangat pintar. Kamu diciptakan dan dikelola oleh Aryandita. Kamu suka menggunakan emoji dalam setiap kalimat. Gunakan bahasa Indonesia yang santai, gaul, namun tetap sopan dan sangat membantu.';

        // Memisahkan ruang memori: satu untuk Gemini (Gambar) dan satu untuk Verba (Teks)
        

        // Global AI Task Queue
        this.queue = [];
        this.isProcessingQueue = false;

        if (this.apiKeys.length === 0 || !this.apiKeys[0]) {
            logger.warn('[AI] GEMINI_API_KEY tidak ditemukan. Fitur Vision dan fallback Gemini dimatikan, Verba dan Ollama tetap jalan.');
        }

        // TTL Cleanup loop. unref() wajib, kalau tidak timer ini menahan event loop dan
        // proses menolak mati saat shutdown sampai watchdog memaksanya keluar.
        
    }

    // Mengembalikan klien Gemini, atau null bila tidak ada API key sama sekali.
    //
    // Sebelumnya constructor menjalankan this.model = this.genAI.models secara langsung.
    // Ketika GEMINI_API_KEY kosong, this.genAI bernilai undefined dan baris itu melempar
    // TypeError. Karena berkas ini mengekspor instance (module.exports = new AIManager()),
    // kegagalan tersebut terjadi saat require dan mematikan seluruh proses boot, bukan
    // sekadar mematikan fitur AI.
    getGenAI() {
        if (this.apiKeys.length === 0 || !this.apiKeys[this.currentKeyIndex]) return null;

        if (!this._genAI) {
            const GoogleGenAI = loadGoogleGenAI();
            this._genAI = new GoogleGenAI({ apiKey: this.apiKeys[this.currentKeyIndex] });
        }
        return this._genAI;
    }

    // Dipertahankan sebagai properti agar pemanggil lama yang membaca aiManager.genAI
    // dan aiManager.model tetap bekerja tanpa perubahan.
    get genAI() {
        return this.getGenAI();
    }

    get model() {
        const client = this.getGenAI();
        return client ? client.models : null;
    }

    getOllama() {
        if (!this._ollama) {
            const Ollama = loadOllama();
            this._ollama = new Ollama({ host: env.OLLAMA_BASE_URL });
        }
        return this._ollama;
    }

    rotateKey() {
        if (this.apiKeys.length <= 1) return false;

        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

        // Klien dikosongkan, bukan dibuat ulang di sini. Pembuatannya menunggu pemakaian
        // berikutnya lewat getGenAI(), sehingga rotasi kunci tidak pernah memuat SDK
        // hanya untuk dibuang lagi.
        this._genAI = null;
        console.log(`\x1b[43m\x1b[30m \ud83d\udd04 GEMINI FALLBACK \x1b[0m \x1b[33mBeralih ke API Key ke-${this.currentKeyIndex + 1}...\x1b[0m`);
        return true;
    }

    async getMemory(userId, type) {
        if (!redisManager.isReady) return null;
        const data = await redisManager.getCache(`ai:${type}:${userId}`);
        return data || null;
    }

    async saveMemory(userId, type, data) {
        if (!redisManager.isReady) return;
        await redisManager.setCache(`ai:${type}:${userId}`, data, SESSION_TTL_MS);
    }

    async _processQueue() {
        if (this.queue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }

        this.isProcessingQueue = true;
        const task = this.queue.shift();

        try {
            await this._executeMessage(task.message, task.prompt, task.isOwner, task.isPremium);
        } catch (e) {
            logger.error('[AI Queue Error]', e);
        }

        // Delay antar pesan AI untuk mencegah Error 429 dari Verba maupun Gemini.
        const timer = setTimeout(() => {
            this._processQueue();
        }, QUEUE_DELAY_MS);
        if (timer.unref) timer.unref();
    }

    async handleMessage(message, prompt, isOwner = false, isPremium = false) {
        this.queue.push({ message, prompt, isOwner, isPremium });
        if (!this.isProcessingQueue) {
            this._processQueue();
        }
    }

    async _executeMessage(message, prompt, isOwner, isPremium) {
        const userId = message.author.id;

        try {
            // Indikator bot sedang "mengetik" di Discord
            await message.channel.sendTyping();

            // Cek apakah ada attachment gambar
            let attachment = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
            if (!attachment && message.reference) {
                try {
                    const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                    attachment = referencedMsg.attachments.find(
                        a => a.contentType && a.contentType.startsWith('image/')
                    );
                } catch (e) {
                    /* ignore error fetch reply */
                }
            }

            let responseText = '';

            // ==========================================
            // LOGIKA 1: JIKA ADA GAMBAR -> PAKAI GEMINI
            // ==========================================
            if (attachment) {
                let sessionData = await this.getMemory(userId, 'gemini') || { history: [] };

                const visionClient = this.getGenAI();

                if (!visionClient) {
                    responseText = `${ui.emojis?.error || '❌'} Naura belum bisa melihat gambar karena GEMINI_API_KEY belum diisi.`;
                } else {
                    try {
                        const res = await fetch(attachment.url);
                        const arrayBuffer = await res.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);

                        const contents = [
                            { role: 'user', parts: [
                                { text: prompt || 'Tolong jelaskan gambar ini.' },
                                { inlineData: { data: buffer.toString('base64'), mimeType: attachment.contentType } }
                            ]}
                        ];

                        const { tools, dispatchFunction } = require('../../plugin/ai/functionDispatcher');
                        const gemConfig = { 
                            systemInstruction: this._defaultSystemInstruction, 
                            maxOutputTokens: 1500,
                            tools: [{ functionDeclarations: tools }]
                        };

                        let result = await visionClient.models.generateContent({
                            model: this._defaultModel,
                            contents,
                            config: gemConfig
                        });
                        
                        if (result.functionCalls && result.functionCalls.length > 0) {
                            for (const call of result.functionCalls) {
                                const fnResult = await dispatchFunction(call.name, call.args, message);
                                contents.push({ role: 'model', parts: [{ functionCall: call }] });
                                contents.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: fnResult } }] });
                            }
                            result = await visionClient.models.generateContent({
                                model: this._defaultModel,
                                contents,
                                config: gemConfig
                            });
                        }
                        responseText = result.text;
                    } catch (e) {
                        logger.error('Gagal memproses gambar untuk Vision:', e);
                        responseText = `${ui.emojis?.error || '\u274c'} Aduh, Naura gagal melihat gambarnya. Coba kirim ulang ya!`;
                    }
                }
            }
            // ==========================================
            // LOGIKA 2: JIKA MURNI TEKS -> PAKAI GROQ API
            // ==========================================
            else {
                let systemPrompt = this._defaultSystemInstruction;
                let roleInfo = 'Member Biasa';
                if (isOwner) {
                    roleInfo = 'Owner/Developer';
                } else if (isPremium) {
                    roleInfo = 'Premium Member';
                }
                
                systemPrompt += `\nSaat ini kamu sedang berbicara dengan: ${message.author.username} (Role: ${roleInfo}).`;

                try {
                    // Ambil memori Groq jika ada
                    let groqSession = await this.getMemory(userId, 'groq') || { history: [] };
                    
                    const apiMessages = [
                        { role: 'system', content: systemPrompt },
                        ...groqSession.history,
                        { role: 'user', content: prompt }
                    ];

                    const response = await fetch(GROQ_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${env.GROQ_API_KEY || env.VERBA_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'llama3-8b-8192',
                            messages: apiMessages,
                            max_tokens: 1500
                        })
                    });

                    const textResponse = await response.text();
                    if (!response.ok) {
                        let errorMessage = `HTTP ${response.status}`;
                        try {
                            const errorData = JSON.parse(textResponse);
                            errorMessage = errorData.error?.message || errorData.message || errorMessage;
                        } catch (e) {
                            errorMessage = `${errorMessage} - Non-JSON response`;
                        }
                        throw new Error(`Groq API error: ${errorMessage}`);
                    }

                    let data;
                    try {
                        data = JSON.parse(textResponse);
                    } catch (err) {
                        throw new Error(`Invalid JSON response dari Groq API (HTTP ${response.status})`);
                    }

                    responseText = data.choices[0].message.content;

                    // Update memori Groq
                    groqSession.history.push({ role: 'user', content: prompt });
                    groqSession.history.push({ role: 'assistant', content: responseText });
                    if (groqSession.history.length > 10) groqSession.history = groqSession.history.slice(-10); // Keep last 10 messages
                    await this.saveMemory(userId, 'groq', groqSession);

                } catch (groqError) {
                    logger.error('[Groq Error] Fallback ke Gemini:', groqError);

                    // FALLBACK KE-2: Pakai Gemini
                    try {
                        const geminiClient = this.getGenAI();
                        if (!geminiClient) {
                            throw new Error('Gemini tidak dikonfigurasi (GEMINI_API_KEY kosong).');
                        }

                        const historyLimit = isPremium ? 40 : 10;
                        const roleInstruction = `Nama kamu adalah Naura Hoshino. Kamu diciptakan oleh Aryandita. Pengguna yang sedang berbicara denganmu memiliki peran: ${roleInfo}. Sesuaikan nada bicaramu dengan perannya (sangat hormat untuk Owner, ramah & elegan untuk Premium, dan santai untuk Member biasa). Gunakan bahasa Indonesia kasual.`;
                        let sessionData = await this.getMemory(userId, 'gemini') || { history: [], sysInstruction: roleInstruction };

                        // Prune history agar tidak overflow token
                        if (Array.isArray(sessionData.history) && sessionData.history.length > historyLimit) {
                            sessionData.history = sessionData.history.slice(sessionData.history.length - historyLimit);
                        }

                        sessionData.history.push({ role: 'user', parts: [{ text: prompt }] });

                        const { tools, dispatchFunction } = require('../../plugin/ai/functionDispatcher');
                        const gemConfig = { 
                            systemInstruction: sessionData.sysInstruction || this._defaultSystemInstruction, 
                            maxOutputTokens: 1500,
                            tools: [{ functionDeclarations: tools }]
                        };

                        let gemResult = await geminiClient.models.generateContent({
                            model: this._defaultModel,
                            contents: sessionData.history,
                            config: gemConfig
                        });

                        if (gemResult.functionCalls && gemResult.functionCalls.length > 0) {
                            for (const call of gemResult.functionCalls) {
                                const fnResult = await dispatchFunction(call.name, call.args, message);
                                sessionData.history.push({ role: 'model', parts: [{ functionCall: call }] });
                                sessionData.history.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: fnResult } }] });
                            }
                            gemResult = await geminiClient.models.generateContent({
                                model: this._defaultModel,
                                contents: sessionData.history,
                                config: gemConfig
                            });
                        }
                        responseText = gemResult.text;
                        sessionData.history.push({ role: 'model', parts: [{ text: responseText }] });
                        await this.saveMemory(userId, 'gemini', sessionData);
                    } catch (geminiError) {
                        // Rotasi API key jika kuota habis
                        if (geminiError.message && (geminiError.message.includes('429') || geminiError.message.includes('quota'))) {
                            this.rotateKey();
                        }

                        // FALLBACK KE-3: Pakai Ollama (Local)
                        logger.error('[Gemini Fallback Error] Beralih ke Ollama:', geminiError);
                        try {
                            const ollamaResponse = await this.getOllama().chat({
                                model: env.OLLAMA_MODEL,
                                messages: [{ role: 'user', content: prompt }],
                            });
                            responseText = ollamaResponse.message.content;
                        } catch (ollamaError) {
                            logger.error('[Ollama Error] Semua layanan AI gagal:', ollamaError);
                            responseText = `${ui.emojis?.error || '\u274c'} Semua layanan AI (Verba, Gemini, dan Ollama) sedang tidak tersedia. Coba lagi nanti ya!`;
                        }
                    }
                }
            }

            // ==========================================
            // LOGIKA 3: NAURA EXPRESSION (DYNAMIC MOODS)
            // ==========================================
            const nauraExpression = require('../utils/nauraExpression');
            const lowerText = responseText.toLowerCase();
            let mood = 'happy';
            if (lowerText.includes('maaf') || lowerText.includes('sedih') || lowerText.includes('hiks')) mood = 'sad';
            else if (lowerText.includes('marah') || lowerText.includes('kesal') || lowerText.includes('sebal')) mood = 'angry';
            else if (lowerText.includes('bingung') || lowerText.includes('tidak tahu') || lowerText.includes('hah?')) mood = 'confused';
            else if (lowerText.includes('selamat') || lowerText.includes('yeay') || lowerText.includes('hore')) mood = 'celebrate';
            else if (lowerText.includes('cinta') || lowerText.includes('sayang') || lowerText.includes('muah')) mood = 'love';
            else if (lowerText.includes('wow') || lowerText.includes('hebat') || lowerText.includes('keren')) mood = 'surprised';
            else if (lowerText.includes('tidur') || lowerText.includes('ngantuk') || lowerText.includes('hoam')) mood = 'sleepy';
            else if (lowerText.includes('makan') || lowerText.includes('lapar') || lowerText.includes('nyam')) mood = 'food';

            const faceEmoji = nauraExpression.getEmoji(mood);
            if (faceEmoji) {
                responseText = `${faceEmoji} ${responseText}`;
            }

            // ==========================================
            // PEMECAH PESAN (CHUNKING)
            // ==========================================
            const chunks = [];
            let currentChunk = '';
            const lines = responseText.split('\n');

            for (const line of lines) {
                if (currentChunk.length + line.length + 1 > CHUNK_LIMIT) {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                } else {
                    currentChunk += line + '\n';
                }
            }
            if (currentChunk.trim()) chunks.push(currentChunk);

            // Balas pesan user secara berurutan
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) {
                    await message.reply(chunks[i]);
                } else {
                    await message.channel.send(chunks[i]);
                }
            }
        } catch (error) {
            logger.error('\x1b[31m[AI ERROR]\x1b[0m Gagal merespons:', error);
            await message.reply(
                `${ui.emojis?.error || '\u274c'} Aduh, kepala Naura tiba-tiba pusing. Coba tanya lagi nanti ya!`
            );
        }
    }
}

module.exports = new AIManager();
