"use strict";

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const OUTPUT_DIR = path.join(
  "C:\\Users\\ACER\\.gemini\\antigravity-ide\\brain\\78c3a4ac-d68d-4cea-81d1-6ed1db3fc550\\scratch\\screenshots"
);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getWsUrl(port = 9222) {
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
      if (attempts > 35) return reject(new Error("Chrome debug port not ready"));
      setTimeout(check, 200);
    };
    check();
  });
}

async function auditPages() {
  const defaultPaths = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  const chromePath = defaultPaths.find((p) => fs.existsSync(p)) || defaultPaths[0];
  console.log("Using browser at:", chromePath);

  const debugPort = 9223;
  const tempProfile = path.join(os.tmpdir(), "chrome_audit_" + Date.now());

  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tempProfile}`,
    "about:blank",
  ]);

  try {
    const wsUrl = await getWsUrl(debugPort);
    console.log("Connected to browser CDP:", wsUrl);

    const ws = new globalThis.WebSocket(wsUrl);

    let id = 1;
    const send = (method, params = {}) => {
      const msgId = id++;
      ws.send(JSON.stringify({ id: msgId, method, params }));
      return msgId;
    };

    const callCdp = (method, params = {}) => {
      return new Promise((resolve) => {
        const msgId = send(method, params);
        const handler = (evt) => {
          const d = JSON.parse(evt.data);
          if (d.id === msgId) {
            ws.removeEventListener("message", handler);
            resolve(d.result);
          }
        };
        ws.addEventListener("message", handler);
      });
    };

    await new Promise((r) => (ws.onopen = r));

    await callCdp("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await callCdp("Runtime.enable");
    await callCdp("Page.enable");

    const auditTargets = [
      { name: "01_homepage_overview", path: "/" },
      { name: "02_profile_guest_mode", path: "/profile" },
      { name: "03_inventory_backpack", path: "/inventory" },
      { name: "04_settings_sandbox", path: "/settings" },
      { name: "05_automations_hub", path: "/automations" },
      { name: "06_portfolio_showcase", path: "/portfolio" },
      { name: "07_welcomer_studio", path: "/welcomer" },
      { name: "08_tickets_support", path: "/tickets" },
      { name: "09_music_hub", path: "/music" },
      { name: "10_admin_god_mode", path: "/admin" },
    ];

    const results = [];

    for (const target of auditTargets) {
      const url = `http://localhost:19130${target.path}`;
      console.log(`\nAuditing: ${target.name} (${url})`);

      await callCdp("Page.navigate", { url });
      
      // Tunggu page load & scripts execution (poll hingga banner muncul atau max 3.5 detik)
      const startTime = Date.now();
      while (Date.now() - startTime < 3500) {
        await new Promise((r) => setTimeout(r, 400));
        const check = await callCdp("Runtime.evaluate", {
          expression: `Boolean(document.getElementById("nauraAuthTrustBanner"))`,
          returnByValue: true,
        });
        if (check.result?.value) {
          break;
        }
      }

      const pageState = await callCdp("Runtime.evaluate", {
        expression: `(() => {
          const banner = document.getElementById("nauraAuthTrustBanner");
          const title = document.title;
          const currentUrl = window.location.href;
          const bodyOverflow = window.getComputedStyle(document.body).overflow;
          const bannerVisible = banner ? Boolean(banner.offsetWidth || banner.offsetHeight) : false;
          const bannerText = banner ? banner.innerText.slice(0, 160) : null;
          const hasBrokenImages = Array.from(document.querySelectorAll("img")).some(img => !img.complete || img.naturalWidth === 0);

          return {
            title,
            currentUrl,
            hasBanner: Boolean(banner),
            bannerVisible,
            bannerText,
            hasBrokenImages,
            bodyOverflow,
          };
        })()`,
        returnByValue: true,
      });

      console.log("Page State:", pageState.result?.value);

      // Ambil screenshot
      const shot = await callCdp("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });

      const shotPath = path.join(OUTPUT_DIR, `${target.name}.png`);
      fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
      console.log(`Saved screenshot -> ${shotPath}`);

      results.push({
        name: target.name,
        path: target.path,
        state: pageState.result?.value,
        screenshot: shotPath,
      });
    }

    ws.close();
    console.log("\nAudit selesai dengan sukses!");
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "audit_summary.json"),
      JSON.stringify(results, null, 2)
    );
  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    chrome.kill();
  }
}

auditPages();
