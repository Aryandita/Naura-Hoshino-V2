"use strict";

/**
 * naura3d.js, Three.js viewer untuk model 3D Naura di header dashboard
 *
 * Dipanggil saat DOM siap. Membuat canvas WebGL di dalam #naura3d-canvas-wrapper,
 * memuat file GLB dari /assets/3d/Naura Hoshino 3D.glb, dan menjalankan loop
 * render dengan auto-rotate + mouse orbit.
 *
 * Jika WebGL tidak tersedia, elemen wrapper tetap kosong (fallback CSS mengambil alih).
 */

(function () {
  const WRAPPER_ID = "naura3d-canvas-wrapper";
  const MODEL_URL = "/assets/3d/Naura Hoshino 3D.glb";
  const THREE_CDN =
    "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
  const GLTF_CDN =
    "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";
  const ORBIT_CDN =
    "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js";

  const wrapper = document.getElementById(WRAPPER_ID);
  if (!wrapper) return;

  // Cek WebGL support
  try {
    const testCanvas = document.createElement("canvas");
    const ctx =
      testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
    if (!ctx) throw new Error("no webgl");
  } catch (e) {
    wrapper.innerHTML =
      '<div class="naura3d-no-webgl">Model 3D tidak tersedia di browser ini</div>';
    return;
  }

  // Loading indicator
  const loadingEl = document.createElement("div");
  loadingEl.className = "naura3d-loading";
  loadingEl.innerHTML = `
        <div class="naura3d-loading-ring"></div>
        <span>Memuat model Naura...</span>
    `;
  wrapper.appendChild(loadingEl);

  // Import modul ES6 Three.js dari CDN via dynamic import
  async function init() {
    try {
      const THREE = await import(THREE_CDN);
      const { GLTFLoader } = await import(GLTF_CDN);
      const { OrbitControls } = await import(ORBIT_CDN);

      // --- Scene, Camera, Renderer ---
      const scene = new THREE.Scene();
      scene.background = null; // Transparan agar menyatu dengan glassmorphism

      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 1.2, 3.5);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      wrapper.appendChild(renderer.domElement);

      // --- Pencahayaan (Cyber-Anime: pink ambient + directional blue-purple) ---
      const ambientLight = new THREE.AmbientLight(0xffb6c1, 0.8); // pink
      scene.add(ambientLight);

      const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
      mainLight.position.set(2, 4, 3);
      scene.add(mainLight);

      const rimLight = new THREE.DirectionalLight(0xc084fc, 1.2); // aksen purple
      rimLight.position.set(-3, 2, -2);
      scene.add(rimLight);

      const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6); // aksen blue
      fillLight.position.set(0, -2, 2);
      scene.add(fillLight);

      // --- Orbit Controls (mouse drag) ---
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.enableZoom = true;
      controls.minDistance = 1.5;
      controls.maxDistance = 8;
      controls.maxPolarAngle = Math.PI / 1.6; // jangan terlalu ke bawah
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8;
      controls.target.set(0, 1, 0); // fokus ke area badan

      // --- Load model GLB ---
      const loader = new GLTFLoader();
      loader.load(
        MODEL_URL,
        (gltf) => {
          // Hapus loading indicator
          loadingEl.remove();

          const model = gltf.scene;

          // Center dan scale model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.8 / maxDim;

          model.scale.setScalar(scale);
          model.position.sub(center.multiplyScalar(scale));
          model.position.y += 0.1; // sedikit naik

          scene.add(model);
          controls.target.set(0, size.y * scale * 0.4, 0);
          controls.update();
        },
        (xhr) => {
          // Progress loading
          if (xhr.total > 0) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            const span = loadingEl.querySelector("span");
            if (span) span.textContent = `Memuat model Naura... ${pct}%`;
          }
        },
        (error) => {
          loadingEl.remove();
          console.warn("[naura3d] Gagal memuat model GLB:", error);
          wrapper.innerHTML =
            '<div class="naura3d-error">Model 3D tidak dapat dimuat</div>';
        },
      );

      // --- Resize handler ---
      const resizeObserver = new ResizeObserver(() => {
        const w = wrapper.clientWidth;
        const h = wrapper.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      resizeObserver.observe(wrapper);

      // --- Render loop ---
      function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();
    } catch (err) {
      console.warn("[naura3d] Inisialisasi gagal:", err);
      loadingEl.remove();
      wrapper.innerHTML =
        '<div class="naura3d-error">Model 3D tidak tersedia</div>';
    }
  }

  init();
})();
