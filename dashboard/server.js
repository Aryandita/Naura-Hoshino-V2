"use strict";

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

const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const { Server } = require("socket.io");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const env = require("../src/config/env");

const { logger } = require("../src/managers/logger");
const { requireLogin, requireApiLogin } = require("./middleware/auth");

/** Daftar origin yang boleh memanggil dashboard dari domain lain. */
function parseOrigins() {
  return String(env.DASHBOARD_ORIGIN || "")
    .split(/[\s,]+/)
    .filter(Boolean);
}

module.exports = (client) => {
  // ==================================================================
  // 1. Server webhook (bisa diakses via port webhook tersendiri maupun port web utama)
  // ==================================================================
  const webhookApp = require("./routes/webhooks")(client);

  const isProduction = env.NODE_ENV === "production";

  // ==================================================================
  // 2. Prasyarat keamanan
  // ==================================================================
  //
  // Kunci sesi menentukan siapa yang dipercaya sebagai Owner. Bila nilainya
  // adalah string tetap yang tertulis di dalam repo, siapa pun yang membaca
  // kode ini bisa menandatangani cookie sesinya sendiri, mengaku sebagai
  // Owner, dan membuka seluruh God Mode di /api/owner. Di produksi, itu bukan
  // peringatan; itu alasan untuk tidak menyalakan dashboard sama sekali.
  if (!env.SESSION_SECRET) {
    if (isProduction) {
      logger.error(
        "[DASHBOARD] SESSION_SECRET belum diatur. Dashboard TIDAK dinyalakan " +
          "karena sesi Owner bisa dipalsukan. Isi SESSION_SECRET di .env lalu jalankan ulang.",
      );
      return { webApp: null, webServer: null, io: null };
    }
    logger.warn(
      "[DASHBOARD] SESSION_SECRET belum diatur. Memakai kunci acak sementara " +
        "(sesi akan hilang setiap restart). Wajib diisi sebelum produksi.",
    );
  }

  // Kunci acak per proses jauh lebih baik daripada nilai tetap yang bisa ditebak.
  const sessionSecret =
    env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

  // ==================================================================
  // 3. Server web utama
  // ==================================================================
  const webApp = express();
  // Baca port dari env.DASHBOARD_PORT (didahulukan) → PORT (Pterodactyl) → fallback 3000
  // Ini menghormati konfigurasi panel Pterodactyl tanpa override manual.
  const webPort = env.DASHBOARD_PORT;

  // Percayai proxy reverse (Cloud Run, Nginx, Pterodactyl) untuk IP header X-Forwarded-For
  webApp.set("trust proxy", 1);

  // --- Header keamanan dasar ---
  // Menggunakan helmet untuk keamanan standar. Content-Security-Policy dimatikan
  // karena halaman views masih memakai skrip inline.
  webApp.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
    }),
  );

  // --- CORS ---
  // `cors()` tanpa argumen memantulkan origin mana pun. Sekarang hanya domain
  // yang kamu daftarkan di DASHBOARD_ORIGIN yang diizinkan. Permintaan tanpa
  // header Origin (akses langsung dari browser, curl, health check) tetap
  // jalan, jadi dashboard yang dilayani dari domainnya sendiri tidak terganggu.
  const allowedOrigins = parseOrigins();
  if (isProduction && allowedOrigins.length === 0) {
    logger.warn(
      "[DASHBOARD] DASHBOARD_ORIGIN kosong. Semua akses lintas domain ditolak.",
    );
  }

  const originChecker = (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!isProduction && allowedOrigins.length === 0)
      return callback(null, true);
    return callback(null, false);
  };

  webApp.use(cors({ origin: originChecker, credentials: true }));

  // --- Parser & aset statis ---
  // Batas ukuran badan permintaan menutup upaya menghabiskan memori proses.
  webApp.use(express.json({ limit: "256kb" }));
  webApp.use(express.urlencoded({ extended: true, limit: "256kb" }));
  // Static assets: Dashboard dist sebagai prioritas utama, didukung asset publik & bot.
  //
  // PENTING: `index: false` mencegah express.static menyajikan dist/index.html
  // untuk path "/". Sebelumnya file itu dilayani duluan, sebelum handler view()
  // sempat berjalan, sehingga perbandingan mtime di view() tidak pernah dipakai
  // dan halaman "/" selalu menyajikan build lama walau src/ sudah lebih baru.
  // Static assets: /src dipetakan duluan agar perubahan dev langsung aktif
  webApp.use("/src", express.static(path.join(__dirname, "src")));
  webApp.use(express.static(path.join(__dirname, "dist"), { index: false }));
  // Jangan sajikan berkas di folder /transcripts secara statis publik.
  // Transkrip memuat percakapan privat tiket dan WAJIB melewati router terproteksi di tickets.js.
  webApp.use((req, res, next) => {
    if (req.path.startsWith("/transcripts/")) {
      return next();
    }
    return express.static(path.join(__dirname, "public"))(req, res, next);
  });
  webApp.use("/assets", express.static(path.join(__dirname, "public/assets")));
  webApp.use("/assets", express.static(path.join(__dirname, "../assets")));
  // Helper logika murni dari bot yang juga dipakai halaman dashboard.
  // Dipetakan eksplisit karena /src di atas menunjuk ke dashboard/src,
  // sedangkan berkas ini lives di src/utils/ milik root repo.
  webApp.use(
    "/shared",
    express.static(path.join(__dirname, "../src/utils"), { index: false }),
  );
  webApp.use("/vendor", express.static(path.join(__dirname, "public/vendor")));
  webApp.use("/node_modules", express.static(path.join(__dirname, "../node_modules")));
  webApp.get("/health", (req, res) => res.redirect("/api/health"));

  // Sajikan Dashboard Mobile di subpath /mobile
  webApp.use("/mobile", express.static(path.join(__dirname, "mobile/dist")));
  webApp.get("/mobile", (req, res) => {
    const mobileIndex = path.join(__dirname, "mobile/dist/src/pages/index.html");
    if (fs.existsSync(mobileIndex)) {
      return res.sendFile(mobileIndex);
    }
    res.redirect("/");
  });
  webApp.get("/mobile/:page", (req, res) => {
    const page = req.params.page;
    if (!/^[a-zA-Z0-9_-]+$/.test(page)) {
      return res.redirect("/mobile");
    }
    const targetPage = path.join(
      __dirname,
      "mobile/dist/src/pages",
      `${page}.html`,
    );
    if (fs.existsSync(targetPage)) {
      return res.sendFile(targetPage);
    }
    const mobileIndex = path.join(__dirname, "mobile/dist/src/pages/index.html");
    if (fs.existsSync(mobileIndex)) {
      return res.sendFile(mobileIndex);
    }
    res.redirect("/mobile");
  });

  // Sajikan berkas model 3D (VRM & GLB) dengan Content-Type model/gltf-binary yang valid
  const setModelMime = (res, filePath) => {
    if (/\.(vrm|glb)$/i.test(filePath)) {
      res.setHeader("Content-Type", "model/gltf-binary");
    }
  };
  webApp.use(
    "/models",
    express.static(path.join(__dirname, "dist/models"), {
      setHeaders: setModelMime,
    }),
  );
  webApp.use(
    "/models",
    express.static(path.join(__dirname, "public/models"), {
      setHeaders: setModelMime,
    }),
  );
  webApp.use(
    "/models",
    express.static(path.join(__dirname, "../assets/3D Model Naura"), {
      setHeaders: setModelMime,
    }),
  );

  // --- Webhook Routes Mounting ---
  // Pasang rute webhook ke webApp utama agar URL https://domain/api/webhook/* langsung aktif
  if (webhookApp) {
    webApp.use(webhookApp);
  }

  // --- Sesi (harus lebih dulu dari seluruh rute) ---
  const sessionMiddleware = session({
    name: "naura.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24,
    },
  });

  webApp.use(sessionMiddleware);
  webApp.use(passport.initialize());
  webApp.use(passport.session());
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  // --- Pembatas laju ---
  // Longgar untuk API biasa, ketat untuk pintu masuk dan God Mode.
  webApp.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      validate: {
        xForwardedForHeader: false,
        forwardedHeader: false,
        default: false,
      },
    }),
  );
  webApp.use(
    "/auth",
    rateLimit({
      windowMs: 60_000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
      validate: {
        xForwardedForHeader: false,
        forwardedHeader: false,
        default: false,
      },
    }),
  );
  webApp.use(
    "/api/owner",
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
      validate: {
        xForwardedForHeader: false,
        forwardedHeader: false,
        default: false,
      },
    }),
  );

  // --- Login Discord ---
  if (!env.CLIENT_ID || !env.CLIENT_SECRET) {
    logger.warn(
      "[DASHBOARD] DISCORD_CLIENT_ID / SECRET belum diatur. Login Web UI dimatikan.",
    );
  } else {
    passport.use(
      new DiscordStrategy(
        {
          clientID: env.CLIENT_ID,
          clientSecret: env.CLIENT_SECRET,
          callbackURL: env.CALLBACK_URL,
          scope: ["identify", "guilds"],
        },
        (accessToken, refreshToken, profile, done) => done(null, profile),
      ),
    );

    // Sanitasi URL pengalihan untuk mencegah serangan Open Redirect
    const sanitizeRedirectUrl = (url) => {
      if (!url || typeof url !== "string") return "/";
      const trimmed = url.trim();
      if (
        trimmed.startsWith("/") &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("/\\") &&
        !trimmed.includes("://") &&
        !/[\r\n\t\0]/.test(trimmed)
      ) {
        return trimmed;
      }
      return "/";
    };

    webApp.get("/auth/discord", (req, res, next) => {
      const returnTo = req.query.returnTo || req.query.redirect;
      if (returnTo && req.session) {
        req.session.returnTo = sanitizeRedirectUrl(String(returnTo));
      }
      passport.authenticate("discord")(req, res, next);
    });
    webApp.get(
      "/auth/discord/callback",
      passport.authenticate("discord", { failureRedirect: "/login?failed=1" }),
      (req, res) => {
        const rawReturnTo = req.session?.returnTo || "/";
        const returnTo = sanitizeRedirectUrl(rawReturnTo);
        if (req.session) {
          delete req.session.returnTo;
        }
        res.redirect(returnTo);
      },
    );
  }

  webApp.get("/auth/logout", (req, res) => {
    // Sesi ikut dihancurkan, bukan hanya dilepas dari passport. Tanpa ini,
    // cookie lama masih menunjuk ke sesi yang hidup di penyimpanan.
    req.logout(() => {
      req.session?.destroy(() => {
        res.clearCookie("naura.sid");
        res.redirect("/");
      });
    });
  });

  // --- Rute API ---
  webApp.use(require("./routes/auth")(client));
  webApp.use(require("./routes/public")(client));
  webApp.use(require("./routes/user")(client));
  webApp.use(require("./routes/guild")(client));
  webApp.use(require("./routes/owner")(client));
  webApp.use(require("./routes/tickets")(client));
  webApp.use("/api/analytics", require("./routes/analytics")(client));
  webApp.use(require("./routes/socialFeed")(client));
  webApp.use("/api/ai", require("./routes/ai")(client));
  webApp.use("/api/survival", require("./routes/survival")(client));
  webApp.use("/api", require("./routes/api")(client));

  // --- Prometheus / Grafana Metrics Telemetry Endpoint ---
  webApp.get("/metrics", (req, res) => {
    const telemetryMetrics = require("../src/services/telemetryMetrics");
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(telemetryMetrics.generatePrometheusMetrics(client));
  });

  // --- Route Portfolio Member (Sprint 21) ---
  // Static: serve file 3D model langsung dari folder assets
  webApp.use(
    "/assets/3d",
    express.static(path.join(__dirname, "../assets/3D Model Naura")),
  );
  webApp.use(require("./routes/portfolio")(client));

  // --- Uji coba persona AI dari halaman pengaturan ---
  webApp.post("/api/settings/sandbox", requireApiLogin, async (req, res) => {
    const { message, customPersona, serverKnowledge } = req.body || {};
    if (!message)
      return res.status(400).json({ error: "Pesannya masih kosong." });

    const env = require("../src/config/env");
    const systemPrompt =
      "Kamu adalah Naura Hoshino, asisten virtual server Discord.\n" +
      `Sifat/Persona kamu: ${customPersona || "Ceria, perhatian, dan murah senyum."}\n` +
      `Pengetahuan server (FAQ): ${serverKnowledge || "Tidak ada aturan khusus."}\n\n` +
      "Balas pesan pengguna berikut sambil tetap setia pada sifat dan pengetahuan di atas.";

    try {
      const response = await fetch("https://api.verba.ink/v1/response", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.VERBA_API_KEY}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        body: JSON.stringify({
          character: env.VERBA_CHARACTER_SLUG || "naura",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: String(message).slice(0, 2000) },
          ],
        }),
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        const reply =
          data?.choices?.[0]?.message?.content ||
          data?.message?.content ||
          data?.content;
        if (reply) return res.json({ reply });
      }
    } catch (e) {
      logger.warn(`[SANDBOX] Verba gagal: ${e.message}`);
    }

    // Mode demo lokal bila Verba tidak tersedia.
    let reply = `[Mode Demo] Persona kamu sudah aktif kok! Kamu bilang: "${message}". `;
    const persona = String(customPersona || "").toLowerCase();
    if (persona.includes("tsundere")) {
      reply +=
        "H-hmph! Jangan salah paham ya, Naura jawab bukan karena senang!";
    } else if (persona.includes("formal")) {
      reply +=
        "Baik, pesan Anda sudah kami terima. Ada lagi yang bisa dibantu?";
    } else {
      reply += "Naura siap menemani dengan sifat barunya!";
    }
    return res.json({ reply });
  });

  // --- Redirect legacy /v2 ke root dashboard utama ---
  webApp.use("/v2", (req, res) => res.redirect("/"));

  // ==================================================================
  // Mobile Dashboard, dashboard/mobile/ (sub-folder khusus mobile)
  //
  // Production: sajikan dari mobile/dist/ (hasil `npm run mobile:build`)
  // Development: sajikan langsung dari mobile/src/pages/ (tanpa build)
  //
  // Auth session berbagi otomatis karena menggunakan Express instance yang sama.
  // Socket.IO juga berbagi namespace yang sama.
  // ==================================================================
  const mobileDist = path.join(__dirname, "mobile", "dist");
  const mobileSrc  = path.join(__dirname, "mobile", "src", "pages");

  if (fs.existsSync(mobileDist)) {
    // Production, sajikan dari hasil build Vite
    webApp.use("/mobile", express.static(mobileDist, { index: false }));

    const mobileView = (page) => (req, res) => {
      const distFile = path.join(mobileDist, "src", "pages", `${page}.html`);
      const fallback = path.join(mobileDist, "src", "pages", "index.html");
      res.sendFile(fs.existsSync(distFile) ? distFile : fallback);
    };

    webApp.get("/mobile",             mobileView("index"));
    webApp.get("/mobile/",            mobileView("index"));
    webApp.get("/mobile/survival",    mobileView("survival"));
    webApp.get("/mobile/inventory",   mobileView("inventory"));
    webApp.get("/mobile/clan",        mobileView("clan"));
    webApp.get("/mobile/marketplace", mobileView("marketplace"));
    webApp.get("/mobile/arcade",      mobileView("arcade"));
    webApp.get("/mobile/music",       mobileView("music"));
    webApp.get("/mobile/economy",     mobileView("economy"));
    webApp.get("/mobile/leaderboard", mobileView("leaderboard"));
    webApp.get("/mobile/config",      requireLogin, mobileView("config"));
    webApp.get("/mobile/profile",     requireLogin, mobileView("profile"));
  } else if (fs.existsSync(mobileSrc)) {
    // Development fallback, sajikan langsung dari src (tanpa build)
    webApp.use("/mobile", express.static(mobileSrc, { index: false }));
    webApp.use("/mobile/css", express.static(path.join(__dirname, "mobile", "src", "css")));
    webApp.use("/mobile/js",  express.static(path.join(__dirname, "mobile", "src", "js")));

    webApp.get("/mobile",             (req, res) => res.sendFile(path.join(mobileSrc, "index.html")));
    webApp.get("/mobile/",            (req, res) => res.sendFile(path.join(mobileSrc, "index.html")));
    webApp.get("/mobile/survival",    (req, res) => res.sendFile(path.join(mobileSrc, "survival.html")));
    webApp.get("/mobile/inventory",   (req, res) => res.sendFile(path.join(mobileSrc, "inventory.html")));
    webApp.get("/mobile/clan",        (req, res) => res.sendFile(path.join(mobileSrc, "clan.html")));
    webApp.get("/mobile/marketplace", (req, res) => res.sendFile(path.join(mobileSrc, "marketplace.html")));
    webApp.get("/mobile/arcade",      (req, res) => res.sendFile(path.join(mobileSrc, "arcade.html")));
    webApp.get("/mobile/music",       (req, res) => res.sendFile(path.join(mobileSrc, "music.html")));
    webApp.get("/mobile/economy",     (req, res) => res.sendFile(path.join(mobileSrc, "economy.html")));
    webApp.get("/mobile/leaderboard", (req, res) => res.sendFile(path.join(mobileSrc, "leaderboard.html")));
    webApp.get("/mobile/config",      requireLogin, (req, res) => res.sendFile(path.join(mobileSrc, "config.html")));
    webApp.get("/mobile/profile",     requireLogin, (req, res) => res.sendFile(path.join(mobileSrc, "profile.html")));
  } else {
    logger.warn("[DASHBOARD] Mobile dashboard (dashboard/mobile/) belum di-build. Jalankan: npm run mobile:build");
  }

  // --- Auto-redirect HP ke /mobile ---
  const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  webApp.use((req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const isMobilePath = req.path.startsWith('/mobile');
    const isApiPath = req.path.startsWith('/api') || req.path.startsWith('/auth') 
                   || req.path.startsWith('/socket.io') || req.path === '/health';
    
    // Redirect jika device mobile dan belum di path /mobile atau /api
    if (MOBILE_UA.test(ua) && !isMobilePath && !isApiPath) {
      return res.redirect(302, '/mobile' + (req.path === '/' ? '' : req.path));
    }
    next();
  });

  // --- Halaman Dashboard Utama (Dashboard Modern MPA) ---
  const distPages = path.join(__dirname, "dist/src/pages");
  const srcPages = path.join(__dirname, "src/pages");

  /**
   * Memilih berkas mana yang disajikan untuk sebuah halaman.
   *
   * @returns {string|null} Path absolut berkas, atau null bila tidak ada.
   */
  const pickPage = (name) => {
    const distFile = path.join(distPages, name);
    const srcFile = path.join(srcPages, name);

    const hasDist = fs.existsSync(distFile);
    const hasSrc = fs.existsSync(srcFile);

    if (hasDist && hasSrc) {
      try {
        // src lebih baru berarti hasil build belum menyusul. Sajikan src
        // supaya perubahan langsung terlihat tanpa perlu build ulang.
        if (fs.statSync(srcFile).mtimeMs > fs.statSync(distFile).mtimeMs) {
          return srcFile;
        }
      } catch (_) {
        // stat gagal: pakai dist yang sudah pasti ada.
      }
    }
    if (hasDist) return distFile;
    if (hasSrc) return srcFile;
    return null;
  };

  const view = (name) => (req, res) => {
    const file = pickPage(name);
    if (!file) return res.status(404).send("Page not found");
    return res.sendFile(file);
  };

  webApp.get("/", view("index.html"));
  webApp.get("/leaderboard", view("leaderboard.html"));
  webApp.get("/settings", requireLogin, view("settings.html"));
  webApp.get("/tickets", requireLogin, view("tickets.html"));
  webApp.get("/welcomer", requireLogin, view("welcomer.html"));
  webApp.get("/automations", requireLogin, view("automations.html"));
  webApp.get("/activity", view("activity.html"));
  webApp.get("/music", requireLogin, view("music.html"));
  webApp.get("/economy", view("economy.html"));
  webApp.get("/status", view("status.html"));
  webApp.get("/world", view("world.html"));
  webApp.get("/room", view("world.html"));
  webApp.get("/realm", view("world.html"));
  webApp.get("/karaoke", view("karaoke.html"));
  webApp.get("/feed", view("feed.html"));
  webApp.get("/portfolio", view("portfolio.html"));
  // /portfolio/me/edit, halaman edit portfolio (sama dengan portfolio.html, data diambil via API)
  webApp.get("/portfolio/me/edit", requireLogin, view("portfolio.html"));
  webApp.get("/owner", view("portfolio.html"));
  webApp.get("/topology", view("topology.html"));
  webApp.get("/builder", view("builder.html"));
  webApp.get("/survival-map", view("survival-map.html"));
  webApp.get("/soundboard", view("soundboard.html"));
  webApp.get("/jam", view("jam.html"));
  webApp.get("/lounge", view("lounge.html"));
  webApp.get("/war-room", view("war-room.html"));
  webApp.get("/clan", view("clan.html"));
  webApp.get("/marketplace", view("marketplace.html"));
  webApp.get("/admin", requireLogin, view("admin.html"));
  webApp.get("/inventory", requireLogin, view("inventory.html"));
  webApp.get("/arcade", view("arcade.html"));
  webApp.get("/achievements", view("achievements.html"));
  webApp.get("/login", (req, res, next) => {
    if (typeof req.isAuthenticated === "function" && req.isAuthenticated() && req.user) {
      return res.redirect(req.query.redirect || "/profile");
    }
    return view("login.html")(req, res, next);
  });
  webApp.get("/profile", requireLogin, view("profile.html"));

  // --- API Survival Realtime Map Data (Sprint 23) ---
  webApp.get("/api/survival/map-data", async (req, res) => {
    try {
      const UserSurvival = require("../src/models/UserSurvival");
      const {
        getTimeState,
        getWeather,
        getSeason,
      } = require("../src/survival/helpers/survivalTime");
      const {
        getActiveEvent,
      } = require("../src/survival/engines/worldEventEngine");

      const activeEvent = getActiveEvent();
      const now = new Date();
      const inGameHour = (now.getUTCHours() * 2) % 24;
      const inGameDay =
        (Math.floor(now.getTime() / (24 * 60 * 60 * 1000)) % 365) + 1;

      const { fn, col } = require("sequelize");
      const counts = await UserSurvival.findAll({
        attributes: ["currentLocation", [fn("COUNT", col("userId")), "count"]],
        group: ["currentLocation"],
        raw: true,
      });

      const locationCounts = {
        desa_sukamaju: 0,
        kota_pratama: 0,
        desa_khulkhas: 0,
        istana_draken: 0,
        // Legacy keys untuk kompatibilitas mundur
        desa: 0,
        kota: 0,
        hutan: 0,
        tambang: 0,
        laut: 0,
        academy: 0,
      };

      for (const row of counts) {
        const loc = String(row.currentLocation || "desa").toLowerCase();
        const countVal = parseInt(row.count, 10) || 0;
        if (["desa", "village", "desa_sukamaju", "hutan", "tambang", "laut"].includes(loc)) {
          locationCounts.desa_sukamaju += countVal;
          locationCounts.desa += countVal;
        } else if (["kota", "city", "kota_pratama", "academy"].includes(loc)) {
          locationCounts.kota_pratama += countVal;
          locationCounts.kota += countVal;
        } else if (["khulkhas", "desa_khulkhas", "gurun"].includes(loc)) {
          locationCounts.desa_khulkhas += countVal;
        } else if (["draken", "istana_draken", "dungeon", "abyss"].includes(loc)) {
          locationCounts.istana_draken += countVal;
        } else if (locationCounts[loc] !== undefined) {
          locationCounts[loc] += countVal;
        }
      }

      let userCurrentLocation = null;
      const targetUserId = req.query.userId || req.user?.id || null;
      if (targetUserId) {
        const userSurv = await UserSurvival.findOne({
          where: { userId: targetUserId },
          attributes: ["currentLocation"],
        });
        if (userSurv) {
          userCurrentLocation = userSurv.currentLocation || "desa_sukamaju";
        }
      }

      const weather = getWeather(inGameDay, inGameHour);
      const season = getSeason(inGameDay);
      const timeState = getTimeState(inGameHour);

      res.json({
        time: {
          day: inGameDay,
          hour: inGameHour,
          timeState,
          weather,
          season,
        },
        event: activeEvent,
        locations: locationCounts,
        userLocation: userCurrentLocation,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================================================================
  // 4. Realtime
  // ==================================================================
  const webServer = http.createServer(webApp);
  const io = new Server(webServer, {
    // `origin: '*'` bersama `credentials: true` adalah kombinasi yang ditolak
    // browser dan, kalau pun lolos, membuka sesi ke domain mana pun.
    cors: { origin: originChecker, credentials: true },
  });

  // Dipakai berkas lain (mis. plugin/core/naura.js) untuk menyiarkan kejadian.
  client.dashboardIo = io;
  global.client = client;

  require("./sockets")(client, io, { sessionMiddleware });

  webServer.on("error", (err) => {
    logger.error(`[DASHBOARD] Server error pada port ${webPort}: ${err.message}`);
  });

  webServer.listen(webPort, "0.0.0.0", () => {
    // Tampilkan URL yang benar-benar bisa diakses:
    // - Jika DASHBOARD_ORIGIN diset (domain/subdomain publik), pakai itu.
    // - Jika tidak, tampilkan alamat loopback dengan port aktif.
    const publicOrigins = parseOrigins();
    const displayUrl =
      publicOrigins.length > 0
        ? publicOrigins[0]
        : `http://localhost:${webPort}`;
    logger.info(
      `[DASHBOARD] Web UI berjalan di ${displayUrl}  (port ${webPort})`,
    );
  });

  return { webApp, webServer, io };
};
