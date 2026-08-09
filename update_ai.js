const fs = require('fs');
let code = fs.readFileSync('src/managers/aiManager.js', 'utf8');

// 1. Add redisManager
code = code.replace("const env = require('../config/env');", "const env = require('../config/env');\nconst redisManager = require('./redisManager');");

// 2. Add getMemory, saveMemory and remove cleanupSessions
code = code.replace(/cleanupSessions\(\) \{[\s\S]*?async _processQueue\(\)/, `async getMemory(userId, type) {
        if (!redisManager.isReady) return null;
        const data = await redisManager.getCache(\`ai:\${type}:\${userId}\`);
        return data || null;
    }

    async saveMemory(userId, type, data) {
        if (!redisManager.isReady) return;
        await redisManager.setCache(\`ai:\${type}:\${userId}\`, data, SESSION_TTL_MS);
    }

    async _processQueue()`);

// 3. Remove this.geminiSessions and this.verbaSessions
code = code.replace(/this\.geminiSessions = new Map\(\);\s*this\.verbaSessions = new Map\(\);/, '');

// 4. Remove _cleanupTimer
code = code.replace(/this\._cleanupTimer = setInterval[\s\S]*?if \(this\._cleanupTimer\.unref\) this\._cleanupTimer\.unref\(\);/, '');

// 5. Replace Vision generation logic
code = code.replace(/if \(!this\.geminiSessions\.has\(userId\)\) \{[\s\S]*?responseText = result\.text;/, `let sessionData = await this.getMemory(userId, 'gemini') || { history: [] };

                const visionClient = this.getGenAI();

                if (!visionClient) {
                    responseText = \`\${ui.emojis?.error || '\u274c'} Naura belum bisa melihat gambar karena GEMINI_API_KEY belum diisi.\`;
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
                        responseText = result.text;`);

// 6. Replace Verba Session Load
code = code.replace(/if \(this\.verbaSessions\.has\(userId\)\) \{\s*requestBody\.session_id = this\.verbaSessions\.get\(userId\)\.sessionId;\s*\}/, `let verbaSession = await this.getMemory(userId, 'verba');
                    if (verbaSession && verbaSession.sessionId) {
                        requestBody.session_id = verbaSession.sessionId;
                    }`);

// 7. Replace Verba Session Save
code = code.replace(/if \(data\.session_id\) \{[\s\S]*?\} else if \(this\.verbaSessions\.has\(userId\)\) \{[\s\S]*?\}/, `if (data.session_id) {
                        await this.saveMemory(userId, 'verba', { sessionId: data.session_id });
                    }`);

// 8. Replace Gemini Fallback Generation Logic
code = code.replace(/if \(!this\.geminiSessions\.has\(userId\)\) \{[\s\S]*?sessionData\.history\.push\(\{ role: 'model', parts: \[\{ text: responseText \}\] \}\);/, `let sessionData = await this.getMemory(userId, 'gemini') || { history: [], sysInstruction: roleInstruction };

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
                        await this.saveMemory(userId, 'gemini', sessionData);`);

fs.writeFileSync('src/managers/aiManager.js', code);
console.log('Update success');
