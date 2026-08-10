'use strict';

/**
 * Titik masuk Dashboard Naura.
 *
 * Berkas ini dulu berisi 64 KB kode: webhook, seluruh endpoint API, seluruh
 * handler socket, dan penyiapan Express dalam satu tumpukan. Sekarang isinya
 * hanya perakitan; logikanya tinggal di:
 *
 *   middleware/auth.js   - penjaga login, owner, dan izin Kelola Server
 *   utils/format.js      - pembantu format uptime & memori
 *   utils/httpGuard.js   - token konstan-waktu, pembatas laju, penanda sekali-pakai
 *   routes/webhooks.js   - server webhook vote / Saweria / Trakteer
 *   routes/public.js     - statistik, ekonomi, item, leaderboard
 *   routes/user.js       - sesi, bahasa, profil, inventory
 *   routes/guild.js      - pengaturan server, welcomer, jembatan Minecraft
 *   routes/owner.js      - God Mode
 *   sockets/index.js     - siaran realtime & kendali musik
 *
 * Satu perbaikan penting ikut dibawa: dulu beberapa endpoint API didaftarkan
 * SEBELUM middleware session/passport dipasang, sehingga `req.isAuthenticated`
 * belum ada di sana dan pemeriksaan hak akses mustahil dilakukan. Urutan di
 * bawah ini menempatkan sesi lebih dulu, baru seluruh rute.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { Server } = require('socket.io');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { logger } = require('../managers/logger');
const { requireLogin, requireApiLogin } = require('./middleware/auth');
const { createRateLimiter } = require('./utils/httpGuard');

/** Daftar origin yang boleh memanggil dashboard dari domain lain. */
function parseOrigins() {
    return String(process.env.DASHBOARD_ORIGIN || '')
        .split(/[\s,]+/)
        .filter(Boolean);
}

module.exports = (client) => {
    // ==================================================================
    // 1. Server webhook (port terpisah)
    // ==================================================================
    require('./routes/webhooks')(client);

    const isProduction = process.env.NODE_ENV === 'production';

    // ==================================================================
    // 2. Prasyarat keamanan
    // ==================================================================
    //
    // Kunci sesi menentukan siapa yang dipercaya sebagai Owner. Bila nilainya
    // adalah string tetap yang tertulis di dalam repo, siapa pun yang membaca
    // kode ini bisa menandatangani cookie sesinya sendiri, mengaku sebagai
    // Owner, dan membuka seluruh God Mode di /api/owner. Di produksi, itu bukan
    // peringatan; itu alasan untuk tidak menyalakan dashboard sama sekali.
    if (!process.env.SESSION_SECRET) {
        if (isProduction) {
            logger.error(
                '[DASHBOARD] SESSION_SECRET belum diatur. Dashboard TIDAK dinyalakan ' +
                'karena sesi Owner bisa dipalsukan. Isi SESSION_SECRET di .env lalu jalankan ulang.'
            );
            return { webApp: null, webServer: null, io: null };
        }
        logger.warn(
            '[DASHBOARD] SESSION_SECRET belum diatur. Memakai kunci acak sementara ' +
            '(sesi akan hilang setiap restart). Wajib diisi sebelum produksi.'
        );
    }

    // Kunci acak per proses jauh lebih baik daripada nilai tetap yang bisa ditebak.
    const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

    // ==================================================================
    // 3. Server web utama
    // ==================================================================
    const webApp = express();
    const webPort =
        parseInt(process.env.PORT || process.env.SERVER_PORT || process.env.DASHBOARD_PORT, 10) || 3070;

    if (isProduction) webApp.set('trust proxy', 1);

    // --- Header keamanan dasar ---
    // Menggunakan helmet untuk keamanan standar. Content-Security-Policy dimatikan 
    // karena halaman views masih memakai skrip inline.
    webApp.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));

    // --- CORS ---
    // `cors()` tanpa argumen memantulkan origin mana pun. Sekarang hanya domain
    // yang kamu daftarkan di DASHBOARD_ORIGIN yang diizinkan. Permintaan tanpa
    // header Origin (akses langsung dari browser, curl, health check) tetap
    // jalan, jadi dashboard yang dilayani dari domainnya sendiri tidak terganggu.
    const allowedOrigins = parseOrigins();
    if (isProduction && allowedOrigins.length === 0) {
        logger.warn('[DASHBOARD] DASHBOARD_ORIGIN kosong. Semua akses lintas domain ditolak.');
    }

    const originChecker = (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (!isProduction && allowedOrigins.length === 0) return callback(null, true);
        return callback(null, false);
    };

    webApp.use(cors({ origin: originChecker, credentials: true }));

    // --- Parser & aset statis ---
    // Batas ukuran badan permintaan menutup upaya menghabiskan memori proses.
    webApp.use(express.json({ limit: '256kb' }));
    webApp.use(express.urlencoded({ extended: true, limit: '256kb' }));
    webApp.use(express.static(path.join(__dirname, 'public')));
    webApp.use('/assets', express.static(path.join(__dirname, '../../assets')));

    // --- Sesi (harus lebih dulu dari seluruh rute) ---
    const sessionMiddleware = session({
        name: 'naura.sid',
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: isProduction,
            maxAge: 1000 * 60 * 60 * 24
        }
    });

    webApp.use(sessionMiddleware);
    webApp.use(passport.initialize());
    webApp.use(passport.session());
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));

    // --- Pembatas laju ---
    // Longgar untuk API biasa, ketat untuk pintu masuk dan God Mode.
    webApp.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
    webApp.use('/auth', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
    webApp.use('/api/owner', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));

    // --- Login Discord ---
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        logger.warn('[DASHBOARD] DISCORD_CLIENT_ID / SECRET belum diatur. Login Web UI dimatikan.');
    } else {
        passport.use(
            new DiscordStrategy(
                {
                    clientID: process.env.DISCORD_CLIENT_ID,
                    clientSecret: process.env.DISCORD_CLIENT_SECRET,
                    callbackURL: process.env.DISCORD_CALLBACK_URL,
                    scope: ['identify', 'guilds']
                },
                (accessToken, refreshToken, profile, done) => done(null, profile)
            )
        );

        webApp.get('/auth/discord', passport.authenticate('discord'));
        webApp.get(
            '/auth/discord/callback',
            passport.authenticate('discord', { failureRedirect: '/' }),
            (req, res) => res.redirect('/')
        );
    }

    webApp.get('/auth/logout', (req, res) => {
        // Sesi ikut dihancurkan, bukan hanya dilepas dari passport. Tanpa ini,
        // cookie lama masih menunjuk ke sesi yang hidup di penyimpanan.
        req.logout(() => {
            req.session?.destroy(() => {
                res.clearCookie('naura.sid');
                res.redirect('/');
            });
        });
    });

    // --- Rute API ---
    webApp.use(require('./routes/public')(client));
    webApp.use(require('./routes/user')(client));
    webApp.use(require('./routes/guild')(client));
    webApp.use(require('./routes/owner')(client));
    webApp.use(require('./routes/tickets')(client));
    webApp.use('/api', require('./routes/api')(client));

    // --- Uji coba persona AI dari halaman pengaturan ---
    webApp.post('/api/settings/sandbox', requireApiLogin, async (req, res) => {
        const { message, customPersona, serverKnowledge } = req.body || {};
        if (!message) return res.status(400).json({ error: 'Pesannya masih kosong.' });

        const env = require('../config/env');
        const systemPrompt =
            'Kamu adalah Naura Hoshino, asisten virtual server Discord.\n' +
            `Sifat/Persona kamu: ${customPersona || 'Ceria, perhatian, dan murah senyum.'}\n` +
            `Pengetahuan server (FAQ): ${serverKnowledge || 'Tidak ada aturan khusus.'}\n\n` +
            'Balas pesan pengguna berikut sambil tetap setia pada sifat dan pengetahuan di atas.';

        try {
            const response = await fetch('https://api.verba.ink/v1/response', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.VERBA_API_KEY}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                body: JSON.stringify({
                    character: env.VERBA_CHARACTER_SLUG || 'naura',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: String(message).slice(0, 2000) }
                    ]
                })
            }).catch(() => null);

            if (response && response.ok) {
                const data = await response.json();
                const reply =
                    data?.choices?.[0]?.message?.content || data?.message?.content || data?.content;
                if (reply) return res.json({ reply });
            }
        } catch (e) {
            logger.warn(`[SANDBOX] Verba gagal: ${e.message}`);
        }

        // Mode demo lokal bila Verba tidak tersedia.
        let reply = `[Mode Demo] Persona kamu sudah aktif kok! Kamu bilang: "${message}". `;
        const persona = String(customPersona || '').toLowerCase();
        if (persona.includes('tsundere')) {
            reply += 'H-hmph! Jangan salah paham ya, Naura jawab bukan karena senang!';
        } else if (persona.includes('formal')) {
            reply += 'Baik, pesan Anda sudah kami terima. Ada lagi yang bisa dibantu?';
        } else {
            reply += 'Naura siap menemani dengan sifat barunya!';
        }
        return res.json({ reply });
    });

    // --- Halaman ---
    const view = (name) => (req, res) => res.sendFile(path.join(__dirname, 'views', name));
    webApp.get('/', view('index.html'));
    webApp.get('/leaderboard', view('leaderboard.html'));
    webApp.get('/settings', requireLogin, view('settings.html'));
    webApp.get('/tickets', requireLogin, view('tickets.html'));
    webApp.get('/welcomer', requireLogin, view('welcomer.html'));
    webApp.get('/music', requireLogin, view('music.html'));
    webApp.get('/status', view('status.html'));

    // ==================================================================
    // 4. Realtime
    // ==================================================================
    const webServer = http.createServer(webApp);
    const io = new Server(webServer, {
        // `origin: '*'` bersama `credentials: true` adalah kombinasi yang ditolak
        // browser dan, kalau pun lolos, membuka sesi ke domain mana pun.
        cors: { origin: originChecker, credentials: true }
    });

    // Dipakai berkas lain (mis. plugin/core/naura.js) untuk menyiarkan kejadian.
    client.dashboardIo = io;
    global.client = client;

    require('./sockets')(client, io, { sessionMiddleware });

    webServer.listen(webPort, () => {
        logger.info(`[DASHBOARD] Web UI berjalan di http://localhost:${webPort}`);
    });

    return { webApp, webServer, io };
};
