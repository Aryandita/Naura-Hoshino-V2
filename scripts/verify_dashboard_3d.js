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
  const chromePath =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
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
        console.error(
          "[BROWSER EXCEPTION]",
          data.params.exceptionDetails.text,
          data.params.exceptionDetails.exception?.description || "",
        );
      }
    };

    console.log("Navigating to http://localhost:4173/ ...");
    send("Page.navigate", { url: "http://localhost:4173/" });

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
        "C:\\Users\\ACER\\.gemini\\antigravity-ide\\brain\\adb93312-43ae-418d-97c6-3c25049a0c2c\\verified_3d_render.png";
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
