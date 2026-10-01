"use strict";

/**
 * verify_hero_runtime.js - Bukti runtime untuk hero 3D di dashboard utama.
 *
 * Dashboard "/" punya empat sebab independen yang membuat overlay
 * "Memuat Model 3D VRM..." tampil tanpa henti:
 *
 *   1. initHeroViewer() tidak pernah dipanggil dari index.html.
 *   2. Path model memakai spasi mentah, harus %20.
 *   3. Ada penutup `});` berlebih yang mematikan seluruh script inline.
 *   4. express.static(dist) menyajikan index.html usang sebelum view()
 *      sehingga perbaikan di src/ tidak pernah terlihat.
 *
 * Test unit (src/utils/heroViewerBoot.test.js) mengunci keempatnya di level
 * source, tapi test unit tidak bisa membuktikan WebGL benar-benar menggambar.
 * Skrip ini menutup gap itu dengan memuat "/" di Chrome headless lewat CDP.
 *
 * Semua proses Chrome dan folder profil dibersihkan pada blok finally,
 * apa pun hasil verifikasinya.
 *
 * Jalankan: node scripts/verify_hero_runtime.js
 */

const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const BASE = process.env.HERO_VERIFY_URL || "http://127.0.0.1:19130";
const CDP_PORT = Number(process.env.HERO_CDP_PORT) || 9224;
const OUT_DIR = path.join(ROOT, "dashboard", "public", "verify_3d");
const HEADFUL = process.env.HERO_HEADFUL === "1";

/**
 * Menemukan binary Chrome atau Edge yang tersedia di sistem.
 * @returns {string|null} Path binary, atau null bila tidak ada.
 */
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

/**
 * Menunggu endpoint /json/list Chrome DevTools Protocol siap.
 * @param {number} port - Port debugging CDP.
 * @returns {Promise<string>} URL WebSocket untuk halaman pertama.
 */
function getWsUrl(port) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const retry = () => {
      if (++attempts > 40) return reject(new Error("Chrome CDP tidak merespons"));
      setTimeout(check, 250);
    };
    const check = () => {
      http
        .get(`http://127.0.0.1:${port}/json/list`, (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              const list = JSON.parse(body);
              const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
              if (page) return resolve(page.webSocketDebuggerUrl);
            } catch {
              /* abaikan, coba lagi */
            }
            retry();
          });
        })
        .on("error", retry);
    };
    check();
  });
}

/**
 * Membungkus WebSocket menjadi pemanggil perintah CDP sederhana.
 * @param {WebSocket} ws - Koneksi WebSocket aktif.
 * @returns {Function} Fungsi call(method, params).
 */
function cdpClient(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
      setTimeout(() => {
        if (pending.has(msgId)) {
          pending.delete(msgId);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 60000);
    });
}

/**
 * Membaca status hero dari halaman yang sedang terbuka.
 *
 * Probe sengaja membaca DOM dan langsung mengambil piksel dari context
 * WebGL, bukan rely pada screenshot, supaya bisa membedakan "halaman terisi"
 * dari "Three.js benar-benar menggambar sesuatu".
 *
 * @param {Function} call - Pemanggil CDP.
 * @returns {Promise<object>} Status hero terkini.
 */
async function probeHero(call) {
  const expression = `(() => {
    const canvas = document.getElementById('naura-hero-3d-canvas');
    const loading = document.getElementById('naura3d-loading');
    const error = document.getElementById('naura3d-error');
    const out = {
      hasCanvas: !!canvas,
      canvasW: canvas ? canvas.width : 0,
      canvasH: canvas ? canvas.height : 0,
      loadingVisible: loading ? getComputedStyle(loading).display !== 'none' : null,
      errorVisible: error ? getComputedStyle(error).display !== 'none' : null,
      webgl: null,
      pixelSum: 0,
      nonZeroPixels: 0,
    };
    if (canvas && canvas.width) {
        // Penting: getContext dengan atribut BERBEDA dari yang dipakai
        // Three.js akan mengembalikan context BARU, bukan context yang sudah
        // digambar. Karena itu kita tidak meminta atribut apa pun di sini,
        // supaya browser mengembalikan context yang sama.

      try {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          out.webgl = gl.getParameter(gl.VERSION);
          const w = gl.drawingBufferWidth;
          const h = gl.drawingBufferHeight;
          out.bufferSize = w + "x" + h;
          // Baca drawing buffer. three.js merender secara berulang via
          // requestAnimationFrame, sehingga isian buffer hanya valid bila
          // dibaca tepat setelah sebuah frame selesai. Bila alpha true dan
          // belum ada frame, buffer bisa kosong; makanya nilai ini dipakai
          // sebagai sinyal pendukung, bukan satu-satunya bukti.
          const buf = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let sum = 0, nonZero = 0;
          for (let i = 0; i < buf.length; i += 4) {
            const v = buf[i] + buf[i + 1] + buf[i + 2];
            sum += v;
            if (v > 8) nonZero++;
          }
          out.pixelSum = sum;
          out.nonZeroPixels = nonZero;
        } else {
          out.glError = "getContext mengembalikan null";
        }
      } catch (e) {
        out.glError = String((e && e.message) || e);
      }

      // Bukti utama bahwa Three.js benar-benar menggambar: toDataURL().
      // hero3d.js menyalakan preserveDrawingBuffer, jadi canvas boleh dibaca
      // kembali dari JavaScript kapan pun, tidak harus tepat setelah frame.
      // Canvas kosong akan terkompresi jadi PNG kecil; model yang tergambar
      // menghasilkan PNG jauh lebih besar. Ambang 20 KB dipakai sebagai
      // batas konservatif, bukan angka ajaib.
      try {
        out.dataUrlBytes = canvas.toDataURL("image/png").length;
      } catch (e) {
        out.dataUrlError = String((e && e.message) || e);
      }
    }
    return out;
  })()`;
  const res = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: false,
  });
  return res.result?.value || { error: "probe mengembalikan kosong" };
}

module.exports.probeHero = probeHero;

/**
 * Menjalankan verifikasi hero terhadap halaman dashboard utama.
 * @returns {Promise<object>} Hasil verifikasi.
 */
async function main() {
  const chromePath = findChrome();
  if (!chromePath) throw new Error("Chrome atau Edge tidak ditemukan di sistem");

  const profileDir = path.join(os.tmpdir(), `chrome_hero_verify_${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1440,1000",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ];
  if (!HEADFUL) args.unshift("--headless=new");

  const chrome = spawn(chromePath, args, { stdio: "ignore" });
  const errors = [];
  const warnings = [];

  try {
    const wsUrl = await getWsUrl(CDP_PORT);
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener(
        "error",
        () => reject(new Error("gagal membuka koneksi WebSocket CDP")),
        { once: true },
      );
    });
    const call = cdpClient(ws);

    ws.addEventListener("message", (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params?.exceptionDetails;
        errors.push(d?.exception?.description || d?.text || "exception tanpa detail");
      }
      if (m.method === "Runtime.consoleAPICalled") {
        const text = (m.params.args || [])
          .map((a) => a.value ?? a.description ?? "")
          .join(" ");
        if (m.params.type === "error") errors.push(text);
        else if (m.params.type === "warning") warnings.push(text);
      }
      if (m.method === "Network.loadingFailed") {
        const url = m.params?.request?.url || m.params?.errorText;
        if (!/favicon/i.test(url)) errors.push(`network gagal: ${url}`);
      }
    });

    await call("Page.enable");
    await call("Runtime.enable");
    await call("Network.enable");

    const target = `${BASE}/`;
    console.log(`[verify] membuka ${target}`);
    await call("Page.navigate", { url: target });

    // Tunggu sampai model selesai dimuat. VRM 21 MB dari disk lokal, jadi
    // 90 detik sudah sangat longgar.
    let status = {};
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      status = await probeHero(call);
      if (
        status.hasCanvas &&
        status.loadingVisible === false &&
        (status.dataUrlBytes || 0) > 20000
      ) {
        break;
      }
    }

    const relevantErrors = errors.filter((e) => !/favicon/i.test(String(e)));

    const result = {
      hasCanvas: status.hasCanvas,
      canvasSize: `${status.canvasW}x${status.canvasH}`,
      loadingVisible: status.loadingVisible,
      errorVisible: status.errorVisible,
      webgl: status.webgl,
      pixelSum: status.pixelSum,
      nonZeroPixels: status.nonZeroPixels,
      bufferSize: status.bufferSize,
      glError: status.glError,
      dataUrlBytes: status.dataUrlBytes,
      consoleErrors: relevantErrors,
      consoleWarnings: warnings.filter((w) => /hero|3d|vrm|model|three/i.test(w)),
    };

    if (status.hasCanvas && status.canvasW > 0) {
      fs.mkdirSync(OUT_DIR, { recursive: true });

      // Screenshot penuh halaman sebagai bukti visual keseluruhan.
      const shot = await call("Page.captureScreenshot", { format: "png" });
      if (shot.data) {
        const file = path.join(OUT_DIR, "hero_render.png");
        fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
        result.screenshot = file;
        result.screenshotBytes = fs.statSync(file).size;
      }

      // Screenshot yang DIPOTONG tepat pada kotak canvas. Ini bukti paling
      // jujur bahwa Three.js menggambar: kalau viewer gagal, area ini akan
      // kosong dan PNG-nya kecil. Screenshot penuh halaman tidak bisa dipakai
      // untuk ini karena area itu berisi sidebar, kartu, dan teks yang selalu ada.
      try {
        const box = await call("Runtime.evaluate", {
          expression: `(() => {
            const c = document.getElementById('naura-hero-3d-canvas');
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          })()`,
          returnByValue: true,
        });
        const rect = box.result?.value;
        if (rect && rect.width > 0 && rect.height > 0) {
          // CDP menuntut angka bulat dan menolak nilai pecahan atau di luar
          // viewport, jadi semua koordinat dibulatkan dan dijepit ke ukuran
          // jendela sebelum dikirim.
          const clip = {
            x: Math.max(0, Math.round(rect.x)),
            y: Math.max(0, Math.round(rect.y)),
            width: Math.max(1, Math.round(rect.width)),
            height: Math.max(1, Math.round(rect.height)),
            scale: 1,
          };
          const crop = await call("Page.captureScreenshot", {
            format: "png",
            clip,
            captureBeyondViewport: false,
          });
          if (crop.data) {
            const cropFile = path.join(OUT_DIR, "hero_canvas.png");
            fs.writeFileSync(cropFile, Buffer.from(crop.data, "base64"));
            result.canvasShot = cropFile;
            result.canvasShotBytes = fs.statSync(cropFile).size;
          }
        }
      } catch (e) {
        result.canvasShotError = String((e && e.message) || e);
      }
    }

    // Kriteria lulus, dari yang paling mendasar:
    //   - canvas benar-benar ada dengan ukuran bukan nol,
    //   - overlay loading hilang (ini gejala utama yang dulu dikeluhkan),
    //   - WebGL hidup (context benar-benar ada),
    //   - area canvas berisi gambar, terbukti dari screenshot yang dipotong.
    // Ambang 5 KB untuk area canvas dipilih konservatif: panel kosong dengan
    // latar transparan menghasilkan PNG di bawah itu.
    result.passed =
      result.hasCanvas === true &&
      result.canvasSize !== "0x0" &&
      result.loadingVisible === false &&
      Boolean(result.webgl) &&
      (result.canvasShotBytes || 0) > 5000;

    try {
      ws.close();
    } catch {
      /* abaikan */
    }
    return result;
  } finally {
    // Cleanup wajib apa pun hasil verifikasinya.
    try {
      chrome.kill();
    } catch {
      /* abaikan */
    }
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      /* abaikan */
    }
  }
}

if (require.main === module) {
  main()
    .then((r) => {
      console.log("\n=== Hasil Verifikasi Hero 3D ===");
      console.log("canvas ada        :", r.hasCanvas, `(${r.canvasSize})`);
      console.log(
        "overlay loading   :",
        r.loadingVisible === false ? "sembunyi (OK)" : "MASIH TAMPIL (BAHAYA)",
      );
      console.log("WebGL             :", r.webgl || "TIDAK ADA", r.bufferSize || "");
      if (r.glError) console.log("galat GL          :", r.glError);
      console.log(
        "bukti piksel      :",
        `area canvas=${r.canvasShotBytes || 0} byte, readPixels sum=${r.pixelSum}`,
      );
      if (r.canvasShotError) console.log("galat crop        :", r.canvasShotError);
      console.log(
        "error konsol      :",
        r.consoleErrors.length ? r.consoleErrors : "tidak ada",
      );
      console.log(
        "peringatan 3D     :",
        r.consoleWarnings.length ? r.consoleWarnings : "tidak ada",
      );
      console.log(
        "screenshot        :",
        r.screenshot || "tidak diambil",
        `(${r.screenshotBytes || 0} byte)`,
      );
      console.log("\nHASIL             :", r.passed ? "LULUS" : "BELUM LULUS");
      // Tulis JSON ke disk supaya hasil bisa dibaca mesin tanpa bergantung
      // pada output terminal yang mudah terpotong.
      fs.writeFileSync(
        path.join(OUT_DIR, "hero_verify.json"),
        JSON.stringify(r, null, 2),
        "utf8",
      );
      process.exit(r.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error("verifikasi hero gagal:", err.message);
      process.exit(1);
    });
}

module.exports.main = main;
