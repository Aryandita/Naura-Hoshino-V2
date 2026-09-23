"use strict";

/**
 * preview-3d.js - Standalone 3D Avatar Inspector & WebGL Studio
 * Server ringan untuk memeriksa avatar 3D Naura Hoshino (.vrm / .glb),
 * artikulasi blendshapes (Joy, Fun, Sorrow, Viseme fonem), dan spring bones secara visual di browser.
 *
 * Penggunaan:
 *   node scripts/preview-3d.js
 *   npm run preview:3d
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");

const app = express();
const PORT = parseInt(process.env.PREVIEW_3D_PORT, 10) || 3030;
const projectRoot = path.resolve(__dirname, "..");
const assets3D = path.join(projectRoot, "assets", "3D Model Naura");
const publicModels = path.join(projectRoot, "dashboard", "public", "models");

// 1. Static file serving untuk Model 3D
const handleModel = (req, res) => {
  const isVrm = req.path.toLowerCase().endsWith(".vrm");
  const filename = isVrm ? "naura.vrm" : "naura.glb";
  const candidates = [
    path.join(publicModels, filename),
    path.join(assets3D, filename),
    path.join(assets3D, "Naura Hoshino 3D.glb"),
  ];

  for (const f of candidates) {
    if (fs.existsSync(f)) {
      res.setHeader("Content-Type", "model/gltf-binary");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.sendFile(f);
    }
  }
  res.status(404).send("Berkas model 3D tidak ditemukan");
};

app.get(
  [
    "/models/naura.vrm",
    "/models/naura.glb",
    "/models/Naura%20Hoshino%203D.glb",
  ],
  handleModel,
);

// 2. Halaman Studio HTML Standalone
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Naura Hoshino 3D Avatar Studio & Inspector</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f0c15;
      color: #e2e8f0;
      overflow: hidden;
      display: flex;
      height: 100vh;
    }
    #viewport {
      flex: 1;
      height: 100%;
      position: relative;
    }
    #canvas-container {
      width: 100%;
      height: 100%;
    }
    #loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 12, 21, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      z-index: 50;
      font-weight: 500;
      color: #ff9ebb;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255, 158, 187, 0.2);
      border-top-color: #ff9ebb;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #sidebar {
      width: 340px;
      height: 100%;
      background: #181322;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 20px;
      gap: 20px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .btn-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    button {
      background: #231b32;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #f1f5f9;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:hover {
      background: #ff9ebb;
      color: #181322;
      border-color: #ff9ebb;
      font-weight: 600;
    }
    .slider-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }
    .slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #cbd5e1;
    }
    input[type="range"] {
      width: 100%;
      accent-color: #ff9ebb;
    }
    .info-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 12px;
      font-size: 12px;
      line-height: 1.6;
    }
    .info-card b { color: #ff9ebb; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.177.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.177.0/examples/jsm/",
        "@pixiv/three-vrm": "https://unpkg.com/@pixiv/three-vrm@3.4.0/lib/three-vrm.module.js"
      }
    }
  </script>
</head>
<body>
  <div id="viewport">
    <div id="loading-overlay">
      <div class="spinner"></div>
      <div id="loading-text">Memuat Model 3D Naura...</div>
    </div>
    <div id="canvas-container"></div>
  </div>

  <div id="sidebar">
    <div>
      <h2 style="font-size: 18px; color: #ff9ebb; margin-bottom: 4px;">Naura 3D Inspector</h2>
      <p style="font-size: 12px; color: #94a3b8;">Standalone WebGL Studio - Naura Hoshino V2</p>
    </div>

    <div class="info-card" id="model-info">
      <div><b>Format:</b> <span id="info-format">Mendeteksi...</span></div>
      <div><b>PBR Pipeline:</b> ACESFilmic / ToneMapping</div>
      <div><b>Rigging:</b> Humanoid Bone Standard</div>
    </div>

    <div>
      <div class="section-title">Ekspresi Wajah (Blendshapes)</div>
      <div class="btn-grid">
        <button onclick="setExpression('neutral')">Neutral</button>
        <button onclick="setExpression('happy')">Happy / Joy</button>
        <button onclick="setExpression('relaxed')">Relaxed</button>
        <button onclick="setExpression('sad')">Sorrow / Sad</button>
        <button onclick="setExpression('angry')">Angry</button>
        <button onclick="setExpression('surprised')">Surprised</button>
      </div>
    </div>

    <div>
      <div class="section-title">Fonem Lip-Sync (Visemes)</div>
      <div class="btn-grid" style="grid-template-columns: repeat(5, 1fr);">
        <button onclick="setViseme('aa')">A</button>
        <button onclick="setViseme('ih')">I</button>
        <button onclick="setViseme('ou')">U</button>
        <button onclick="setViseme('ee')">E</button>
        <button onclick="setViseme('oh')">O</button>
      </div>
    </div>

    <div>
      <div class="section-title">Artikulasi Sendi & Kamera</div>
      <div class="slider-group">
        <div class="slider-label"><span>Rotasi Kepala (Yaw)</span><span id="val-yaw">0</span></div>
        <input type="range" id="slider-yaw" min="-45" max="45" value="0" oninput="rotateHead(this.value, 'yaw')">
      </div>
      <div class="slider-group">
        <div class="slider-label"><span>Anggukan Kepala (Pitch)</span><span id="val-pitch">0</span></div>
        <input type="range" id="slider-pitch" min="-30" max="30" value="0" oninput="rotateHead(this.value, 'pitch')">
      </div>
      <button style="width: 100%; margin-top: 6px;" onclick="resetCamera()">Reset Posisi Kamera</button>
    </div>

    <div>
      <div class="section-title">Pencahayaan Studio</div>
      <div class="btn-grid">
        <button onclick="setLight('bright')">Day Studio</button>
        <button onclick="setLight('cyber')">Cyber Neon</button>
      </div>
    </div>
  </div>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { VRMLoaderPlugin } from '@pixiv/three-vrm';

    const container = document.getElementById('canvas-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const infoFormat = document.getElementById('info-format');

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0c15);

    const camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 20.0);
    camera.position.set(0.0, 1.35, 1.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.0, 1.25, 0.0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 4.0;
    controls.update();

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(1.0, 2.0, 1.0).normalize();
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xff9ebb, 1.0);
    rimLight.position.set(-1.0, 1.5, -1.0).normalize();
    scene.add(rimLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(4, 20, 0xff9ebb, 0x221a30);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // 3. VRM / GLTF Loader
    let currentVrm = null;
    let currentGltf = null;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    async function loadModel() {
      const candidates = ['/models/naura.vrm', '/models/naura.glb', '/models/Naura Hoshino 3D.glb'];
      for (const url of candidates) {
        try {
          const gltf = await new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
          });

          if (gltf.userData.vrm) {
            currentVrm = gltf.userData.vrm;
            scene.add(currentVrm.scene);
            infoFormat.innerText = 'VRM 1.0 / 0.0 (Full Expression & Physics)';
          } else {
            currentGltf = gltf.scene;
            scene.add(currentGltf);
            infoFormat.innerText = 'GLTF / GLB 2.0 Static Rig';
          }

          loadingOverlay.style.display = 'none';
          return;
        } catch (e) {
          console.warn('Gagal memuat dari ' + url + ':', e.message);
        }
      }
      loadingOverlay.innerHTML = '<div style="color:#ef4444;">Gagal memuat berkas model 3D Naura.</div>';
    }

    loadModel();

    // 4. Expression Controller
    window.setExpression = (name) => {
      if (!currentVrm || !currentVrm.expressionManager) return;
      const em = currentVrm.expressionManager;
      ['happy', 'relaxed', 'sad', 'angry', 'surprised'].forEach(exp => em.setValue(exp, 0));
      if (name !== 'neutral') {
        em.setValue(name, 1.0);
      }
      em.update();
    };

    window.setViseme = (v) => {
      if (!currentVrm || !currentVrm.expressionManager) return;
      const em = currentVrm.expressionManager;
      ['aa', 'ih', 'ou', 'ee', 'oh'].forEach(vis => em.setValue(vis, 0));
      em.setValue(v, 1.0);
      em.update();
    };

    window.rotateHead = (val, type) => {
      if (!currentVrm || !currentVrm.humanoid) return;
      const head = currentVrm.humanoid.getNormalizedBoneNode('head');
      if (!head) return;
      const rad = (val * Math.PI) / 180;
      if (type === 'yaw') {
        head.rotation.y = rad;
        document.getElementById('val-yaw').innerText = val + '°';
      } else {
        head.rotation.x = rad;
        document.getElementById('val-pitch').innerText = val + '°';
      }
    };

    window.resetCamera = () => {
      camera.position.set(0.0, 1.35, 1.4);
      controls.target.set(0.0, 1.25, 0.0);
      controls.update();
    };

    window.setLight = (mode) => {
      if (mode === 'cyber') {
        ambientLight.color.setHex(0x180b2a);
        dirLight.color.setHex(0x38bdf8);
        rimLight.color.setHex(0xf43f5e);
      } else {
        ambientLight.color.setHex(0xffffff);
        dirLight.color.setHex(0xffffff);
        rimLight.color.setHex(0xff9ebb);
      }
    };

    // 5. Render Loop
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (currentVrm) {
        currentVrm.update(delta);
      }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
  </script>
</body>
</html>`);
});

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`\n====================================================`);
  console.log(`  NAURA HOSHINO V2 - 3D AVATAR STUDIO & INSPECTOR   `);
  console.log(`====================================================`);
  console.log(`  Studio Server aktif di: http://localhost:${PORT}`);
  console.log(`  Tekan Ctrl+C untuk menutup server.\n`);
});
