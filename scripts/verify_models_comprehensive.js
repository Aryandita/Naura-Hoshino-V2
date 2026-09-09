"use strict";

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const artifactDir = "C:\\Users\\ACER\\.gemini\\antigravity-ide\\brain\\ae11202e-a99d-4260-baea-3403be8972cd";

function waitForHttp(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve();
          } else {
            retry();
          }
        })
        .on("error", retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout menunggu ${url}`));
      }
      setTimeout(check, 300);
    };
    check();
  });
}

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
      if (attempts > 35) {
        return reject(new Error("Chrome debug port 9222 not ready"));
      }
      setTimeout(check, 200);
    };
    check();
  });
}

async function main() {
  // 1. Jalankan preview server
  console.log("Menjalankan preview server di background...");
  const server = spawn("node", ["scripts/preview-server.js"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
  });

  server.stdout.on("data", (d) => process.stdout.write(`[SERVER] ${d}`));
  server.stderr.on("data", (d) => process.stderr.write(`[SERVER ERR] ${d}`));

  console.log("Menunggu preview server siap di http://localhost:3000/ ...");
  await waitForHttp("http://localhost:3000/");
  console.log("Preview server siap!");

  // 2. Jalankan Headless Chrome
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const profileDir = path.join(require("os").tmpdir(), `chrome_test_3d_${Date.now()}`);
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ]);

  try {
    const wsUrl = await getWsUrl();
    console.log("Tersambung ke Chrome CDP:", wsUrl);

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
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await callCdp("Runtime.enable");
    await callCdp("Page.enable");
    await callCdp("Console.enable");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === "Runtime.consoleAPICalled") {
        const text = data.params.args
          .map((a) => a.value || a.description || JSON.stringify(a))
          .join(" ");
        console.log(`[BROWSER CONSOLE]`, text);
      } else if (data.method === "Runtime.exceptionThrown") {
        console.error(
          "[BROWSER EXCEPTION]",
          data.params.exceptionDetails.text,
          data.params.exceptionDetails.exception?.description || ""
        );
      }
    };

    console.log("Navigasi ke http://localhost:3000/ ...");
    await callCdp("Page.navigate", { url: "http://localhost:3000/" });

    // Tunggu model awal (GLB) dimuat
    console.log("Menunggu model awal (GLB) dimuat...");
    let isGlbLoaded = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await callCdp("Runtime.evaluate", {
        expression: "Boolean(window.__heroViewer && window.__heroViewer.isLoaded)",
        returnByValue: true,
      });
      if (res?.result?.value) {
        isGlbLoaded = true;
        console.log(`✨ GLB Model terverifikasi aktif pada detik ke-${i + 1}!`);
        break;
      }
    }

    if (!isGlbLoaded) {
      // Periksa status canvas dan elemen
      const checkDom = await callCdp("Runtime.evaluate", {
        expression: `(() => {
          return {
            hasCanvas: Boolean(document.getElementById("naura-hero-3d-canvas")),
            hasViewer: Boolean(window.__heroViewer),
            viewerLoading: window.__heroViewer ? window.__heroViewer.isLoadingModel : false,
            viewerError: Boolean(document.getElementById("naura3d-error")?.offsetParent)
          };
        })()`,
        returnByValue: true,
      });
      console.error("DOM Debug info:", checkDom?.result?.value);
      throw new Error("GLB model gagal dimuat dalam batas waktu.");
    }

    // Ambil screenshot viewport
    const captureScreenshot = async (filename) => {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await callCdp("Page.captureScreenshot", { format: "png" });
      if (res && res.data) {
        const filePath = path.join(artifactDir, filename);
        fs.writeFileSync(filePath, Buffer.from(res.data, "base64"));
        console.log(`📸 Screenshot tersimpan: ${filename}`);
        return filePath;
      }
      return null;
    };

    // 1. Screenshot GLB: Idle
    console.log("Mengambil render GLB (Idle)...");
    await captureScreenshot("screenshot_glb_idle.png");

    // 2. Mainkan Animasi Wave pada GLB
    console.log("Memicu animasi Wave pada GLB...");
    await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('.naura3d-anim-btn[data-anim="Wave"]');
        if (btn) btn.click();
        else window.__heroViewer.playAnimation("Wave", { loop: true });
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));
    await captureScreenshot("screenshot_glb_wave.png");

    // 3. Mainkan Animasi Thinking pada GLB
    console.log("Memicu animasi Thinking pada GLB...");
    await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('.naura3d-anim-btn[data-anim="Thinking"]');
        if (btn) btn.click();
        else window.__heroViewer.playAnimation("Thinking", { loop: true });
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));
    await captureScreenshot("screenshot_glb_thinking.png");

    // 4. Mainkan Animasi Cheers pada GLB
    console.log("Memicu animasi Cheers pada GLB...");
    await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('.naura3d-anim-btn[data-anim="Cheers"]');
        if (btn) btn.click();
        else window.__heroViewer.playAnimation("Cheers", { loop: true });
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));
    await captureScreenshot("screenshot_glb_cheers.png");

    // 5. Beralih ke Model VRM
    console.log("Beralih ke model VRM (/models/naura.vrm)...");
    await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const vrmBtn = document.getElementById("btn-model-vrm");
        if (vrmBtn) vrmBtn.click();
        else window.__heroViewer.switchModel("/models/naura.vrm");
      })()`,
    });

    // Tunggu VRM dimuat
    let isVrmLoaded = false;
    for (let i = 0; i < 35; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await callCdp("Runtime.evaluate", {
        expression: "Boolean(window.__heroViewer && window.__heroViewer.isLoaded && window.__heroViewer.vrm)",
        returnByValue: true,
      });
      if (res?.result?.value) {
        isVrmLoaded = true;
        console.log(`✨ VRM Model terverifikasi aktif pada detik ke-${i + 1}!`);
        break;
      }
    }

    if (!isVrmLoaded) {
      const checkGen = await callCdp("Runtime.evaluate", {
        expression: "Boolean(window.__heroViewer && window.__heroViewer.isLoaded)",
        returnByValue: true,
      });
      console.log("General isLoaded status:", checkGen?.result?.value);
    }

    // 6. Screenshot VRM: Idle
    console.log("Mengambil render VRM (Idle)...");
    await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const idleBtn = document.querySelector('.naura3d-anim-btn[data-anim="Idle"]');
        if (idleBtn) idleBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1000));
    await captureScreenshot("screenshot_vrm_idle.png");

    // 7. Screenshot VRM: Wave
    console.log("Memicu animasi Wave pada VRM...");
    await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('.naura3d-anim-btn[data-anim="Wave"]');
        if (btn) btn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));
    await captureScreenshot("screenshot_vrm_wave.png");

    // 8. Screenshot VRM: BlowKiss
    console.log("Memicu animasi BlowKiss pada VRM...");
    await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('.naura3d-anim-btn[data-anim="BlowKiss"]');
        if (btn) btn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));
    await captureScreenshot("screenshot_vrm_blowkiss.png");

    // Dapatkan metrik render final
    const finalMetrics = await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const hv = window.__heroViewer;
        return {
          currentAnim: hv.currentAnimName,
          currentMood: hv.currentMood,
          isLoaded: hv.isLoaded,
          modelPath: hv.options.modelPath,
          hasVrm: Boolean(hv.vrm),
          triangles: hv.renderer ? hv.renderer.info.render.triangles : 0,
          fpsCalls: hv.renderer ? hv.renderer.info.render.calls : 0
        };
      })()`,
      returnByValue: true,
    });
    console.log("=== FINAL 3D RENDER METRICS ===");
    console.log(JSON.stringify(finalMetrics?.result?.value, null, 2));

    ws.close();
  } finally {
    chrome.kill();
    server.kill();
    console.log("Chrome dan server dimatikan. Verifikasi selesai.");
  }
}

main().catch((err) => {
  console.error("Kesalahan utama verifikasi:", err);
  process.exit(1);
});
