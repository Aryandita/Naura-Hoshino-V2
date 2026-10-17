"use strict";

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { renderCarbonCard } = require("../src/canvas/codeCanvas");
const { renderPollChart } = require("../src/canvas/pollCanvas");
const canvasWorkerPool = require("../src/canvas/canvasWorkerPool");

const PORT = 9226;
const TARGET_DIR = path.resolve("C:/Users/ACER/.gemini/antigravity/brain/f52a712d-77f2-4fbc-9e57-acae25218890/screenshots");

async function getWsUrl(port) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http
        .get(`http://127.0.0.1:${port}/json/list`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const list = JSON.parse(data);
              const page = list.find((t) => t.type === "page");
              if (page && page.webSocketDebuggerUrl) {
                resolve(page.webSocketDebuggerUrl);
              } else {
                retry();
              }
            } catch {
              retry();
            }
          });
        })
        .on("error", retry);
    };
    const retry = () => {
      attempts++;
      if (attempts > 30) {
        return reject(new Error("Browser debug port not ready"));
      }
      setTimeout(check, 200);
    };
    check();
  });
}

function sendCdpCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const onMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener("message", onMessage);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch (e) {
        reject(e);
      }
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function captureWebPage(ws, fileUrl, outputPath, pageName) {
  console.log(`[Screenshot] Loading ${pageName}...`);
  await sendCdpCommand(ws, "Page.enable");
  await sendCdpCommand(ws, "Page.navigate", { url: fileUrl });
  await new Promise((r) => setTimeout(r, 1500));

  const screenshot = await sendCdpCommand(ws, "Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });

  const buffer = Buffer.from(screenshot.data, "base64");
  fs.writeFileSync(outputPath, buffer);
  console.log(`[Screenshot] Saved ${pageName} -> ${outputPath} (${buffer.length} bytes)`);
}

async function main() {
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  // 1. Render Canvas Cards
  console.log("[Screenshot] Generating Carbon code snippet card...");
  const sampleCode = [
    "// Naura Hoshino V2 - Smart Code Viewer",
    "function calculateReward(level, streak) {",
    "  const baseReward = 100 * level;",
    "  const multiplier = Math.min(2.5, 1 + streak * 0.1);",
    "  return Math.floor(baseReward * multiplier);",
    "}",
  ].join("\n");

  const carbonBuf = await renderCarbonCard({
    code: sampleCode,
    language: "javascript",
    theme: "stellar",
    showLineNumbers: true,
    title: "rewardEngine.js",
  });
  const carbonPath = path.join(TARGET_DIR, "card_carbon.png");
  fs.writeFileSync(carbonPath, carbonBuf);
  console.log(`[Screenshot] Saved Carbon card -> ${carbonPath} (${carbonBuf.length} bytes)`);

  console.log("[Screenshot] Generating Poll chart card...");
  const pollBuf = await renderPollChart({
    title: "Fitur Favorit Naura Hoshino V2",
    options: [
      { label: "Blackjack & TypeRace Arcade", votes: 42 },
      { label: "Remote Player & Soundboard", votes: 35 },
      { label: "Automod Phishing Shield", votes: 28 },
      { label: "Canvas Code & Poll Card", votes: 19 },
    ],
    totalVotes: 124,
  });
  const pollPath = path.join(TARGET_DIR, "card_poll.png");
  fs.writeFileSync(pollPath, pollBuf);
  console.log(`[Screenshot] Saved Poll chart -> ${pollPath} (${pollBuf.length} bytes)`);

  // 2. Capture Browser Pages via CDP
  const browserPath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(browserPath)) {
    console.warn("[Screenshot] Chrome not found at default location. Skipping browser captures.");
    return 0;
  }

  const tmpDir = path.join(os.tmpdir(), "chrome_screenshots_" + Date.now());
  const browser = spawn(browserPath, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1280,800",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tmpDir}`,
    "about:blank",
  ]);

  try {
    const wsUrl = await getWsUrl(PORT);
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));

    await sendCdpCommand(ws, "Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    let staticServer = null;
    try {
      staticServer = http.createServer((req, res) => {
        let reqPath = decodeURIComponent(req.url.split("?")[0]);
        if (reqPath === "/") reqPath = "/index.html";

        let filePath;
        if (reqPath.startsWith("/src/")) {
          filePath = path.join(__dirname, "../dashboard", reqPath);
        } else if (reqPath.startsWith("/assets/")) {
          filePath = path.join(__dirname, "..", reqPath);
        } else {
          filePath = path.join(__dirname, "../dashboard/public", reqPath);
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeMap = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "text/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".woff2": "font/woff2",
            ".ttf": "font/ttf",
          };
          res.writeHead(200, { "Content-Type": mimeMap[ext] || "application/octet-stream" });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
      });

      await new Promise((resolve) => staticServer.listen(9228, "127.0.0.1", resolve));

      const pages = [
        {
          name: "Remote Web Player",
          file: "http://127.0.0.1:9228/player.html",
          dest: path.join(TARGET_DIR, "screenshot_player.png"),
        },
        {
          name: "Soundboard Studio",
          file: "http://127.0.0.1:9228/soundboard.html",
          dest: path.join(TARGET_DIR, "screenshot_soundboard.png"),
        },
        {
          name: "Visual Automod Studio",
          file: "http://127.0.0.1:9228/automod.html",
          dest: path.join(TARGET_DIR, "screenshot_automod.png"),
        },
      ];

      for (const p of pages) {
        await captureWebPage(ws, p.file, p.dest, p.name);
      }

      ws.close();
      console.log("[Screenshot] Semua 5 visual render & screenshot sukses tersimpan di artifact directory!");
    } finally {
      if (staticServer) {
        try { staticServer.close(); } catch {}
      }
    }
  } catch (err) {
    console.error("[Screenshot Error]:", err.message);
  } finally {
    browser.kill("SIGKILL");
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    if (typeof canvasWorkerPool.shutdown === "function") {
      await canvasWorkerPool.shutdown();
    }
  }

  return 0;
}

main().then((code) => {
  process.exit(code || 0);
});
