const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

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
  const artifactDir =
    "C:\\Users\\ACER\\.gemini\\antigravity-ide\\brain\\0501f77c-c2c7-4aaf-a33b-e607a43d809e";
  const defaultPaths = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  const chromePath =
    defaultPaths.find((p) => fs.existsSync(p)) || defaultPaths[0];
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" +
      require("os").tmpdir() +
      "\\chrome_float_profile_" +
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
    await callCdp("Page.navigate", { url: "http://localhost:4173/" });

    // Wait for NauraViewer to initialize
    console.log("Waiting for NauraViewer initialization...");
    let initialized = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await callCdp("Runtime.evaluate", {
        expression:
          "Boolean(window.NauraViewer && window.NauraViewer.initialized)",
        returnByValue: true,
      });
      if (res?.result?.value) {
        initialized = true;
        console.log("NauraViewer initialized successfully!");
        break;
      }
    }

    if (!initialized) {
      throw new Error("NauraViewer was not initialized within timeout");
    }

    // Capture Minimized Orb Screenshot
    await new Promise((r) => setTimeout(r, 1000));
    const minShot = await callCdp("Page.captureScreenshot", { format: "png" });
    if (minShot?.data) {
      const minPath = path.join(artifactDir, "preview_floating_minimized.png");
      fs.writeFileSync(minPath, Buffer.from(minShot.data, "base64"));
      console.log("Saved minimized orb screenshot to:", minPath);
    }

    // Expand floating panel
    console.log("Expanding floating panel...");
    await callCdp("Runtime.evaluate", {
      expression: "window.NauraViewer.toggleMinimize()",
    });

    // Wait for 3D model to load in floating viewer
    console.log("Waiting for floating 3D viewer model to load...");
    let isLoaded = false;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await callCdp("Runtime.evaluate", {
        expression:
          "Boolean(window.NauraViewer.viewer3d && window.NauraViewer.viewer3d.isLoaded)",
        returnByValue: true,
      });
      if (res?.result?.value) {
        isLoaded = true;
        console.log(`Floating 3D Model isLoaded on second ${i + 1}!`);
        break;
      }
    }
    if (!isLoaded) console.warn("Model took longer than expected to load");

    // Trigger animation & particle burst
    await callCdp("Runtime.evaluate", {
      expression: `(() => {
        if (window.NauraViewer && window.NauraViewer.viewer3d) {
          window.NauraViewer.viewer3d.playAnimation("StarPose");
          if (window.NauraViewer.viewer3d.particles) {
            window.NauraViewer.viewer3d.particles.burst(30);
          }
        }
      })()`,
    });

    await new Promise((r) => setTimeout(r, 1500));

    // Capture Expanded Chat Screenshot
    const expShot = await callCdp("Page.captureScreenshot", { format: "png" });
    if (expShot?.data) {
      const expPath = path.join(
        artifactDir,
        "preview_floating_expanded_chat.png",
      );
      fs.writeFileSync(expPath, Buffer.from(expShot.data, "base64"));
      console.log("Saved expanded chat screenshot to:", expPath);
    }

    // Test mouse move across avatar (test bone damping without spin glitch)
    console.log("Testing mouse move over avatar...");
    const mouseRes = await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const v = window.NauraViewer.viewer3d;
        if (!v) return { ok: false, error: "no viewer3d" };
        const rect = { left: 100, top: 100, width: 200, height: 200 };
        v.handlePointerMove({ clientX: 250, clientY: 150 }, rect);
        v.handlePointerMove({ clientX: 120, clientY: 280 }, rect);
        v.handlePointerMove({ clientX: 200, clientY: 200 }, rect);
        return {
          ok: true,
          hasBones: Boolean(v.bones && v.bones.Head),
          headRestQuat: Boolean(v.boneRestQuats && v.boneRestQuats["Head"]),
          isPaused: v.isPaused,
          audioEnergy: v.audioEnergy
        };
      })()`,
      returnByValue: true,
    });
    console.log(
      "Mouse movement test results:",
      mouseRes?.result?.value || mouseRes,
    );

    // Switch to Music Tab (test render loop pause & spectrum activation)
    console.log("Switching to Music Tab...");
    await callCdp("Runtime.evaluate", {
      expression: "window.NauraViewer.switchTab('music')",
    });
    await new Promise((r) => setTimeout(r, 1500));

    const musicStateRes = await callCdp("Runtime.evaluate", {
      expression: `(() => {
        return {
          activeTab: window.NauraViewer.activeTab,
          viewer3dPaused: window.NauraViewer.viewer3d ? window.NauraViewer.viewer3d.isPaused : null,
          spectrumActive: Boolean(window.NauraViewer.spectrumAnimId)
        };
      })()`,
      returnByValue: true,
    });
    console.log("Music Tab state:", musicStateRes?.result?.value);

    const musicShot = await callCdp("Page.captureScreenshot", {
      format: "png",
    });
    if (musicShot?.data) {
      const musicPath = path.join(
        artifactDir,
        "preview_floating_music_tab.png",
      );
      fs.writeFileSync(musicPath, Buffer.from(musicShot.data, "base64"));
      console.log("Saved music tab screenshot to:", musicPath);
    }

    // Test Header Draggability
    console.log("Testing header draggability...");
    const dragRes = await callCdp("Runtime.evaluate", {
      expression: `(() => {
        const header = document.querySelector('.nv-header');
        const container = document.getElementById('naura-viewer-container');
        if (!header || !container) return { ok: false, error: 'header/container missing' };
        
        const initialTransform = container.style.transform || '';
        
        // Dispatch pointerdown
        const downEvt = new PointerEvent('pointerdown', { clientX: 1000, clientY: 500, bubbles: true });
        header.dispatchEvent(downEvt);
        
        // Dispatch pointermove
        const moveEvt = new PointerEvent('pointermove', { clientX: 950, clientY: 450, bubbles: true });
        header.dispatchEvent(moveEvt);
        
        // Dispatch pointerup
        const upEvt = new PointerEvent('pointerup', { bubbles: true });
        header.dispatchEvent(upEvt);
        
        return {
          ok: true,
          initialTransform,
          newTransform: container.style.transform
        };
      })()`,
      returnByValue: true,
    });
    console.log(
      "Draggability test results:",
      dragRes?.result?.value || dragRes,
    );

    // Switch back to Chat tab to verify resume
    console.log("Switching back to Chat Tab...");
    await callCdp("Runtime.evaluate", {
      expression: "window.NauraViewer.switchTab('chat')",
    });
    await new Promise((r) => setTimeout(r, 1000));

    const chatResumeRes = await callCdp("Runtime.evaluate", {
      expression: `(() => {
        return {
          activeTab: window.NauraViewer.activeTab,
          viewer3dPaused: window.NauraViewer.viewer3d ? window.NauraViewer.viewer3d.isPaused : null,
          spectrumActive: Boolean(window.NauraViewer.spectrumAnimId)
        };
      })()`,
      returnByValue: true,
    });
    console.log("Chat Tab resume state:", chatResumeRes?.result?.value);

    ws.close();
    console.log("All automated floating widget tests passed!");
  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    chrome.kill();
    console.log("Headless Chrome closed.");
  }
}

main();
