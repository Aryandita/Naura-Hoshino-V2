"use strict";

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ARTIFACT_DIR = "C:\\Users\\ACER\\.gemini\\antigravity-ide\\brain\\a7fbca15-64b7-46e8-b4db-16990c191e6b";

async function getWsUrl() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http
        .get("http://127.0.0.1:9222/json/list", (res) => {
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
            } catch (e) {
              retry();
            }
          });
        })
        .on("error", retry);
    };
    const retry = () => {
      attempts++;
      if (attempts > 30) return reject(new Error("Chrome debug port not ready"));
      setTimeout(check, 200);
    };
    check();
  });
}

async function captureUrl(ws, send, url, outPath, waitMs = 3000, actionFn = null) {
  console.log(`[CDP] Navigasi ke ${url} ...`);
  send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, waitMs));

  if (actionFn) {
    await actionFn();
  }

  const shotMsgId = send("Page.captureScreenshot", { format: "png" });
  const screenshotData = await new Promise((resolve) => {
    const handler = (evt) => {
      const d = JSON.parse(evt.data);
      if (d.id === shotMsgId) {
        ws.removeEventListener("message", handler);
        resolve(d.result.data);
      }
    };
    ws.addEventListener("message", handler);
  });

  if (screenshotData) {
    fs.writeFileSync(outPath, Buffer.from(screenshotData, "base64"));
    console.log(`[CDP] Screenshot tersimpan: ${outPath}`);
  }
}

async function waitForHeroViewer(ws, send, maxWaitMs = 25000) {
  const start = Date.now();
  console.log("[CDP] Menunggu model 3D Hero Viewer selesai dimuat...");
  while (Date.now() - start < maxWaitMs) {
    const evalId = send("Runtime.evaluate", {
      expression: "Boolean(window.__heroViewer && window.__heroViewer.isLoaded)",
      returnByValue: true,
    });
    const res = await new Promise((resolve) => {
      const handler = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === evalId) {
          ws.removeEventListener("message", handler);
          resolve(d.result?.result?.value);
        }
      };
      ws.addEventListener("message", handler);
    });
    if (res === true) {
      console.log(`[CDP] Model 3D Hero Viewer termuat dalam ${Date.now() - start}ms!`);
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn("[CDP] Timeout menunggu model 3D Hero Viewer.");
  return false;
}

async function main() {
  const defaultPaths = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  const chromePath = defaultPaths.find((p) => fs.existsSync(p)) || defaultPaths[0];
  console.log("[CDP] Menggunakan browser:", chromePath);

  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" +
      require("os").tmpdir() +
      "\\chrome_preview_profile_" +
      Date.now(),
    "about:blank",
  ]);

  try {
    const wsUrl = await getWsUrl();
    console.log("[CDP] Terkoneksi ke Chrome CDP:", wsUrl);

    const ws = new globalThis.WebSocket(wsUrl);
    let id = 1;
    const send = (method, params = {}) => {
      const msgId = id++;
      ws.send(JSON.stringify({ id: msgId, method, params }));
      return msgId;
    };

    await new Promise((r) => (ws.onopen = r));

    send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    send("Runtime.enable");
    send("Page.enable");

    // 1. Dashboard Utama (Tunggu 3D Hero Avatar selesai termuat)
    const mainDashPath = path.join(ARTIFACT_DIR, "main_dashboard_preview.png");
    console.log("[CDP] Mengambil pratinjau Dashboard Utama...");
    send("Page.navigate", { url: "http://localhost:19130/" });
    await new Promise((r) => setTimeout(r, 2000));
    await waitForHeroViewer(ws, send, 25000);
    const shotMsgId1 = send("Page.captureScreenshot", { format: "png" });
    const shotData1 = await new Promise((resolve) => {
      const handler = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === shotMsgId1) {
          ws.removeEventListener("message", handler);
          resolve(d.result.data);
        }
      };
      ws.addEventListener("message", handler);
    });
    if (shotData1) {
      fs.writeFileSync(mainDashPath, Buffer.from(shotData1, "base64"));
      console.log(`[CDP] Dashboard utama tersimpan: ${mainDashPath}`);
    }

    // 2. World Map (Desa Khul'Khas Salju di puncak es kanan atas & Istana Draken di kawah magma kanan bawah)
    const worldImgPath = path.join(ARTIFACT_DIR, "world_map_preview.png");
    await captureUrl(ws, send, "http://localhost:19130/world", worldImgPath, 3500);

    // 3. World Map dengan Intel Drawer (klik Desa Khul'Khas Salju)
    const intelImgPath = path.join(ARTIFACT_DIR, "world_intel_drawer_preview.png");
    await captureUrl(ws, send, "http://localhost:19130/world", intelImgPath, 2500, async () => {
      send("Runtime.evaluate", {
        expression: `(() => {
          const khulkhasNode = document.getElementById('node-khulkhas') || document.querySelector('[data-zone="desa_khulkhas"]');
          if (khulkhasNode) khulkhasNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        })()`,
      });
      await new Promise((r) => setTimeout(r, 1200));
    });

    // 4. Survival Radar: Desa Sukamaju (Lembah Pinus & Tambang)
    const radarSukamajuPath = path.join(ARTIFACT_DIR, "survival_radar_sukamaju.png");
    await captureUrl(ws, send, "http://localhost:19130/survival-map", radarSukamajuPath, 3000);

    // 5. Survival Radar: Kota Pratama (Cyberpunk Metropolitan HUD)
    const radarPratamaPath = path.join(ARTIFACT_DIR, "survival_radar_pratama.png");
    await captureUrl(ws, send, "http://localhost:19130/survival-map", radarPratamaPath, 2000, async () => {
      send("Runtime.evaluate", {
        expression: `(() => {
          const tabPratama = document.getElementById('tabPratama');
          if (tabPratama) tabPratama.click();
        })()`,
      });
      await new Promise((r) => setTimeout(r, 1500));
    });

    // 6. Survival Radar: Desa Khul'Khas (Tundra Pegunungan Salju Es)
    const radarKhulkhasPath = path.join(ARTIFACT_DIR, "survival_radar_khulkhas.png");
    await captureUrl(ws, send, "http://localhost:19130/survival-map", radarKhulkhasPath, 2000, async () => {
      send("Runtime.evaluate", {
        expression: `(() => {
          const tabKhulkhas = document.getElementById('tabKhulkhas');
          if (tabKhulkhas) tabKhulkhas.click();
        })()`,
      });
      await new Promise((r) => setTimeout(r, 1500));
    });

    // 7. Survival Radar: Istana Draken (Magma Abyss Dungeon)
    const radarDrakenPath = path.join(ARTIFACT_DIR, "survival_radar_draken.png");
    await captureUrl(ws, send, "http://localhost:19130/survival-map", radarDrakenPath, 2000, async () => {
      send("Runtime.evaluate", {
        expression: `(() => {
          const tabDraken = document.getElementById('tabDraken');
          if (tabDraken) tabDraken.click();
        })()`,
      });
      await new Promise((r) => setTimeout(r, 1500));
    });

    ws.close();
    console.log("Semua tangkapan layar preview berhasil dihasilkan!");
  } catch (err) {
    console.error("Gagal menangkap preview:", err);
  } finally {
    chrome.kill();
  }
}

main();
