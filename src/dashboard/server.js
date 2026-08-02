const express = require('express');
const { logger } = require('../../src/managers/logger');
const { getDbStatus } = require('../managers/dbManager');
const os = require('os');
const path = require('path');
const RateLimiter = require('../utils/rateLimiter');
const cors = require('cors');
const { EmbedBuilder } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const GuildSettings = require('../models/GuildSettings');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

module.exports = (client) => {


    // ==========================================
    // 1. SERVER WEBHOOK (PORT 3064)
    // ==========================================
    const webhookApp = express();
    webhookApp.use(express.json());
    webhookApp.use(express.urlencoded({ extended: true }));

    webhookApp.post('/api/webhook/vote', async (req, res) => {
        const auth = req.headers.authorization;
        if (process.env.WEBHOOK_AUTH_VOTE && auth !== process.env.WEBHOOK_AUTH_VOTE) return res.status(401).send('Unauthorized');
        const userId = req.body.user;
        if (!userId) return res.status(400).send('Missing user ID');

        try {
            const { sequelize } = require('../managers/dbManager');
            await sequelize.transaction(async (t) => {
                let [profile] = await UserProfile.findOrCreate({
                    where: { userId },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });

                const newExpiry = new Date();
                if (profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date()) {
                    newExpiry.setTime(profile.premiumUntil.getTime() + (12 * 60 * 60 * 1000));
                } else {
                    newExpiry.setTime(newExpiry.getTime() + (12 * 60 * 60 * 1000));
                }
                profile.isPremium = true;
                profile.premiumUntil = newExpiry;
                await profile.save({ transaction: t });

                try {
                    const userObj = await client.users.fetch(userId);
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('🎉 Terima Kasih Telah Memilih Naura!')
                        .setDescription(`Hai ${userObj.username}! Terima kasih atas VOTE kamu di server list hari ini.\n\nSebagai bentuk apresiasi, Naura telah memberikan fasilitas **TRIAL V.I.P PREMIUM selama 12 Jam** untukmu!\n\n⏳ **Status Aktif Sampai:** <t:${Math.floor(newExpiry.getTime() / 1000)}:R>`)
                        .setFooter({ text: 'Naura Hoshino Auto-Vote System' });
                    await userObj.send({ embeds: [embed] });
                } catch (e) {
                    logger.info(`[WEBHOOK VOTE] Gagal DM user ${userId}: DM Tertutup`);
                }
            });
            res.status(200).send('Vote recorded successfully');
        } catch (error) {
            logger.error('[WEBHOOK ERROR] Vote:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    webhookApp.post('/api/webhook/saweria', async (req, res) => {
        const token = req.headers['saweria-token'] || req.headers['authorization'];
        if (process.env.WEBHOOK_AUTH_SAWERIA && token !== process.env.WEBHOOK_AUTH_SAWERIA) return res.status(401).send('Unauthorized');

        const amount = req.body.amount || req.body.total_amount || 0;
        const message = req.body.message || '';
        const donator_name = req.body.donator_name || req.body.donator || 'Seseorang';
        if (!amount || !message) return res.status(400).send('Bad Request: Missing Amount or Message');

        const idMatch = message.match(/\b\d{17,19}\b/);
        if (!idMatch) return res.status(200).send('OK: No Discord ID found in message');

        const userId = idMatch[0];
        let daysToAdd = 0; let tierName = '';
        if (amount >= 75000) { daysToAdd = 365; tierName = '👑 Naura Bestie (1 Tahun)'; }
        else if (amount >= 50000) { daysToAdd = 180; tierName = '💫 Naura Friends (6 Bulan)'; }
        else if (amount >= 35000) { daysToAdd = 30; tierName = '🌟 Naura Supporter (1 Bulan)'; }
        else return res.status(200).send('OK: Amount below premium tier');

        try {
            const { sequelize } = require('../managers/dbManager');
            await sequelize.transaction(async (t) => {
                let [profile] = await UserProfile.findOrCreate({
                    where: { userId },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });

                const newExpiry = new Date();
                if (profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date()) {
                    newExpiry.setTime(profile.premiumUntil.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
                } else {
                    newExpiry.setTime(newExpiry.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
                }
                profile.isPremium = true;
                profile.premiumUntil = newExpiry;
                await profile.save({ transaction: t });

                try {
                    const userObj = await client.users.fetch(userId);
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('💖 Pembayaran V.I.P Terkonfirmasi!')
                        .setDescription(`Terima kasih **${donator_name}** atas dukungan donasinya (Rp ${amount.toLocaleString('id-ID')})!\n\nStatus **Premium Naura** kamu telah otomatis diaktifkan oleh sistem.\n\n📦 **Paket Aktif:** ${tierName}\n⏳ **Berlaku Sampai:** <t:${Math.floor(newExpiry.getTime() / 1000)}:F>`);
                    await userObj.send({ embeds: [embed] });
                } catch (e) {
                    logger.info(`[WEBHOOK SAWERIA] Gagal DM user ${userId}: DM Tertutup`);
                }
            });
            res.status(200).send('Donation Processed Successfully');
        } catch (error) {
            logger.error('[WEBHOOK ERROR] Saweria:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    webhookApp.post('/api/webhook/trakteer', async (req, res) => {
        const token = req.headers['x-trakteer-token'] || req.headers['authorization'];
        if (process.env.WEBHOOK_AUTH_TRAKTEER && token !== process.env.WEBHOOK_AUTH_TRAKTEER) return res.status(401).send('Unauthorized');

        const amount = req.body.amount || 0;
        const message = req.body.supporter_message || '';
        const donator_name = req.body.supporter_name || 'Seseorang';
        if (!amount || !message) return res.status(400).send('Bad Request: Missing Amount or Message');

        const idMatch = message.match(/\b\d{17,19}\b/);
        if (!idMatch) return res.status(200).send('OK: No Discord ID found in message');

        const userId = idMatch[0];
        let daysToAdd = 0; let tierName = '';
        if (amount >= 75000) { daysToAdd = 365; tierName = '👑 Naura Bestie (1 Tahun)'; }
        else if (amount >= 50000) { daysToAdd = 180; tierName = '💫 Naura Friends (6 Bulan)'; }
        else if (amount >= 35000) { daysToAdd = 30; tierName = '🌟 Naura Supporter (1 Bulan)'; }
        else return res.status(200).send('OK: Amount below premium tier');

        try {
            const { sequelize } = require('../managers/dbManager');
            await sequelize.transaction(async (t) => {
                let [profile] = await UserProfile.findOrCreate({
                    where: { userId },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });

                const newExpiry = new Date();
                if (profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date()) {
                    newExpiry.setTime(profile.premiumUntil.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
                } else {
                    newExpiry.setTime(newExpiry.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
                }
                profile.isPremium = true;
                profile.premiumUntil = newExpiry;
                await profile.save({ transaction: t });

                try {
                    const userObj = await client.users.fetch(userId);
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('💖 Pembayaran V.I.P Trakteer Terkonfirmasi!')
                        .setDescription(`Terima kasih **${donator_name}** atas dukungan Trakteer (Rp ${amount.toLocaleString('id-ID')})!\n\nStatus **Premium Naura** kamu telah otomatis diaktifkan oleh sistem.\n\n📦 **Paket Aktif:** ${tierName}\n⏳ **Berlaku Sampai:** <t:${Math.floor(newExpiry.getTime() / 1000)}:F>`);
                    await userObj.send({ embeds: [embed] });
                } catch (e) {
                    logger.info(`[WEBHOOK TRAKTEER] Gagal DM user ${userId}: DM Tertutup`);
                }
            });
            res.status(200).send('Trakteer Donation Processed Successfully');
        } catch (error) {
            logger.error('[WEBHOOK ERROR] Trakteer:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    const webhookPort = process.env.WEBHOOK_PORT || 3071;
    webhookApp.listen(webhookPort, () => {
        console.log(`\x1b[45m\x1b[37m 💸 WEBHOOK \x1b[0m \x1b[35mServer Webhook berjalan di Port: ${webhookPort}\x1b[0m`);
    });

    // ==========================================
    // 2. SERVER API & DATABASE (PORT 3053) - DINONAKTIFKAN
    // ==========================================
    /* Port 3053 dimatikan untuk menghindari masalah CORS/Firewall. 
       Endpoint digabung ke webApp (Port 3070) di bawah ini. */

    // ==========================================
    // 3. SERVER WEB MAIN UI (PORT 3070)
    // ==========================================
    // const helmet = require('helmet'); // Membutuhkan npm install helmet
    const webApp = express();
    // webApp.use(helmet()); // Anti XSS & Clickjacking (Disable jika menyebabkan issue rendering view)
    webApp.use(express.json());

    // ==========================================
    // POST /api/settings
    // ==========================================
    webApp.post('/api/settings', async (req, res) => {
        try {
            const { guildId, prefix, automod, twentyFourSeven, verbaSlug1, verbaSlug2, customPersona, serverKnowledge } = req.body;
            if (!guildId) return res.status(400).json({ success: false, message: 'Guild ID is required' });

            const GuildSettings = require('../models/GuildSettings');
            let [settingsModel] = await GuildSettings.findOrCreate({ where: { guildId } });

            let settings = settingsModel.settings || {};

            if (prefix !== undefined) settings.prefix = prefix;
            if (automod !== undefined) settings.automod = (automod === 'true' || automod === true);
            if (twentyFourSeven !== undefined) settings.twentyFourSeven = (twentyFourSeven === 'true' || twentyFourSeven === true);

            if (!settings.ai) settings.ai = {};
            if (verbaSlug1 !== undefined) settings.ai.verbaSlug1 = verbaSlug1;
            if (verbaSlug2 !== undefined) settings.ai.verbaSlug2 = verbaSlug2;
            if (customPersona !== undefined) settings.ai.customPersona = customPersona;
            if (serverKnowledge !== undefined) settings.ai.serverKnowledge = serverKnowledge;

            settingsModel.settings = settings;
            settingsModel.changed('settings', true);
            await settingsModel.save();

            res.json({ success: true, message: 'Pengaturan berhasil disimpan!' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    });

    // ==========================================
    // GET /api/welcomer
    // ==========================================
    webApp.get('/api/welcomer', async (req, res) => {
        try {
            const { guildId } = req.query;
            if (!guildId) return res.status(400).json({ error: 'Guild ID is required' });

            const GuildSettings = require('../models/GuildSettings');
            let [settingsModel] = await GuildSettings.findOrCreate({ where: { guildId } });

            let currentSettings = settingsModel.settings || {};
            if (!currentSettings.greetings) currentSettings.greetings = {};
            const g = currentSettings.greetings;
            if (!g.welcome) {
                const ui = require('../config/ui');
                g.welcome = { enabled: false, channelId: null, message: null, image: true, background: null, color: ui.getColor('welcome') };
            }

            // Merge default coordinates visual positions
            const welcomeData = {
                enabled: false,
                channelId: null,
                message: null,
                image: true,
                background: null,
                color: require('../config/ui').getColor('welcome'),
                avatarX: 180,
                avatarY: 165,
                avatarSize: 110,
                titleX: 370,
                titleY: 105,
                titleSize: 26,
                titleText: 'WELCOME TO SERVER',
                nameX: 370,
                nameY: 170,
                nameSize: 55,
                subtitleX: 370,
                subtitleY: 220,
                subtitleSize: 22,
                glowColor: '#00FFFF',
                ...g.welcome
            };

            res.json(welcomeData);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ==========================================
    // POST /api/welcomer
    // ==========================================
    webApp.post('/api/welcomer', async (req, res) => {
        try {
            const { guildId, enabled, channelId, backgroundUrl, message,
                    avatarX, avatarY, avatarSize,
                    titleX, titleY, titleSize, titleText,
                    nameX, nameY, nameSize,
                    subtitleX, subtitleY, subtitleSize,
                    glowColor } = req.body;
            if (!guildId) return res.status(400).json({ success: false, message: 'Guild ID is required' });

            const GuildSettings = require('../models/GuildSettings');
            let [settingsModel] = await GuildSettings.findOrCreate({ where: { guildId } });

            let currentSettings = settingsModel.settings || {};
            if (!currentSettings.greetings) currentSettings.greetings = {};
            if (!currentSettings.greetings.welcome) {
                const ui = require('../config/ui');
                currentSettings.greetings.welcome = { enabled: false, channelId: null, message: null, image: true, background: null, color: ui.getColor('welcome') };
            }

            currentSettings.greetings.welcome.enabled = (enabled === 'true' || enabled === true);
            currentSettings.greetings.welcome.channelId = channelId || null;
            currentSettings.greetings.welcome.background = backgroundUrl || null;
            currentSettings.greetings.welcome.message = message || null;

            // Save layout positions and custom styling configurations
            currentSettings.greetings.welcome.avatarX = avatarX !== undefined ? Number(avatarX) : 180;
            currentSettings.greetings.welcome.avatarY = avatarY !== undefined ? Number(avatarY) : 165;
            currentSettings.greetings.welcome.avatarSize = avatarSize !== undefined ? Number(avatarSize) : 110;
            currentSettings.greetings.welcome.titleX = titleX !== undefined ? Number(titleX) : 370;
            currentSettings.greetings.welcome.titleY = titleY !== undefined ? Number(titleY) : 105;
            currentSettings.greetings.welcome.titleSize = titleSize !== undefined ? Number(titleSize) : 26;
            currentSettings.greetings.welcome.titleText = titleText || 'WELCOME TO SERVER';
            currentSettings.greetings.welcome.nameX = nameX !== undefined ? Number(nameX) : 370;
            currentSettings.greetings.welcome.nameY = nameY !== undefined ? Number(nameY) : 170;
            currentSettings.greetings.welcome.nameSize = nameSize !== undefined ? Number(nameSize) : 55;
            currentSettings.greetings.welcome.subtitleX = subtitleX !== undefined ? Number(subtitleX) : 370;
            currentSettings.greetings.welcome.subtitleY = subtitleY !== undefined ? Number(subtitleY) : 220;
            currentSettings.greetings.welcome.subtitleSize = subtitleSize !== undefined ? Number(subtitleSize) : 22;
            currentSettings.greetings.welcome.glowColor = glowColor || '#00FFFF';

            settingsModel.settings = currentSettings;
            settingsModel.changed('settings', true);
            await settingsModel.save();

            res.json({ success: true, message: 'Pengaturan Welcomer berhasil disimpan!' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    });

    webApp.post('/api/inventory/action', async (req, res) => {
        try {
            const { userId, itemId, itemIdx, action } = req.body;
            if (!userId || !itemId || itemIdx === undefined || !action) {
                return res.status(400).json({ success: false, error: 'Missing parameters' });
            }

            const UserProfile = require('../models/UserProfile');
            const GameItem = require('../models/GameItem');

            const profile = await UserProfile.findByPk(userId);
            if (!profile) return res.status(404).json({ success: false, error: 'User profile not found' });

            let inv = profile.inventory || [];
            if (itemIdx < 0 || itemIdx >= inv.length) {
                return res.status(400).json({ success: false, error: 'Invalid item index' });
            }

            const item = inv[itemIdx];
            if (item.id !== itemId) {
                return res.status(400).json({ success: false, error: 'Item mismatch' });
            }

            let message = '';
            if (action === 'sell') {
                const itemDb = await GameItem.findByPk(itemId);
                const sellPrice = itemDb ? itemDb.sellPrice : 50;

                profile.economy_wallet = (profile.economy_wallet || 0) + sellPrice;
                message = `Berhasil menjual 1x **${item.name || itemId}** seharga 🪙 **${sellPrice.toLocaleString()} Coin**!`;
            } else if (action === 'trash') {
                message = `Berhasil membuang 1x **${item.name || itemId}** dari inventory.`;
            } else {
                return res.status(400).json({ success: false, error: 'Invalid action' });
            }

            // Decrement amount
            if (item.amount > 1) {
                item.amount -= 1;
            } else {
                inv.splice(itemIdx, 1);
            }

            profile.inventory = inv;
            profile.changed('inventory', true);
            await profile.save();

            res.json({ success: true, message });
        } catch (e) {
            console.error('\x1b[41m\x1b[37m 💥 API INVENTORY \x1b[0m \x1b[31mError:', e, '\x1b[0m');
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    });

    webApp.post('/api/inventory/forge', async (req, res) => {
        try {
            const { userId, itemId } = req.body;
            if (!userId || !itemId) {
                return res.status(400).json({ success: false, error: 'Missing parameters' });
            }

            const UserProfile = require('../models/UserProfile');
            const GameItem = require('../models/GameItem');

            const profile = await UserProfile.findByPk(userId);
            if (!profile) return res.status(404).json({ success: false, error: 'User profile not found' });

            let inv = profile.inventory || [];
            
            // Find all matching items of this ID
            const matchingIndices = [];
            inv.forEach((item, idx) => {
                const id = item.id || item;
                if (id === itemId) {
                    matchingIndices.push(idx);
                }
            });

            // Count total amount of this item
            let totalAmount = 0;
            matchingIndices.forEach(idx => {
                totalAmount += (inv[idx].amount || 1);
            });

            if (totalAmount < 2) {
                return res.status(400).json({ success: false, error: 'Kamu membutuhkan minimal 2x item ini untuk melakukan fusi!' });
            }

            // Consume 2 of the item
            let amountToDeduct = 2;
            for (let i = inv.length - 1; i >= 0; i--) {
                const item = inv[i];
                const id = item.id || item;
                if (id === itemId) {
                    const amt = item.amount || 1;
                    if (amt >= amountToDeduct) {
                        if (amt === amountToDeduct) {
                            inv.splice(i, 1);
                        } else {
                            item.amount -= amountToDeduct;
                        }
                        amountToDeduct = 0;
                        break;
                    } else {
                        amountToDeduct -= amt;
                        inv.splice(i, 1);
                    }
                }
            }

            // Decide success or failure (70% success rate)
            const isSuccess = Math.random() < 0.7;
            let message = '';
            let forgedItemName = itemId;

            if (isSuccess) {
                // Determine upgrade path
                let newId = null;
                if (itemId === 'wood') newId = 'fiber';
                else if (itemId === 'stone') newId = 'iron_ore';
                else if (itemId === 'iron_ore') newId = 'silver_ore';
                else if (itemId === 'silver_ore') newId = 'mythril_ore';
                else if (itemId === 'mythril_ore') newId = 'naura_shard';
                else if (itemId === 'diamond') newId = 'naura_shard';

                if (newId) {
                    const nextItemDb = await GameItem.findByPk(newId);
                    const name = nextItemDb ? nextItemDb.name : newId;
                    forgedItemName = name;
                    
                    const existing = inv.find(item => (item.id || item) === newId);
                    if (existing) {
                        existing.amount = (existing.amount || 1) + 1;
                    } else {
                        inv.push({ id: newId, name: name, amount: 1 });
                    }
                    message = `💥 **Fusi Berhasil!** Kamu mendapatkan 1x **${name}**!`;
                } else {
                    const itemDb = await GameItem.findByPk(itemId);
                    let name = itemDb ? itemDb.name : itemId;
                    
                    let levelMatch = name.match(/\(Lv\.\s*(\d+)\)/i);
                    let newName = name;
                    if (levelMatch) {
                        const currentLevel = parseInt(levelMatch[1]);
                        const nextLevel = currentLevel + 1;
                        newName = name.replace(/\(Lv\.\s*\d+\)/i, `(Lv. ${nextLevel})`);
                    } else {
                        newName = `${name} (Lv. 2)`;
                    }
                    
                    forgedItemName = newName;
                    inv.push({ id: itemId, name: newName, amount: 1 });
                    message = `💥 **Upgrade Berhasil!** Item kamu naik tingkat menjadi **${newName}**!`;
                }
            } else {
                // Failure: 1 item is lost, 1 remains (we already deducted 2, so we add 1 back!)
                const existing = inv.find(item => (item.id || item) === itemId);
                if (existing) {
                    existing.amount = (existing.amount || 1) + 1;
                } else {
                    const itemDb = await GameItem.findByPk(itemId);
                    inv.push({ id: itemId, name: itemDb ? itemDb.name : itemId, amount: 1 });
                }
                message = `💨 **Fusi Gagal!** Salah satu bahan fusi hancur.`;
            }

            profile.inventory = inv;
            profile.changed('inventory', true);
            await profile.save();

            res.json({ success: true, upgraded: isSuccess, message, forgedItemName });
        } catch (e) {
            console.error('[API INVENTORY FORGE] Error:', e);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    });

    const webPort = parseInt(process.env.PORT || process.env.SERVER_PORT || process.env.DASHBOARD_PORT) || 3070;

    webApp.use(cors());
    webApp.use(express.json());
    webApp.use(express.urlencoded({ extended: true }));

    // 🔥 DAFTARKAN FOLDER PUBLIC DAN ASSETS
    webApp.use(express.static(path.join(__dirname, 'public')));
    webApp.use('/assets', express.static(path.join(__dirname, '../../assets')));


    const authMiddleware = (req, res, next) => {
        if (req.isAuthenticated()) return next();
        res.redirect('/auth/discord');
    };


    webApp.use(session({
        secret: process.env.SESSION_SECRET || 'naura_secret',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 1000 * 60 * 60 * 24 }
    }));
    webApp.use(passport.initialize());
    webApp.use(passport.session());
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));

    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        console.log('\x1b[43m\x1b[30m ⚠️ WARNING \x1b[0m \x1b[33mDISCORD_CLIENT_ID atau SECRET belum diatur di .env! Fitur Login Web UI dinonaktifkan.\x1b[0m');
    } else {
        passport.use(new DiscordStrategy({
            clientID: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            callbackURL: process.env.DISCORD_CALLBACK_URL,
            scope: ['identify', 'guilds']
        }, (accessToken, refreshToken, profile, done) => done(null, profile)));

        webApp.get('/auth/discord', passport.authenticate('discord'));
        webApp.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/'));
    }

    webApp.get('/auth/logout', (req, res) => {
        req.logout(() => res.redirect('/'));
    });

    webApp.get('/api/me', async (req, res) => {
        if (req.isAuthenticated()) {
            try {
                let [profile] = await UserProfile.findOrCreate({ where: { userId: req.user.id } });
                const UserSurvival = require('../models/UserSurvival');
                let [survival] = await UserSurvival.findOrCreate({ where: { userId: req.user.id } });
                const env = require('../config/env');
                const isOwner = env.OWNER_IDS.includes(req.user.id);
                res.json({ loggedIn: true, user: req.user, db: profile, survival: survival, isOwner: isOwner });
            } catch (err) {
                logger.error('Error fetching user DB for /api/me:', err);
                res.json({ loggedIn: true, user: req.user, db: null, survival: null });
            }
        } else {
            res.json({ loggedIn: false });
        }
    });

    // 👇 TAMBAHKAN ENDPOINT STATS DI SINI 👇
    webApp.get('/api/stats', async (req, res) => {
        const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const usedRam = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);

        let totalRegisteredUsers = 0;
        try {
            totalRegisteredUsers = await UserProfile.count();
        } catch (e) { }

        res.json({
            botName: client.user ? client.user.username : 'Naura Hoshino',
            avatar: client.user ? client.user.displayAvatarURL({ extension: 'png', size: 512 }) : '/assets/naura.png',
            servers: client.guilds.cache.size,
            users: totalRegisteredUsers || client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
            ping: client.ws.ping,
            uptime: formatUptime(client.uptime)
        });
    });

    webApp.get('/api/economy_stats', async (req, res) => {
        try {
            const redisManager = require('../managers/redisManager');
            let cached = null;
            if (redisManager.client && redisManager.client.isReady) {
                cached = await redisManager.getCache('economy_stats_global');
            }
            if (cached) return res.json(cached);

            const users = await UserProfile.findAll({ attributes: ['economy_wallet', 'economy_bank'] });
            let totalWallet = 0;
            let totalBank = 0;
            users.forEach(u => {
                totalWallet += (u.economy_wallet || 0);
                totalBank += (u.economy_bank || 0);
            });
            const stats = {
                total_circulation: totalWallet + totalBank,
                total_wallet: totalWallet,
                total_bank: totalBank,
                total_users: users.length
            };
            if (redisManager.client && redisManager.client.isReady) {
                await redisManager.setCache('economy_stats_global', stats, 300); // 5 menit
            }
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: 'Gagal memuat statistik ekonomi' });
        }
    });
    webApp.get('/api/rpg/items', (req, res) => {
        try {
            const items = require('../../plugin/survival/items');
            res.json(items);
        } catch (e) {
            console.error('[API RPG ITEMS] Error:', e);
            res.status(500).json({ error: 'Gagal memuat daftar item' });
        }
    });

    webApp.post('/api/minecraft/chat', async (req, res) => {
        try {
            const { guildId, username, message } = req.body;
            if (!guildId || !username || !message) {
                return res.status(400).json({ error: 'Missing parameters' });
            }

            const GuildSettings = require('../models/GuildSettings');
            const settings = await GuildSettings.findOne({ where: { guildId } });
            if (!settings || !settings.settings || !settings.settings.minecraft) {
                return res.status(404).json({ error: 'Minecraft settings not found for this guild' });
            }

            const mc = settings.settings.minecraft;
            if (!mc.bridgeEnabled || !mc.bridgeChannelId) {
                return res.status(400).json({ error: 'Bridge is disabled or not configured' });
            }

            const channel = await client.channels.fetch(mc.bridgeChannelId).catch(() => null);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setAuthor({ 
                        name: `${username}`, 
                        iconURL: `https://crafatar.com/avatars/${username}?overlay=true` 
                    })
                    .setDescription(message)
                    .setFooter({ text: 'Naura Minecraft Bridge', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
            res.json({ success: true });
        } catch (error) {
            console.error('[MINECRAFT BRIDGE API] Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // 👆 ENDPOINT SELESAI DITAMBAHKAN 👆

    webApp.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
    webApp.get('/leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'views', 'leaderboard.html')));
    webApp.get('/settings', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'views', 'settings.html')));
    webApp.get('/welcomer', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'views', 'welcomer.html')));

    webApp.get('/api/leaderboard', async (req, res) => {
        try {
            const { type = 'wealth', limit = 20 } = req.query;
            const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

            const UserSurvival = require('../models/UserSurvival');
            const { sequelize } = require('../managers/dbManager');

            let orderExpr;
            if (type === 'chat_level') {
                orderExpr = [['leveling_level', 'DESC'], ['leveling_xp', 'DESC']];
            } else if (type === 'rpg_level') {
                orderExpr = [['userId', 'ASC']];
            } else if (type === 'trivia') {
                orderExpr = [['minigame_triviaScore', 'DESC']];
            } else if (type === 'music') {
                orderExpr = [['music_tracksListened', 'DESC']];
            } else {
                orderExpr = [
                    [sequelize.literal('(COALESCE(economy_wallet, 0) + COALESCE(economy_bank, 0))'), 'DESC']
                ];
            }

            let topProfiles = await UserProfile.findAll({
                attributes: [
                    'userId', 'economy_wallet', 'economy_bank',
                    'leveling_level', 'leveling_xp',
                    'minigame_triviaScore', 'music_tracksListened', 'isPremium'
                ],
                order: orderExpr,
                limit: limitNum
            });

            const userIds = topProfiles.map(p => p.userId);
            const survivalMap = {};
            if (userIds.length > 0) {
                const survs = await UserSurvival.findAll({ where: { userId: userIds } });
                survs.forEach(s => { survivalMap[s.userId] = s; });
            }

            if (type === 'rpg_level') {
                topProfiles.sort((a, b) => {
                    const lvlA = survivalMap[a.userId]?.survival_level || 1;
                    const lvlB = survivalMap[b.userId]?.survival_level || 1;
                    return lvlB - lvlA;
                });
            }

            const env = require('../config/env');

            const lbData = await Promise.all(topProfiles.map(async (u) => {
                let name = 'Unknown User';
                let avatar = '/assets/dashboard/naura.png';
                try {
                    const dUser = await client.users.fetch(u.userId);
                    name = dUser.username;
                    avatar = dUser.displayAvatarURL({ extension: 'png', size: 128 });
                } catch (e) { }

                const isOwner = env.OWNER_IDS.includes(u.userId);
                const surv = survivalMap[u.userId];

                const wallet = u.economy_wallet || 0;
                const bank = u.economy_bank || 0;
                const netWorth = wallet + bank;

                return {
                    userId: u.userId,
                    name: name,
                    avatar: avatar,
                    wallet: wallet,
                    bank: bank,
                    netWorth: netWorth,
                    starFragments: surv?.starFragments || 0,
                    chatLevel: u.leveling_level || 1,
                    chatXp: u.leveling_xp || 0,
                    rpgLevel: surv?.survival_level || 1,
                    rpgXp: surv?.survival_xp || 0,
                    points: u.minigame_triviaScore || 0,
                    tracks: u.music_tracksListened || 0,
                    isPremium: !!u.isPremium,
                    isOwner: isOwner
                };
            }));

            res.json(lbData);
        } catch (error) {
            logger.error('Leaderboard error:', error);
            res.status(500).json({ error: 'Gagal memuat leaderboard' });
        }
    });

    // ==========================================
    // 👑 OWNER ONLY API (GOD MODE)
    // ==========================================
    const checkOwner = (req, res, next) => {
        if (!req.isAuthenticated()) return res.status(401).json({ error: 'Belum login' });
        const ownerIdStr = process.env.OWNER_ID || '';
        const ownerIdsStr = process.env.OWNER_IDS || '';
        const isOwner = req.user.id === ownerIdStr || ownerIdsStr.includes(req.user.id);
        if (!isOwner) return res.status(403).json({ error: 'Akses ditolak. Area ini khusus Owner.' });
        next();
    };

    webApp.post('/api/owner/update_user', checkOwner, async (req, res) => {
        const { targetId, wallet, bank, starFragments, isPremium } = req.body;
        try {
            let [user] = await UserProfile.findOrCreate({ where: { userId: targetId } });
            user.economy_wallet = wallet !== undefined ? wallet : user.economy_wallet;
            user.economy_bank = bank !== undefined ? bank : user.economy_bank;
            if (isPremium !== undefined) {
                user.isPremium = isPremium;
                if (isPremium) {
                    const expiry = new Date();
                    expiry.setFullYear(expiry.getFullYear() + 100);
                    user.premiumUntil = expiry;
                } else {
                    user.premiumUntil = null;
                }
            }
            await user.save();

            if (starFragments !== undefined) {
                const UserSurvival = require('../models/UserSurvival');
                let [survival] = await UserSurvival.findOrCreate({ where: { userId: targetId } });
                survival.starFragments = starFragments;
                await survival.save();
            }

            res.json({ success: true, message: `Data ${targetId} berhasil dimanipulasi.` });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 💻 OWNER COMMAND: EVAL (Live JS Exec)
    webApp.post('/api/owner/eval', checkOwner, async (req, res) => {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code cannot be empty' });
        try {
            const util = require('util');
            let evaled = await eval(code);
            if (typeof evaled !== 'string') evaled = util.inspect(evaled, { depth: 0 });
            
            let sanitized = evaled;
            const secrets = [client.token, process.env.GEMINI_API_KEY, process.env.VERBA_API_KEY, process.env.DB_PASS].filter(Boolean);
            for (const secret of secrets) {
                const regex = new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                sanitized = sanitized.replace(regex, '[REDACTED]');
            }
            res.json({ success: true, output: sanitized });
            if (client.dashboardIo) client.dashboardIo.emit('system_broadcast', { message: '💻 Aryandita baru saja mengeksekusi sistem.' });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 🚧 OWNER COMMAND: MAINTENANCE
    webApp.post('/api/owner/maintenance', checkOwner, async (req, res) => {
        const { status } = req.body;
        client.maintenanceMode = !!status;
        if (status) {
            client.user.setPresence({ activities: [{ name: '🚧 Sedang Perbaikan Server' }], status: 'dnd' });
        } else {
            client.user.setPresence({ activities: [{ name: 'Melayani Aryandita ✨' }], status: 'online' });
        }
        res.json({ success: true, message: `Status Maintenance: ${status ? 'AKTIF 🚧' : 'MATI ✅'}` });
        if (client.dashboardIo) client.dashboardIo.emit('system_broadcast', { message: `🔧 Mode Maintenance ${status ? 'diaktifkan' : 'dinonaktifkan'}.` });
    });

    // 🔄 OWNER COMMAND: RELOAD COMMANDS
    webApp.post('/api/owner/reload', checkOwner, async (req, res) => {
        const { command: commandName } = req.body;
        if (!commandName) return res.status(400).json({ error: 'Command name is required' });
        const cmd = client.commands.get(commandName.toLowerCase());
        if (!cmd) return res.status(404).json({ error: `Command ${commandName} tidak ditemukan.` });

        try {
            const fs = require('fs');
            const path = require('path');
            const cmdsPath = path.join(__dirname, '../../plugin');
            
            let fileLocation = '';
            const folders = fs.readdirSync(cmdsPath);
            for (const folder of folders) {
                const folderPath = path.join(cmdsPath, folder);
                if (!fs.statSync(folderPath).isDirectory()) continue;
                
                const file = fs.readdirSync(folderPath).find(f => f === `${cmd.data?.name || cmd.name}.js` || f === `${commandName}.js`);
                if (file) {
                    fileLocation = path.join(folderPath, file);
                    break;
                }
            }

            if (!fileLocation) return res.status(404).json({ error: `Path direktori untuk ${commandName} tidak dapat dilacak.` });

            delete require.cache[require.resolve(fileLocation)];
            const newCommand = require(fileLocation);
            client.commands.set(newCommand.data ? newCommand.data.name : newCommand.name, newCommand);

            res.json({ success: true, message: `Command ${commandName} berhasil di-reload.` });
        } catch (error) {
            res.status(500).json({ error: `Gagal reload: ${error.message}` });
        }
    });

    // 👤 OWNER COMMAND: BOT PROFILE MANAGEMENT
    webApp.post('/api/owner/profile', checkOwner, async (req, res) => {
        const { type, value } = req.body;
        if (!value) return res.status(400).json({ error: 'Value is required' });
        try {
            if (type === 'username') {
                await client.user.setUsername(value);
                res.json({ success: true, message: 'Username bot berhasil diubah!' });
            } else if (type === 'avatar') {
                await client.user.setAvatar(value);
                res.json({ success: true, message: 'Avatar bot berhasil diubah!' });
            } else if (type === 'banner') {
                await client.user.setBanner(value);
                res.json({ success: true, message: 'Banner bot berhasil diubah!' });
            } else {
                res.status(400).json({ error: 'Invalid profile type' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // 🎮 OWNER COMMAND: PRESENCE/STATUS
    webApp.post('/api/owner/presence', checkOwner, async (req, res) => {
        const { type, text } = req.body;
        if (!type || !text) return res.status(400).json({ error: 'Type and text are required' });
        try {
            const { ActivityType } = require('discord.js');
            client.user.setActivity(text, { type: ActivityType[type] });
            res.json({ success: true, message: `Presence bot berhasil diubah menjadi: ${type} ${text}` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // 🧠 OWNER COMMAND: AI VOICE TOGGLE
    webApp.post('/api/owner/aivoice', checkOwner, async (req, res) => {
        const { guildId, status } = req.body;
        if (!guildId) return res.status(400).json({ error: 'Guild ID is required' });
        try {
            const GuildSettings = require('../models/GuildSettings');
            let [guildData] = await GuildSettings.findOrCreate({ where: { guildId } });
            guildData.aiVoiceEnabled = !!status;
            await guildData.save();
            res.json({ success: true, message: `AI Voice status untuk Server ${guildId} diubah menjadi: ${status ? 'AKTIF' : 'NON-AKTIF'}` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // 💰 OWNER COMMAND: ECO RESET
    webApp.post('/api/owner/eco_reset', checkOwner, async (req, res) => {
        const { targetId } = req.body;
        if (!targetId) return res.status(400).json({ error: 'Target User ID is required' });
        try {
            await UserProfile.destroy({ where: { userId: targetId } });
            res.json({ success: true, message: `Seluruh data finansial, XP, dan inventory milik user ${targetId} telah dihapus.` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // 🎂 OWNER COMMAND: RESET BIRTHDAY
    webApp.post('/api/owner/reset_bday', checkOwner, async (req, res) => {
        const { targetId } = req.body;
        if (!targetId) return res.status(400).json({ error: 'Target User ID is required' });
        try {
            let profile = await UserProfile.findByPk(targetId);
            if (!profile) return res.status(404).json({ error: 'User profile not found' });
            profile.birthday = null;
            await profile.save();
            res.json({ success: true, message: `Data ulang tahun user ${targetId} berhasil direset.` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ⚙️ OWNER COMMAND: BACKDOOR GUILD SETUP
    webApp.post('/api/owner/guild_setup', checkOwner, async (req, res) => {
        const { guildId, type, data } = req.body;
        if (!guildId || !type || !data) return res.status(400).json({ error: 'Missing parameters' });
        try {
            const GuildSettings = require('../models/GuildSettings');
            let [guildData] = await GuildSettings.findOrCreate({ where: { guildId } });
            let settings = guildData.settings || {};

            if (type === 'minecraft') {
                settings.minecraft = { ip: data.ip, port: parseInt(data.port) || 25565 };
            } else if (type === 'sticky') {
                settings.stickyMessage = { channelId: data.channelId, message: data.message };
            } else if (type === 'announcement') {
                settings.announcementChannel = data.channelId;
            } else if (type === 'autorole') {
                settings.autoRole = data.roleId;
            } else if (type === 'autoreply') {
                if (!settings.autoReplies) settings.autoReplies = [];
                const trigger = data.trigger.toLowerCase();
                const existingIndex = settings.autoReplies.findIndex(r => r.trigger === trigger);
                if (existingIndex !== -1) {
                    settings.autoReplies[existingIndex].response = data.response;
                } else {
                    settings.autoReplies.push({ trigger, response: data.response });
                }
            } else {
                return res.status(400).json({ error: 'Invalid setup type' });
            }

            guildData.settings = settings;
            guildData.changed('settings', true);
            await guildData.save();
            res.json({ success: true, message: `Guild setup [${type}] berhasil disimpan untuk Server ${guildId}.` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    webApp.get('/api/settings/load', async (req, res) => {
        try {
            const { guildId } = req.query;
            if (!guildId) return res.status(400).json({ error: 'Guild ID is required' });

            const GuildSettings = require('../models/GuildSettings');
            let [settingsModel] = await GuildSettings.findOrCreate({ where: { guildId } });

            const settings = settingsModel.settings || {};
            res.json({
                prefix: settings.prefix || '',
                verbaSlug1: settings.verbaSlug1 || '',
                verbaSlug2: settings.verbaSlug2 || '',
                customPersona: settings.customPersona || '',
                serverKnowledge: settings.serverKnowledge || '',
                automod: settings.automod === true || settings.automod === 'true',
                twentyFourSeven: settings.twentyFourSeven === true || settings.twentyFourSeven === 'true'
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    webApp.post('/api/settings/sandbox', async (req, res) => {
        try {
            const { message, customPersona, serverKnowledge } = req.body;
            if (!message) return res.status(400).json({ error: 'Message is required' });

            const systemPrompt = `Kamu adalah Naura Hoshino, asisten virtual server Discord.
Sifat/Persona Anda: ${customPersona || 'Ceria, membantu, dan menggunakan emotikon lucu.'}
Pengetahuan Server (FAQ): ${serverKnowledge || 'Tidak ada aturan khusus.'}

Responlah pesan user berikut dengan tetap mematuhi sifat dan pengetahuan di atas.`;

            const response = await fetch('https://api.verba.ink/v1/response', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${require('../config/env').VERBA_API_KEY}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                body: JSON.stringify({
                    character: require('../config/env').VERBA_CHARACTER_SLUG || "naura",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: message }
                    ]
                })
            }).catch(() => null);

            if (response && response.ok) {
                const data = await response.json();
                return res.json({ reply: data.choices[0].message.content });
            } else {
                let mockReply = `[Sandbox Demo Mode] Halo! Persona kamu sudah aktif. Kamu mengirim: "${message}". `;
                if (customPersona && customPersona.toLowerCase().includes('tsundere')) {
                    mockReply += `H-Hmph! Jangan kira aku menjawab ini karena aku suka ya! Baka! 🙄`;
                } else if (customPersona && customPersona.toLowerCase().includes('formal')) {
                    mockReply += `Baik, pesan Anda telah diterima. Ada hal lain yang bisa kami bantu?`;
                } else {
                    mockReply += `Naura siap membantu dengan sifat barumu! ✨`;
                }
                return res.json({ reply: mockReply });
            }
        } catch (e) {
            return res.json({ reply: `[Local Simulation] Hoshino siap! Pesan Anda: "${message}"` });
        }
    });



    webApp.get('/api/owner/stats', checkOwner, async (req, res) => {
        try {
            const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
            const usedRam = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);

            res.json({
                ram: `${usedRam}GB / ${totalRam}GB`,
                cpu: os.cpus()[0].model,
                os: os.type() + ' ' + os.release()
            });
        } catch (e) {
            res.status(500).json({ error: 'Failed to fetch owner stats' });
        }
    });

    webApp.post('/api/owner/announcement', checkOwner, async (req, res) => {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message cannot be empty.' });
        try {
            // Find one AI chat channel per guild
            let sentCount = 0;
            const settings = await GuildSettings.findAll();
            for (const setting of settings) {
                if (setting.settings && setting.settings.verbaSlug1) {
                    try {
                        const channel = await client.channels.fetch(setting.settings.verbaSlug1);
                        if (channel && channel.isTextBased()) {
                            await channel.send(`📢 **Naura Announcement**\n${message}`);
                            sentCount++;
                        }
                    } catch (err) {
                        // Ignore errors sending to specific channels
                    }
                }
            }
            res.json({ success: true, message: `Berhasil mengirim ke ${sentCount} server.` });
        } catch (e) {
            logger.error('Announcement error:', e);
            res.status(500).json({ error: 'Terjadi kesalahan sistem.' });
        }
    });

    webApp.post('/api/owner/restart', checkOwner, (req, res) => {
        res.json({ success: true, message: 'Sistem sedang dimatikan dan akan di-restart...' });
        setTimeout(() => { process.exit(0); }, 2000);
    });

    const http = require('http');
    const { Server } = require('socket.io');
    const webServer = http.createServer(webApp);
    const io = new Server(webServer, { cors: { origin: '*' } });

    // Simpan instance IO ke client agar bisa dipakai dari file luar (seperti naura.js)
    client.dashboardIo = io;
    global.client = client;

    // Broadcast Real-time Stats setiap 3 detik
    setInterval(() => {
        if (!client.isReady()) return;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const ping = client.ws.ping;
        const guilds = client.guilds.cache.size;
        const users = client.users.cache.size;

        const dbStatus = getDbStatus();
        io.emit('stats_update', {
            ramUsed: (usedMem / 1024 / 1024).toFixed(2),
            ramTotal: (totalMem / 1024 / 1024).toFixed(2),
            ping: ping,
            guilds: guilds,
            users: users,
            dbStatus: dbStatus
        });
    }, 3000);

    // Periodic check to emit active player states
    setInterval(() => {
        if (!client.isReady()) return;
        const players = client.musicManager?.poru?.players;
        if (players) {
            players.forEach((player) => {
                const guildId = player.guildId;
                const channel = client.channels.cache.get(player.voiceChannel);
                const members = channel ? channel.members.map(m => ({
                    id: m.id,
                    username: m.user.username,
                    avatar: m.user.displayAvatarURL({ extension: 'png', size: 64 })
                })) : [];

                const queue = player.queue.map(track => ({
                    title: track.info.title,
                    uri: track.info.uri,
                    duration: track.info.length,
                    requester: track.info.requester?.username || 'Unknown'
                }));

                const currentTrack = player.currentTrack ? {
                    title: player.currentTrack.info.title,
                    uri: player.currentTrack.info.uri,
                    duration: player.currentTrack.info.length,
                    position: player.position,
                    isPlaying: player.isPlaying,
                    isPaused: player.isPaused
                } : null;

                io.to(guildId).emit('music_state', {
                    currentTrack,
                    queue,
                    members
                });
            });
        }
    }, 2000);

    io.on('connection', (socket) => {
        logger.info(`[SOCKET] User connected to Dashboard: ${socket.id}`);

        socket.on('join_guild_music', (guildId) => {
            socket.join(guildId);
            const player = client.musicManager?.poru?.players.get(guildId);
            if (player) {
                const channel = client.channels.cache.get(player.voiceChannel);
                const members = channel ? channel.members.map(m => ({
                    id: m.id,
                    username: m.user.username,
                    avatar: m.user.displayAvatarURL({ extension: 'png', size: 64 })
                })) : [];

                const queue = player.queue.map(track => ({
                    title: track.info.title,
                    uri: track.info.uri,
                    duration: track.info.length,
                    requester: track.info.requester?.username || 'Unknown'
                }));

                const currentTrack = player.currentTrack ? {
                    title: player.currentTrack.info.title,
                    uri: player.currentTrack.info.uri,
                    duration: player.currentTrack.info.length,
                    position: player.position,
                    isPlaying: player.isPlaying,
                    isPaused: player.isPaused
                } : null;

                socket.emit('music_state', {
                    currentTrack,
                    queue,
                    members
                });
            }
        });

        socket.on('music_control', async (data) => {
            const { guildId, action, value } = data;
            const player = client.musicManager?.poru?.players.get(guildId);
            if (!player) return;

            if (action === 'pause') {
                player.pause(true);
            } else if (action === 'resume') {
                player.pause(false);
            } else if (action === 'skip') {
                player.stop();
            } else if (action === 'reorder') {
                const newQueue = [];
                value.forEach(oldIdx => {
                    if (player.queue[oldIdx]) {
                        newQueue.push(player.queue[oldIdx]);
                    }
                });
                player.queue = newQueue;
            } else if (action === 'volume') {
                player.setVolume(Number(value));
            }
            
            const channel = client.channels.cache.get(player.voiceChannel);
            const members = channel ? channel.members.map(m => ({
                id: m.id,
                username: m.user.username,
                avatar: m.user.displayAvatarURL({ extension: 'png', size: 64 })
            })) : [];

            const queue = player.queue.map(track => ({
                title: track.info.title,
                uri: track.info.uri,
                duration: track.info.length,
                requester: track.info.requester?.username || 'Unknown'
            }));

            const currentTrack = player.currentTrack ? {
                title: player.currentTrack.info.title,
                uri: player.currentTrack.info.uri,
                duration: player.currentTrack.info.length,
                position: player.position,
                isPlaying: player.isPlaying,
                isPaused: player.isPaused
            } : null;

            io.to(guildId).emit('music_state', {
                currentTrack,
                queue,
                members
            });
        });

        socket.on('chat_message', async (data) => {
            const isLimited = await RateLimiter.isRateLimited(socket.id, 'dashboard_chat', 5, 10);
            if (isLimited) return socket.emit('chat_response', { reply: 'Tolong jangan spam ya! Tunggu beberapa detik.' });

            try {
                const response = await fetch('https://api.verba.ink/v1/response', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${require('../config/env').VERBA_API_KEY}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    body: JSON.stringify({
                        character: require('../config/env').VERBA_CHARACTER_SLUG || "naura",
                        messages: [
                            { role: "user", content: data.message }
                        ]
                    })
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

                let result;
                try {
                    result = JSON.parse(rawText);
                } catch (parseError) {
                    throw new Error(`Invalid JSON response dari Verba API (HTTP ${response.status})`);
                }
                socket.emit('chat_response', { reply: result.choices[0].message.content });
            } catch (error) {
                logger.warn(`[SOCKET CHAT] Verba API gagal (${error.message}). Beralih ke AI Fallback (Gemini/Ollama)...`);
                
                // Fallback 1: Gemini
                try {
                    const { GoogleGenerativeAI } = require('@google/generative-ai');
                    const genAI = new GoogleGenerativeAI(require('../config/env').GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const chat = model.startChat();
                    const result = await chat.sendMessage(data.message);
                    return socket.emit('chat_response', { reply: result.response.text() });
                } catch (geminiError) {
                    // Fallback 2: Ollama
                    try {
                        const { Ollama } = require('ollama');
                        const env = require('../config/env');
                        const ollamaClient = new Ollama({ host: env.OLLAMA_BASE_URL });
                        const ollamaResponse = await ollamaClient.chat({
                            model: env.OLLAMA_MODEL,
                            messages: [{ role: 'user', content: data.message }],
                        });
                        return socket.emit('chat_response', { reply: ollamaResponse.message.content });
                    } catch (ollamaError) {
                        return socket.emit('chat_response', { reply: 'Maaf, sistem AI Naura (Verba, Gemini, Ollama) sedang gangguan saat ini.' });
                    }
                }
            }
        });

        socket.on('disconnect', () => {
            // User disconnected
        });
    });

    webServer.listen(webPort, () => {
        console.log(`\x1b[44m\x1b[37m 🌐 WEB MAIN \x1b[0m \x1b[34mWeb UI berjalan di http://localhost:${webPort}\x1b[0m`);
    });
};

function formatUptime(ms) {
    if (ms < 60000) return 'Baru saja mulai';
    let totalSeconds = (ms / 1000);
    let days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    let hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    let minutes = Math.floor(totalSeconds / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}