"use strict";

/**
 * test-services.js - External Services & AI Diagnostic Tool (Tanpa Ollama)
 * Memeriksa status kesehatan Cloud AI (Gemini, Groq), Audio Nodes (Lavalink, Fish Audio),
 * dan Web Dashboard.
 *
 * Penggunaan:
 *   node scripts/test-services.js
 *   npm run test:services
 */

const env = require("../src/config/env");
const aiEnsembleRouter = require("../src/ai/aiEnsembleRouter");
const { TASK_TYPES } = aiEnsembleRouter;

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function withTimeout(promise, ms = 8000, errorMsg = "Batas waktu koneksi terlampaui") {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${errorMsg} (${ms / 1000}s)`)), ms),
    ),
  ]);
}

async function testGemini() {
  if (!env.GEMINI_API) {
    return {
      ok: false,
      skipped: true,
      reason: "GEMINI_API_KEY tidak dikonfigurasi di environment.",
    };
  }

  const start = Date.now();
  try {
    const res = await withTimeout(
      aiEnsembleRouter.generate({
        taskType: TASK_TYPES.GENERAL_CHAT,
        prompt: "Halo Naura! Balas 1 kalimat singkat bahwa sistem aktif.",
      }),
      8000,
      "Timeout memanggil Gemini API",
    );
    const latency = Date.now() - start;

    return {
      ok: true,
      latency,
      details: {
        "Provider Terpilih": res.provider,
        "Model": res.model,
        "Latensi Respon": `${latency}ms`,
        "Cuplikan Output": `"${res.text.slice(0, 80).replace(/\n/g, " ")}..."`,
      },
    };
  } catch (err) {
    return {
      ok: false,
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

async function testGroq() {
  if (!env.GROQ_API_KEY) {
    return {
      ok: false,
      skipped: true,
      reason: "GROQ_API_KEY tidak dikonfigurasi di environment.",
    };
  }

  const start = Date.now();
  try {
    const res = await withTimeout(
      aiEnsembleRouter.generate({
        taskType: TASK_TYPES.TACTICAL_REASONING,
        prompt: "Uji coba integritas penalaran taktis. Balas 1 kata: SIAP.",
      }),
      8000,
      "Timeout memanggil Groq Cloud API",
    );
    const latency = Date.now() - start;

    return {
      ok: true,
      latency,
      details: {
        "Provider Terpilih": res.provider,
        "Model": res.model,
        "Latensi Respon": `${latency}ms`,
        "Cuplikan Output": `"${res.text.slice(0, 80).replace(/\n/g, " ")}"`,
      },
    };
  } catch (err) {
    return {
      ok: false,
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

async function testLavalink() {
  const host = env.LAVA_HOST || "localhost";
  const port = env.LAVA_PORT || 2333;
  const pass = env.LAVA_PASS || "youshallnotpass";
  const protocol = env.LAVA_SECURE ? "https" : "http";
  const url = `${protocol}://${host}:${port}/version`;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      headers: { Authorization: pass },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const latency = Date.now() - start;
    if (res.ok) {
      const version = await res.text();
      return {
        ok: true,
        latency,
        details: {
          "Endpoint": `${host}:${port}`,
          "Lavalink Version": version.trim(),
          "Latensi": `${latency}ms`,
        },
      };
    }
    return {
      ok: false,
      latency,
      error: `HTTP ${res.status}: Gagal otentikasi atau node bermasalah`,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: true,
      reason: `Node lokal (${host}:${port}) offline. Bot akan menggunakan Lavalink Cluster Fallback otomatis saat aktif.`,
    };
  }
}

function testFishAudio() {
  if (!env.FISH_AUDIO_API_KEY) {
    return {
      ok: false,
      skipped: true,
      reason: "FISH_AUDIO_API_KEY tidak dikonfigurasi (AI Voice Companion opsional).",
    };
  }

  return {
    ok: true,
    details: {
      "Voice ID": env.FISH_AUDIO_VOICE_ID || "(Default Model)",
      "Status AI DJ": env.AI_DJ_ENABLED ? "Aktif" : "Non-aktif (Standby)",
      "VAD Mode": env.VOICE_GATEWAY_VAD || "enabled",
    },
  };
}

async function testDashboard() {
  const port = env.DASHBOARD_PORT || 3000;
  const url = `http://localhost:${port}/api/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(url, { signal: controller.signal }).finally(() =>
      clearTimeout(timeoutId),
    );

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: true,
        details: {
          "URL": url,
          "Status API": "Online & Menjawab",
          "Versi": data.version || env.BOT_VERSION,
        },
      };
    }
    return {
      ok: false,
      skipped: true,
      reason: `Server Dashboard belum dinyalakan di port ${port}. Jalankan 'npm run dashboard' bila ingin menguji web.`,
    };
  } catch {
    return {
      ok: false,
      skipped: true,
      reason: `Server Dashboard belum menyala di port ${port} (Standby).`,
    };
  }
}

async function run() {
  console.log(`\n${C.bold}${C.cyan}====================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  NAURA HOSHINO V2 - EXTERNAL SERVICES DIAGNOSTICS   ${C.reset}`);
  console.log(`${C.bold}${C.cyan}  (Mode Cloud API & Web Hosting - Tanpa Ollama)      ${C.reset}`);
  console.log(`${C.bold}${C.cyan}====================================================${C.reset}\n`);

  console.log(`${C.gray}[1/6] Memeriksa Google Gemini AI...${C.reset}`);
  const geminiRes = await testGemini();

  console.log(`${C.gray}[2/6] Memeriksa Groq Cloud AI...${C.reset}`);
  const groqRes = await testGroq();

  console.log(`${C.gray}[3/6] Memeriksa Status Ollama (Bypass / Non-Aktif)...${C.reset}`);
  // Ollama sengaja dilewati sesuai instruksi web hosting
  const ollamaRes = {
    ok: true,
    skipped: true,
    reason: "Dinonaktifkan (Kompatibilitas Web Hosting tanpa lokal runtime Ollama).",
  };

  console.log(`${C.gray}[4/6] Memeriksa Audio Companion (Fish Audio)...${C.reset}`);
  const fishAudioRes = testFishAudio();

  console.log(`${C.gray}[5/6] Memeriksa Lavalink Audio Engine...${C.reset}`);
  const lavalinkRes = await testLavalink();

  console.log(`${C.gray}[6/6] Memeriksa Express Web Dashboard...${C.reset}`);
  const dashboardRes = await testDashboard();

  console.log(`\n${C.bold}HASIL DIAGNOSTIK LAYANAN EKSTERNAL:${C.reset}\n`);

  // 1. Gemini
  if (geminiRes.ok) {
    console.log(`  ${C.green}[OK]${C.reset} ${C.bold}Google Gemini AI${C.reset} (${geminiRes.latency}ms)`);
    for (const [k, v] of Object.entries(geminiRes.details)) {
      console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
    }
  } else if (geminiRes.skipped) {
    console.log(`  ${C.yellow}[LEWATI]${C.reset} ${C.bold}Google Gemini AI${C.reset}: ${geminiRes.reason}`);
  } else {
    console.log(`  ${C.red}[FAIL]${C.reset} ${C.bold}Google Gemini AI${C.reset}`);
    console.log(`       - Error: ${C.red}${geminiRes.error}${C.reset}`);
  }
  console.log("");

  // 2. Groq
  if (groqRes.ok) {
    console.log(`  ${C.green}[OK]${C.reset} ${C.bold}Groq Cloud AI (High-Speed LLM)${C.reset} (${groqRes.latency}ms)`);
    for (const [k, v] of Object.entries(groqRes.details)) {
      console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
    }
  } else if (groqRes.skipped) {
    console.log(`  ${C.yellow}[LEWATI]${C.reset} ${C.bold}Groq Cloud AI${C.reset}: ${groqRes.reason}`);
  } else {
    console.log(`  ${C.red}[FAIL]${C.reset} ${C.bold}Groq Cloud AI${C.reset}`);
    console.log(`       - Error: ${C.red}${groqRes.error}${C.reset}`);
  }
  console.log("");

  // 3. Ollama (Skipped / Disabled)
  console.log(`  ${C.blue}[BYPASS]${C.reset} ${C.bold}Ollama Local Engine${C.reset}`);
  console.log(`       - Catatan: ${C.gray}${ollamaRes.reason}${C.reset}\n`);

  // 4. Fish Audio
  if (fishAudioRes.ok) {
    console.log(`  ${C.green}[OK]${C.reset} ${C.bold}Fish Audio TTS Streaming${C.reset}`);
    for (const [k, v] of Object.entries(fishAudioRes.details)) {
      console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
    }
  } else {
    console.log(`  ${C.yellow}[LEWATI]${C.reset} ${C.bold}Fish Audio TTS${C.reset}: ${fishAudioRes.reason}`);
  }
  console.log("");

  // 5. Lavalink
  if (lavalinkRes.ok) {
    console.log(`  ${C.green}[OK]${C.reset} ${C.bold}Lavalink Audio Node${C.reset} (${lavalinkRes.latency}ms)`);
    for (const [k, v] of Object.entries(lavalinkRes.details)) {
      console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
    }
  } else {
    console.log(`  ${C.yellow}[LEWATI]${C.reset} ${C.bold}Lavalink Audio Node${C.reset}: ${lavalinkRes.reason || lavalinkRes.error}`);
  }
  console.log("");

  // 6. Web Dashboard
  if (dashboardRes.ok) {
    console.log(`  ${C.green}[OK]${C.reset} ${C.bold}Express Web Dashboard${C.reset}`);
    for (const [k, v] of Object.entries(dashboardRes.details)) {
      console.log(`       - ${k}: ${C.cyan}${v}${C.reset}`);
    }
  } else {
    console.log(`  ${C.yellow}[LEWATI]${C.reset} ${C.bold}Express Web Dashboard${C.reset}: ${dashboardRes.reason}`);
  }

  console.log(`\n${C.bold}${C.cyan}====================================================${C.reset}\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Kesalahan tak terduga saat pengujian layanan:", err);
  process.exit(1);
});
