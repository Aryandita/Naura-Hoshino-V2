try {
  process.loadEnvFile();
} catch (e) {}

// Helper untuk membersihkan tanda kutip yang tidak sengaja terbawa dari panel Pterodactyl
const cleanEnv = (val) => {
  if (!val) return val;
  const cleaned = val.replace(/^["']|["']$/g, "").trim();
  if (
    cleaned.startsWith("YOUR_") ||
    cleaned.endsWith("_HERE") ||
    cleaned === "YOUR_DISCORD_BOT_TOKEN_HERE" ||
    cleaned === "YOUR_CLIENT_ID_HERE"
  ) {
    return "";
  }
  return cleaned;
};

// ShardingManager discord.js mengisi SHARDS pada setiap proses anak berisi array
// id shard yang ditangani proses itu (contoh: "[0]"). Nilainya diterjemahkan ke
// satu id supaya sisa kode cukup membaca env.SHARD_ID.
//
// Sebelum ini env.SHARD_ID tidak pernah didefinisikan, sehingga pemeriksaan
// isPrimaryShard di index.js selalu bernilai true. Efeknya setiap shard mencoba
// deploy slash command dan membuka port dashboard, dan shard kedua mati dengan
// EADDRINUSE.
const readShardId = () => {
  const raw = process.env.SHARDS;
  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return String(list[0]);
    } catch (e) {
      // Format tak terduga. Jatuh ke SHARD_ID manual di bawah.
    }
  }
  const manual = cleanEnv(process.env.SHARD_ID);
  return manual ? manual : undefined;
};

const env = {
  // RUNTIME & DEBUG
  NODE_ENV: cleanEnv(process.env.NODE_ENV) || "development",
  DEBUG: process.env.DEBUG === "true",
  SKIP_DB_MIGRATE: cleanEnv(process.env.SKIP_DB_MIGRATE) || "",

  // SHARDING
  // SHARD_ID sengaja dibiarkan undefined saat proses dijalankan mandiri
  // (node index.js), karena pemanggil membedakan "mandiri" dan "anak shard"
  // lewat typeof.
  SHARD_ID: readShardId(),
  TOTAL_SHARDS: parseInt(process.env.TOTAL_SHARDS) || 1,

  // DISCORD CORE
  TOKEN: cleanEnv(process.env.DISCORD_TOKEN),
  CLIENT_ID: cleanEnv(process.env.CLIENT_ID),
  CLIENT_SECRET: cleanEnv(process.env.DISCORD_CLIENT_SECRET),
  PREFIX: cleanEnv(process.env.PREFIX) || "n!",
  GUILD_ID: cleanEnv(process.env.GUILD_ID),
  SENTRY_DSN: cleanEnv(process.env.SENTRY_DSN),
  OWNER_IDS: process.env.OWNER_IDS
    ? process.env.OWNER_IDS.split(",").map((id) => cleanEnv(id))
    : [],

  // VERSION & PARTNERSHIP CONFIG
  BOT_VERSION: cleanEnv(process.env.BOT_VERSION) || "2.1.0",
  ENGINE_VERSION: cleanEnv(process.env.ENGINE_VERSION) || "2.1.0",
  PARTNERSHIP: cleanEnv(process.env.PARTNERSHIP) || "Belum ada kolaborasi",

  // SUPABASE (Primary Relational Cloud Provider)
  SUPABASE_URL:
    cleanEnv(process.env.SUPABASE_URL) ||
    "https://ceqkjzvrxyifxzgxtkig.supabase.co",
  SUPABASE_KEY:
    cleanEnv(
      process.env.SUPABASE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY,
    ) || "sb_publishable_9gd0-5FflbVgYPCd7WGAwQ_dJLMxyRX",
  SUPABASE_PROJECT_ID:
    cleanEnv(process.env.SUPABASE_PROJECT_ID) || "ceqkjzvrxyifxzgxtkig",

  // DATABASE (Multi-Dialect: Supabase / PostgreSQL, MySQL, SQLite Fallback)
  DATABASE_URL: cleanEnv(
    process.env.DATABASE_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      process.env.SUPABASE_DB_URL,
  ),
  DB_DIALECT:
    cleanEnv(process.env.DB_DIALECT) ||
    (cleanEnv(process.env.DATABASE_URL)?.startsWith("postgres") ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_DATABASE_URL
      ? "postgres"
      : "postgres"),
  DB_HOST: cleanEnv(
    process.env.DB_HOST ||
      process.env.SUPABASE_DB_HOST ||
      process.env.MYSQL_HOST ||
      "db.ceqkjzvrxyifxzgxtkig.supabase.co",
  ),
  DB_PORT:
    parseInt(
      process.env.DB_PORT ||
        process.env.SUPABASE_DB_PORT ||
        process.env.MYSQL_PORT,
    ) || 5432,
  DB_USER: cleanEnv(
    process.env.DB_USER ||
      process.env.SUPABASE_DB_USER ||
      process.env.MYSQL_USER ||
      "postgres",
  ),
  DB_PASS: cleanEnv(
    process.env.DB_PASSWORD ||
      process.env.DB_PASS ||
      process.env.SUPABASE_DB_PASSWORD ||
      process.env.MYSQL_PASSWORD,
  ),
  DB_NAME: cleanEnv(
    process.env.DB_NAME ||
      process.env.SUPABASE_DB_NAME ||
      process.env.MYSQL_DATABASE ||
      "postgres",
  ),
  DB_SSL:
    cleanEnv(process.env.DB_SSL) === "false" ||
    cleanEnv(process.env.DB_SSL) === "0"
      ? false
      : true,
  USE_SQLITE:
    cleanEnv(process.env.USE_SQLITE) === "true" ||
    cleanEnv(process.env.USE_SQLITE) === "1",
  USE_MYSQL:
    cleanEnv(process.env.USE_MYSQL) === "true" ||
    cleanEnv(process.env.USE_MYSQL) === "1",

  // POOL KONEKSI DATABASE
  // Pool bersifat per proses. DB_POOL_BUDGET adalah anggaran TOTAL untuk seluruh
  // shard, lalu dbManager membaginya dengan TOTAL_SHARDS. Isi DB_POOL_MAX hanya
  // bila ingin memaksa angka per proses secara manual.
  DB_POOL_BUDGET: parseInt(process.env.DB_POOL_BUDGET) || 80,
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX) || 0,

  // MODMAIL
  STAFF_GUILD: cleanEnv(process.env.STAFF_GUILD_ID),
  MODMAIL_CATEGORY: cleanEnv(process.env.MODMAIL_CATEGORY_ID),

  // LAVALINK & AUDIO
  LAVA_NODES:
    cleanEnv(process.env.LAVA_NODES) || cleanEnv(process.env.LAVALINK_NODES),
  LAVA_HOST: cleanEnv(process.env.LAVALINK_HOST) || "localhost",
  LAVA_PORT: parseInt(process.env.LAVALINK_PORT) || 2333,
  LAVA_PASS: cleanEnv(process.env.LAVALINK_PASSWORD) || "youshallnotpass",
  LAVA_SECURE: process.env.LAVALINK_SECURE === "true",
  MUSIC_DEFAULT_SEARCH:
    cleanEnv(process.env.MUSIC_DEFAULT_SEARCH) || "scsearch",

  // SPOTIFY (poru-spotify + LavaSrc node + spotifyResolver fallback)
  SPOTIFY_CLIENT_ID: cleanEnv(process.env.SPOTIFY_CLIENT_ID),
  SPOTIFY_CLIENT_SECRET: cleanEnv(process.env.SPOTIFY_CLIENT_SECRET),
  // Pasar regional untuk Web API & countryCode LavaSrc (ISO 3166-1 alpha-2)
  SPOTIFY_MARKET: cleanEnv(process.env.SPOTIFY_MARKET) || "ID",
  // Batas jumlah track playlist Spotify saat translasi manual bot-side
  SPOTIFY_MAX_PLAYLIST_TRACKS:
    parseInt(process.env.SPOTIFY_MAX_PLAYLIST_TRACKS) || 100,

  // GEMINI AI
  GEMINI_API: cleanEnv(process.env.GEMINI_API_KEY),

  // GROQ CLOUD AI (High-Speed & Failover Fallback)
  GROQ_API_KEY: cleanEnv(process.env.GROQ_API_KEY),
  GROQ_MODEL: cleanEnv(process.env.GROQ_MODEL) || "llama-3.3-70b-versatile",

  // VERBA API
  VERBA_API_KEY: cleanEnv(process.env.VERBA_API_KEY),
  VERBA_SLUG_OWNER: cleanEnv(process.env.VERBA_SLUG_OWNER),
  VERBA_SLUG_PREMIUM: cleanEnv(process.env.VERBA_SLUG_PREMIUM),
  VERBA_SLUG_GENERAL: cleanEnv(process.env.VERBA_SLUG_GENERAL),
  VERBA_CHARACTER_SLUG: cleanEnv(process.env.VERBA_CHARACTER_SLUG), // Legacy support

  // REDIS
  REDIS_URL: cleanEnv(process.env.REDIS_URL),

  // MONGODB
  MONGODB_URI: cleanEnv(process.env.MONGODB_URI || process.env.MONGO_URI),

  // OLLAMA (Local AI Fallback)
  OLLAMA_BASE_URL:
    cleanEnv(process.env.OLLAMA_BASE_URL) || "http://localhost:11434",
  OLLAMA_MODEL: cleanEnv(process.env.OLLAMA_MODEL) || "llama3.1",

  // FOOOCUS (Local Image Generation)
  FOOOCUS_BASE_URL:
    cleanEnv(process.env.FOOOCUS_BASE_URL) || "http://localhost:7865",

  // FISH AUDIO (TTS & Voice AI Companion / AI DJ)
  FISH_AUDIO_API_KEY: cleanEnv(process.env.FISH_AUDIO_API_KEY),
  FISH_AUDIO_VOICE_ID: cleanEnv(process.env.FISH_AUDIO_VOICE_ID),
  AI_DJ_ENABLED: cleanEnv(process.env.AI_DJ_ENABLED) === "true",

  // MEDIA TOOLING
  // Dipakai downloaderCompress.js. Kosongkan saja bila memakai ffmpeg-static
  // bawaan npm; isi hanya kalau host menyediakan binary FFmpeg sendiri.
  FFMPEG_PATH: cleanEnv(process.env.FFMPEG_PATH),
  OMDB_API_KEY: cleanEnv(process.env.OMDB_API_KEY),

  // ERROR REPORTING
  ERROR_WEBHOOK_URL: cleanEnv(process.env.ERROR_WEBHOOK_URL),

  // WEBHOOK PREMIUM (Saweria, Trakteer & Top.gg)
  WEBHOOK_AUTH_SAWERIA: cleanEnv(process.env.WEBHOOK_AUTH_SAWERIA),
  WEBHOOK_AUTH_TRAKTEER: cleanEnv(process.env.WEBHOOK_AUTH_TRAKTEER),
  WEBHOOK_AUTH_VOTE: cleanEnv(process.env.WEBHOOK_AUTH_VOTE),
  TOPGG_TOKEN: cleanEnv(process.env.TOPGG_TOKEN || process.env.TOP_GG_TOKEN),

  // WEB DASHBOARD & PORTS (Dynamic Pterodactyl Resolution)
  DASHBOARD_PORT:
    parseInt(process.env.DASHBOARD_PORT || process.env.SERVER_PORT) || 3000,
  DASHBOARD_ORIGIN: cleanEnv(process.env.DASHBOARD_ORIGIN) || "",
  WEBHOOK_PORT: parseInt(process.env.WEBHOOK_PORT) || 3071,
  SESSION_SECRET: cleanEnv(process.env.SESSION_SECRET),
  CALLBACK_URL: cleanEnv(process.env.DISCORD_CALLBACK_URL),
  OWNER_EVAL_ENABLED: cleanEnv(process.env.OWNER_EVAL_ENABLED) === "true",
  USE_CLUSTERING: cleanEnv(process.env.USE_CLUSTERING) === "true",
};

// Variabel yang wajib ada sebelum bot boleh menyala
const REQUIRED_KEYS = ["TOKEN", "CLIENT_ID"];

/** Daftar variabel wajib yang masih kosong. */
function getMissingEnvKeys() {
  return REQUIRED_KEYS.filter((key) => !env[key]);
}

/**
 * Validasi konfigurasi environment.
 *
 * Sebelumnya validasi ini berjalan otomatis saat modul di-import dan langsung
 * memanggil process.exit(1). Karena ShardingManager memakai respawn: true, itu
 * membuat setiap shard mati lalu dilahirkan ulang tanpa henti ketika config kurang.
 * Sekarang validasi dipanggil eksplisit: fatal di shard.js (sebelum spawn), dan
 * non-fatal di dalam proses anak shard.
 *
 * @param {{ fatal?: boolean }} [options]
 * @returns {boolean} true jika seluruh variabel wajib terisi
 */
function validateEnv({ fatal = false } = {}) {
  const missing = getMissingEnvKeys();

  if (missing.length > 0) {
    for (const key of missing) {
      console.warn(
        `\x1b[43m\x1b[30m PERINGATAN CONFIG \x1b[0m \x1b[33mVariabel ${key} belum diisi di dalam file .env!\x1b[0m`,
      );
    }
    if (fatal && process.env.STRICT_CONFIG === "true") {
      console.error(
        "\x1b[31mBot dihentikan karena konfigurasi wajib belum lengkap.\x1b[0m",
      );
      process.exit(1);
    }
    return false;
  }

  // Peringatan opsional (tidak menghentikan bot)
  if (!env.GEMINI_API) {
    console.warn(
      "[CONFIG] GEMINI_API_KEY tidak ditemukan di .env. Fitur AI utama mungkin tidak berfungsi.",
    );
  }
  if (!env.VERBA_API_KEY) {
    console.warn(
      "[CONFIG] VERBA_API_KEY tidak ditemukan di .env. Fallback ke Gemini akan digunakan.",
    );
  }
  if (!env.SESSION_SECRET) {
    console.warn(
      "[CONFIG] SESSION_SECRET tidak ditemukan di .env. Sesi Web Dashboard sebaiknya tidak memakai secret bawaan.",
    );
  }

  return true;
}

// Dipasang non-enumerable agar tidak ikut terbaca saat env di-iterasi/di-serialize.
Object.defineProperty(env, "validateEnv", {
  value: validateEnv,
  enumerable: false,
});
Object.defineProperty(env, "getMissingEnvKeys", {
  value: getMissingEnvKeys,
  enumerable: false,
});

module.exports = env;
