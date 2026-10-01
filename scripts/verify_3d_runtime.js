"use strict";

/**
 * verify_3d_runtime.js - Bukti runtime untuk animasi 3D.
 *
 * Berbeda dari unit test, skrip ini menjalankan viewer Three.js sungguhan di
 * Chrome headless lewat Chrome DevTools Protocol, lalu melakukan:
 *   1. memutar tiap animasi dan mengukur FPS nyata;
 *   2. memaksa rotasi tiap sendi ke nilai ekstrem, lalu memeriksa apakah nilai
 *      itu berhasil dibatasi oleh clamp (anti self-intersection);
 *   3. mengambil screenshot sebagai bukti visual.
 *
 * Halaman uji dimuat dari static server minimal supaya tidak perlu database
 * maupun login Discord.
 *
 * Jalankan: node scripts/verify_3d_runtime.js
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.VERIFY_3D_PORT) || 19130;
const OUT_DIR = path.join(ROOT, "dashboard", "public", "verify_3d");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".vrm": "model/gltf-binary",
  ".png": "image/png",
};

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** Static server: /.html dari scratch, /models dari dashboard/public/models. */
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      let rel = decodeURIComponent(url.pathname);

      if (rel === "/" || rel === "/index.html") rel = "/verify_3d_harness.html";
      if (rel === "/verify_3d_harness.html") {
        const file = path.join(__dirname, rel.slice(1));
        if (!fs.existsSync(file)) {
          res.writeHead(404).end("harness not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(fs.readFileSync(file));
        return;
      }

      // Model 3D tersaji oleh Express pada /models (dashboard/public/models).
      if (rel.startsWith("/models/")) {
        rel = "/dashboard/public" + rel;
      }

      // Berkas lain (three, skrip animasi) diambil dari root repo.
      const file = path.join(ROOT, rel.replace(/^\/+/, ""));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end("not found: " + rel);
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function getWsUrl(debugPort = 9222) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http
        .get(`http://127.0.0.1:${debugPort}/json/list`, (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              const list = JSON.parse(data);
              const page = list.find((t) => t.type === "page");
              if (page?.webSocketDebuggerUrl) resolve(page.webSocketDebuggerUrl);
              else retry();
            } catch {
              retry();
            }
          });
        })
        .on("error", retry);
    };
    const retry = () => {
      attempts += 1;
      if (attempts > 40) reject(new Error("Chrome debug port tidak siap"));
      else setTimeout(check, 250);
    };
    check();
  });
}

/** Klien CDP minimal di atas WebSocket global Node 22+. */
function cdpClient(ws) {
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(msg.error.message));
    else entry.resolve(msg.result);
  });

  return function call(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 120000);
    });
  };
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error("Chrome/Edge tidak ditemukan. Set CHROME_PATH.");
    process.exit(1);
  }

  const server = await startServer();
  console.log(`[verify] static server di http://127.0.0.1:${PORT}`);

  const profileDir = path.join(os.tmpdir(), "chrome_3d_verify_" + Date.now());
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=800,800",
    "--user-data-dir=" + profileDir,
    "about:blank",
  ]);
  chrome.on("error", (e) => console.error("[verify] chrome error:", e.message));

  let failed = false;
  try {
    const wsUrl = await getWsUrl();
    console.log("[verify] CDP terhubung");
    // WebSocket adalah global bawaan Node 22+. Diawali globalThis. agar
    // aturan no-undef ESLint tidak salah menduga ini identifier tak dikenal.
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", () => rej(new Error("gagal buka WS")), { once: true });
    });
    const call = cdpClient(ws);

    await call("Page.enable");
    await call("Runtime.enable");
    await call("Log.enable");

    const errors = [];
    ws.addEventListener("message", (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.method === "Runtime.exceptionThrown") {
          errors.push(m.params?.exceptionDetails?.text || "exception");
        }
        if (m.method === "Log.entryAdded" && m.params?.entry?.level === "error") {
          const src = m.params.entry.url ? ` <${m.params.entry.url}>` : "";
          // favicon bukan bagian dari verifikasi animasi.
          if (!/favicon\.ico/.test(src)) errors.push(m.params.entry.text + src);
        }
      } catch {
        /* abaikan */
      }
    });

    console.log("[verify] navigasi ke harness...");
    await call("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });

    // Tunggu sampai report selesai terisi.
    let report = null;
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await call("Runtime.evaluate", {
        expression: "JSON.stringify(window.__REPORT__ || null)",
        returnByValue: true,
      });
      const raw = res.result?.value;
      if (raw && raw !== "null") {
        report = JSON.parse(raw);
        if (report.ready || report.error) break;
      }
    }

    if (!report) {
      console.error("[verify] GAGAL: laporan tidak pernah diterima.");
      failed = true;
    } else {
      console.log("\n=== LAPORAN VERIFIKASI RUNTIME 3D ===");
      console.log("model termuat      :", report.ready ? "YA" : "TIDAK");
      if (report.error) console.log("error              :", report.error);
      console.log("clip ditemukan     :", (report.clips || []).join(", ") || "(tidak ada)");
      console.log("bone diperiksa     :", Object.keys(report.boneRotationMax || {}).length);

      const rot = report.boneRotationMax || {};
      const sorted = Object.entries(rot).sort((a, b) => b[1] - a[1]).slice(0, 10);
      console.log("\nrotasi sudut terbesar (rad):");
      for (const [n, v] of sorted) console.log(`   ${n.padEnd(26)} ${v.toFixed(4)}`);

      const over = report.clamped || {};
      if (Object.keys(over).length === 0) {
        console.log("\nHASIL: tidak ada sendi melewati batas ekstrem -> TIDAK ADA PENETRASI");
      } else {
        console.log("\nHASIL: sendi melewati batas (indikasi penetration):");
        for (const [n, v] of Object.entries(over)) console.log(`   ${n} = ${v.toFixed(3)}`);
        failed = true;
      }

      if (errors.length) {
        console.log("\nerror console:");
        for (const e of errors.slice(0, 10)) console.log("   " + e);
        failed = true;
      } else {
        console.log("\nerror console       : tidak ada");
      }
    }

    // Screenshot sebagai bukti visual.
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const shot = await call("Page.captureScreenshot", { format: "png" });
    if (shot.data) {
      const out = path.join(OUT_DIR, "runtime_3d.png");
      fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
      console.log("\nscreenshot          :", out);
    }
  } catch (err) {
    console.error("[verify] GAGAL:", err.message);
    failed = true;
  } finally {
    try {
      chrome.kill();
    } catch {
      /* abaikan */
    }
    server.close();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      /* abaikan */
    }
  }

  console.log(failed ? "\nHASIL AKHIR: GAGAL" : "\nHASIL AKHIR: BERHASIL");
  process.exit(failed ? 1 : 0);
}

if (require.main === module) {
  // Tanpa argumen: verifikasi harness mandiri (default, tidak butuh server).
  // Dengan --lounge <url>: verifikasi halaman /lounge pada dashboard yang jalan.
  if (process.argv[2] === "--lounge") {
    const target = process.argv[3] || "http://127.0.0.1:19130";
    verifyLoungeRender(target)
      .then((r) => {
        console.log("\n=== HASIL RENDER /LOUNGE ===");
        console.log("canvas ditemukan  :", r.canvas ? "YA" : "TIDAK");
        if (r.canvas) {
          console.log("ukuran canvas     :", r.w + "x" + r.h);
          console.log("context WebGL     :", r.glLost === false ? "aktif" : (r.glLost === true ? "HILANG" : "tidak diketahui"));
          console.log("piksel non-kosong :", r.pixelSum);
          console.log("overlay loading   :", r.loadingHidden === true ? "tersembunyi (model tampil)" : "masih terlihat");
          console.log("status 3D         :", r.status || "-");
        }
        if (r.consoleErrors?.length) {
          console.log("\nerror konsol:");
          for (const e of r.consoleErrors.slice(0, 8)) console.log("   " + String(e).slice(0, 200));
        } else {
          console.log("error konsol       : tidak ada");
        }
        if (r.screenshot) console.log("screenshot         :", r.screenshot);
        const ok = r.canvas && r.pixelSum > 0 && !r.consoleErrors?.length;
        console.log(ok ? "\nHASIL: BERHASIL" : "\nHASIL: GAGAL");
        process.exit(ok ? 0 : 1);
      })
      .catch((e) => {
        console.error("[lounge] GAGAL:", e.message);
        process.exit(1);
      });
  } else {
    main();
  }
}

/**
 * Menunggu sampai canvas Three.js benar-benar menggambar sesuatu.
 *
 * Seluruh buffer piksel pada area tengah kanvas dibaca. Kalau
 * jumlahnya nol berarti layar masih kosong: model belum termuat, atau WebGL
 * gagal, atau canvas salah ukuran. Menyebut halaman "HTTP 200" saja tidak
 * cukup untuk membuktikan 3D-nya hidup.
 *
 * @param {Function} call - Klien CDP.
 * @returns {Promise<object>} Status render.
 */
async function pollCanvas(call) {
  const probe = `(() => {
    const c = document.getElementById("lounge3dCanvas")
      || document.getElementById("naura-hero-3d-canvas");
    if (!c) return { canvas: false };
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    const loadEl = document.getElementById("naura3d-loading");
    const statusEl = document.getElementById("naura3d-status-text");
    return {
      canvas: true,
      w: c.width,
      h: c.height,
      glLost: gl ? gl.isContextLost() : null,
      pixelSum: (() => {
        if (!gl) return null;
        const x = Math.max(0, Math.floor(c.width / 2) - 32);
        const y = Math.max(0, Math.floor(c.height / 2) - 32);
        const px = new Uint8Array(4 * 64 * 64);
        gl.readPixels(x, y, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
        return sum;
      })(),
      loadingHidden: loadEl
        ? getComputedStyle(loadEl).display === "none" ||
          Number(getComputedStyle(loadEl).opacity) < 0.05
        : null,
      status: statusEl ? statusEl.textContent : null,
    };
  })()`;

  let last = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const r = await call("Runtime.evaluate", { expression: probe, returnByValue: true });
    last = r.result?.value || last;
    if (last?.canvas && last.pixelSum > 0) break;
  }
  return last || { canvas: false };
}

/**
 * verifyLoungeRender(url) - Membuktikan halaman /lounge benar-benar merender
 * model 3D di browser sungguhan, bukan sekadar HTTP 200.
 *
 * Menghapus keraguan "halaman terbuka tapi modelnya kosong": halaman dibaca
 * lewat WebSocket, canvas diperiksa apakah punya piksel non-kosong (tanda
 * Three.js benar-benar menggambar), dan error konsol dikumpulkan.
 *
 * @param {string} url - URL dasar dashboard, mis. http://127.0.0.1:19130
 * @param {number} debugPort - Port Chrome DevTools Protocol.
 * @returns {Promise<object>} Hasil verifikasi.
 */
async function verifyLoungeRender(url, debugPort = 9223) {
  const chromePath = findChrome();
  if (!chromePath) throw new Error("Chrome/Edge tidak ditemukan");

  const profileDir = path.join(os.tmpdir(), "chrome_lounge_" + Date.now());
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=" + debugPort,
    "--no-first-run",
    "--no-default-browser-check",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1280,900",
    "--user-data-dir=" + profileDir,
    "about:blank",
  ]);

  const errors = [];
  try {
    const wsUrl = await getWsUrl(debugPort);
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", () => rej(new Error("gagal buka WS")), { once: true });
    });
    const call = cdpClient(ws);

    ws.addEventListener("message", (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.method === "Runtime.exceptionThrown") {
          errors.push(
            m.params?.exceptionDetails?.exception?.description ||
              m.params?.exceptionDetails?.text ||
              "exception",
          );
        }
        if (m.method === "Runtime.consoleAPICalled" && m.params?.type === "error") {
          errors.push(
            (m.params.args || [])
              .map((a) => a.value ?? a.description ?? "")
              .join(" "),
          );
        }
      } catch {
        /* abaikan */
      }
    });

    await call("Page.enable");
    await call("Runtime.enable");

    const target = `${url}${process.env.VERIFY_3D_PATH || "/lounge"}`;
    console.log("[verify] membuka " + target);
    await call("Page.navigate", { url: target });

    const result = await pollCanvas(call);
    result.consoleErrors = errors.filter((e) => !/favicon/i.test(String(e)));

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const shot = await call("Page.captureScreenshot", { format: "png" });
    if (shot.data) {
      result.screenshot = path.join(OUT_DIR, "lounge_render.png");
      fs.writeFileSync(result.screenshot, Buffer.from(shot.data, "base64"));
    }
    return result;
  } finally {
    try { chrome.kill(); } catch { /* abaikan */ }
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* abaikan */ }
  }
}

module.exports = {
  startServer,
  getWsUrl,
  findChrome,
  cdpClient,
  verifyLoungeRender,
  PORT,
  OUT_DIR,
  ROOT,
  MIME,
};
