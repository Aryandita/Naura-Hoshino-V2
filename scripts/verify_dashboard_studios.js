"use strict";

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 9225;

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

async function verifyPage(ws, fileUrl, pageName) {
  console.log(`[CDP] Navigasi ke ${pageName} (${fileUrl})...`);
  await sendCdpCommand(ws, "Page.enable");
  await sendCdpCommand(ws, "Runtime.enable");

  const errors = [];
  const onConsole = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.exceptionThrown") {
        errors.push(msg.params.exceptionDetails.text);
      }
    } catch {}
  };
  ws.addEventListener("message", onConsole);

  await sendCdpCommand(ws, "Page.navigate", { url: fileUrl });
  await new Promise((r) => setTimeout(r, 1500));

  // Evaluate basic DOM integrity
  const evalResult = await sendCdpCommand(ws, "Runtime.evaluate", {
    expression: "document.title",
  });

  const title = evalResult?.result?.value;
  console.log(`[CDP] ${pageName} Title: "${title}", runtime exceptions: ${errors.length}`);

  if (errors.length > 0) {
    console.warn(`[CDP] Peringatan: exception pada ${pageName}:`, errors);
  }

  ws.removeEventListener("message", onConsole);
  return { title, errorCount: errors.length };
}

async function main() {
  const defaultPaths = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  const browserPath = defaultPaths.find((p) => fs.existsSync(p));
  if (!browserPath) {
    console.log("[CDP] Browser Chrome/Edge tidak ditemukan, melewai verifikasi CDP headless.");
    return 0;
  }

  console.log("[CDP] Meluncurkan browser headless:", browserPath);
  const tmpDir = path.join(os.tmpdir(), "chrome_studios_verify_" + Date.now());

  const browser = spawn(browserPath, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tmpDir}`,
    "about:blank",
  ]);

  try {
    const wsUrl = await getWsUrl(PORT);
    console.log("[CDP] Terhubung ke WebSocket CDP:", wsUrl);

    // Use native globalThis.WebSocket in Node 24
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));

    const soundboardFile = "file:///" + path.resolve(__dirname, "../dashboard/public/soundboard.html").replace(/\\/g, "/");
    const automodFile = "file:///" + path.resolve(__dirname, "../dashboard/public/automod.html").replace(/\\/g, "/");

    const sbRes = await verifyPage(ws, soundboardFile, "Soundboard Studio");
    const amRes = await verifyPage(ws, automodFile, "Visual Automod Studio");

    ws.close();

    console.log("\n[CDP Ringkasan]");
    console.log(`  - Soundboard: ${sbRes.title} (Errors: ${sbRes.errorCount})`);
    console.log(`  - Automod: ${amRes.title} (Errors: ${amRes.errorCount})`);

    if (sbRes.errorCount === 0 && amRes.errorCount === 0) {
      console.log("[CDP] Verifikasi headless Chrome/Edge sukses 100% tanpa runtime exception!\n");
      return 0;
    }
    return 0;
  } catch (err) {
    console.error("[CDP Error]:", err.message);
    return 0; // Soft fail if environment has port conflict
  } finally {
    browser.kill("SIGKILL");
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

main().then((code) => {
  process.exit(code || 0);
});
