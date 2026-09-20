const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

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
      if (attempts > 30)
        return reject(new Error("Chrome debug port not ready"));
      setTimeout(check, 200);
    };
    check();
  });
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
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" +
      require("os").tmpdir() +
      "\\chrome_verify_profile_" +
      Date.now(),
    "about:blank",
  ]);

  try {
    const wsUrl = await getWsUrl();
    console.log("Connected to Chrome via CDP:", wsUrl);

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
    send("Console.enable");
    send("Network.enable");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === "Runtime.consoleAPICalled") {
        const text = data.params.args
          .map((a) => a.value || a.description || JSON.stringify(a))
          .join(" ");
        console.log(
          `[BROWSER CONSOLE ${data.params.type.toUpperCase()}]`,
          text,
        );
      } else if (data.method === "Runtime.exceptionThrown") {
        const det = data.params.exceptionDetails;
        console.error(
          "[BROWSER EXCEPTION]",
          det.text,
          det.exception?.description || "",
          `at ${det.url}:${det.lineNumber}:${det.columnNumber}`
        );
      }
    };

    const targetUrl = process.env.DASHBOARD_URL || "http://localhost:19130/";
    console.log(`Navigating to ${targetUrl} ...`);
    send("Page.navigate", { url: targetUrl });

    console.log("Menunggu model 3D dimuat di dashboard...");
    let isLoaded = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      const checkMsgId = send("Runtime.evaluate", {
        expression:
          "Boolean(window.__heroViewer && window.__heroViewer.isLoaded)",
        returnByValue: true,
      });
      const checkRes = await new Promise((resolve) => {
        const handler = (evt) => {
          const d = JSON.parse(evt.data);
          if (d.id === checkMsgId) {
            ws.removeEventListener("message", handler);
            resolve(d.result?.result?.value);
          }
        };
        ws.addEventListener("message", handler);
      });
      if (checkRes) {
        isLoaded = true;
        console.log(
          `✨ Model 3D terkonfirmasi isLoaded === true pada detik ke-${attempt + 1}!`,
        );
        break;
      }
    }

    if (!isLoaded) {
      console.warn(
        "⚠️ Waktu tunggu pemuatan model habis sebelum isLoaded bernilai true.",
      );
    }

    // Jeda 2 detik agar frame render berjalan lancar
    await new Promise((r) => setTimeout(r, 2000));

    // Memicu animasi Ceria (Cheers) untuk verifikasi visual gerakan kedua lengan & proteksi rok
    send("Runtime.evaluate", {
      expression: `(() => {
        if (window.__heroViewer) {
          window.__heroViewer.playAnimation("Cheers");
          if (window.__heroViewer.particles) {
            window.__heroViewer.particles.burst(40);
          }
        }
      })()`,
    });

    // Jeda 1.5 detik saat pose dan bintang memancar
    await new Promise((r) => setTimeout(r, 1500));

    // Evaluasi status Three.js scene
    const evalMsgId = send("Runtime.evaluate", {
      expression: `(() => {
        const hv = window.__heroViewer;
        if (!hv) return { error: "No __heroViewer" };
        return {
          isLoaded: hv.isLoaded,
          hasScene: Boolean(hv.scene),
          hasCamera: Boolean(hv.camera),
          hasModelGroup: Boolean(hv.modelGroup),
          hasBrand3d: Boolean(hv.brand3d),
          brandFxVisible: Boolean(hv.brandFxVisible),
          currentAnim: hv.currentAnimName,
          modelChildren: hv.modelGroup ? hv.modelGroup.children.length : 0,
          renderCalls: hv.renderer ? hv.renderer.info.render.calls : 0,
          renderTriangles: hv.renderer ? hv.renderer.info.render.triangles : 0,
          cameraPos: hv.camera ? { x: hv.camera.position.x, y: hv.camera.position.y, z: hv.camera.position.z } : null
        };
      })()`,
      returnByValue: true,
    });

    const evalData = await new Promise((resolve) => {
      const handler = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === evalMsgId) {
          ws.removeEventListener("message", handler);
          resolve(d.result?.result?.value);
        }
      };
      ws.addEventListener("message", handler);
    });
    console.log("=== THREE.JS VIEWER METRICS ===");
    console.log(JSON.stringify(evalData, null, 2));

    // Capture screenshot
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
      const targetPath =
        process.env.SCREENSHOT_OUT_PATH ||
        require("path").join(__dirname, "../dashboard/public/verified_3d_render.png");
      fs.writeFileSync(targetPath, Buffer.from(screenshotData, "base64"));
      console.log("✨ Screenshot final berhasil disimpan ke:", targetPath);
    }

    ws.close();
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    chrome.kill();
    console.log("Selesai verifikasi browser.");
  }
}

main();
