/**
 * Naura Hero 3D - Dashboard Hero Canvas
 * Minimal 3D mascot display for dashboard index page
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

class NauraHero3D {
  constructor() {
    this.canvas = document.getElementById("naura-hero-3d-canvas");
    this.wrapper = document.getElementById("naura3d-canvas-wrapper");
    this.loadingEl = document.getElementById("naura3d-loading");
    this.errorEl = document.getElementById("naura3d-error");
    this.statusText = document.getElementById("naura3d-status-text");
    this.formatBadge = document.getElementById("naura3d-format-badge");
    this.modelSelector = document.getElementById("naura3d-model-selector");
    this.animControls = document.getElementById("naura3d-anim-controls");
    this.btnHalo = document.getElementById("naura3d-btn-halo");
    this.btnReset = document.getElementById("naura3d-btn-reset");
    this.btnSnapshot = document.getElementById("naura3d-btn-snapshot");

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.currentAnim = "Idle";
    this.haloEnabled = true;
    this.haloMesh = null;

    this.models = {
      "NEW VRM": "/models/naura%20NEW.vrm",
      VRM: "/models/naura.vrm",
      GLB: "/models/naura_animated.glb",
    };

    this.init();
  }

  async init() {
    if (!this.canvas) return;

    this.setupThree();
    this.setupEvents();
    this.setupModelButtons();
    await this.loadModel(this.models["GLB"], "GLB");
    this.animate();
  }

  setupThree() {
    const rect = this.wrapper.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 400;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a14);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 1.4, 3.2);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 6;
    this.controls.maxPolarAngle = Math.PI / 1.8;
    this.controls.minPolarAngle = 0.2;
    this.controls.target.set(0, 1.1, 0);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff0e0, 1.2);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f0ff, 0.4);
    fillLight.position.set(-3, 2, -2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffc0cb, 0.5);
    rimLight.position.set(0, -2, -4);
    this.scene.add(rimLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Halo
    this.createHalo();

    // Resize
    window.addEventListener("resize", () => this.onResize());
  }

  createHalo() {
    const haloGeo = new THREE.RingGeometry(0.8, 1.1, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffc0cb,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.haloMesh.rotation.x = -Math.PI / 2;
    this.haloMesh.position.y = 0.05;
    this.haloMesh.visible = this.haloEnabled;
    this.scene.add(this.haloMesh);
  }

  setupEvents() {
    this.btnHalo?.addEventListener("click", () => this.toggleHalo());
    this.btnReset?.addEventListener("click", () => this.resetCamera());
    this.btnSnapshot?.addEventListener("click", () => this.takeSnapshot());

    this.animControls?.addEventListener("click", (e) => {
      const btn = e.target.closest(".naura3d-anim-btn");
      if (btn) this.setAnimation(btn.dataset.anim);
    });

    this.modelSelector?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-model]");
      if (btn) {
        this.loadModel(btn.dataset.model, btn.textContent.trim());
        this.updateModelButtons(btn);
      }
    });
  }

  setupModelButtons() {
    this.modelBtns =
      this.modelSelector?.querySelectorAll("button[data-model]") || [];
  }

  updateModelButtons(activeBtn) {
    this.modelBtns?.forEach((btn) => {
      const isActive = btn === activeBtn;
      btn.className = isActive
        ? "btn btn-sm btn-primary"
        : "btn btn-sm btn-ghost";
      btn.style.fontFamily = "var(--font-mono)";
      btn.style.fontSize = "var(--text-xs)";
    });
  }

  async loadModel(url, format) {
    this.showLoading(true);
    this.hideError();

    try {
      if (this.model) {
        this.scene.remove(this.model);
        if (this.mixer) {
          this.mixer.uncacheRoot(this.model);
        }
      }

      let loadedModel;
      if (url.endsWith(".vrm") || format === "VRM") {
        const loader = new GLTFLoader();
        loader.register((parser) => {
          return new VRMLoaderPlugin(parser);
        });
        loadedModel = await loader.loadAsync(url);
        this.model = loadedModel.scene;
        this.model.userData.isVRM = true;
      } else {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        this.model = gltf.scene;
        this.model.userData.isVRM = false;
        this.model.userData.gltf = gltf;
      }

      this.setupModel();
      this.formatBadge.textContent = format;
      this.formatBadge.className = "badge badge-primary";
      this.showLoading(false);
      this.statusText.textContent = "🌸 Idle";
      this.setAnimation("Idle");
    } catch (err) {
      console.error("Model load error:", err);
      this.showError();
    }
  }

  setupModel() {
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.transparent = false;
        }
      }
    });

    // Center and scale
    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.8 / maxDim;
    this.model.scale.multiplyScalar(scale);
    box.setFromObject(this.model);
    box.getCenter(center);
    this.model.position.sub(center.multiplyScalar(scale));
    this.model.position.y = 0;

    this.scene.add(this.model);

    // Animation mixer: clip glTF ada di scene (GLB) atau di model (VRM).
    this.mixer = new THREE.AnimationMixer(this.model);
    this.animations = {};
    const clipSource =
      this.model.animations && this.model.animations.length
        ? this.model.animations
        : this.model.userData?.gltf?.animations || [];
    clipSource.forEach((clip) => {
      this.animations[clip.name] = clip;
    });

    // Update halo position
    if (this.haloMesh) {
      this.haloMesh.position.y = 0.05;
    }
  }

  setAnimation(name) {
    if (!this.mixer || !this.animations[name]) return;

    this.currentAnim = name;
    const clip = this.animations[name];
    const action = this.mixer.clipAction(clip);
    action.reset().fadeIn(0.3).play();

    // Crossfade from current
    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(0.3);
    }
    this.currentAction = action;

    this.updateAnimButtons(name);
    this.statusText.textContent = this.getAnimLabel(name);
  }

  getAnimLabel(name) {
    const labels = {
      Idle: "🌸 Idle",
      Wave: "👋 Sapa",
      Thinking: "🤔 Pikir",
      Cheers: "🎉 Ceria",
      Shy: "😳 Malu",
    };
    return labels[name] || name;
  }

  updateAnimButtons(activeName) {
    this.animControls?.querySelectorAll(".naura3d-anim-btn").forEach((btn) => {
      const isActive = btn.dataset.anim === activeName;
      btn.className = isActive
        ? "naura3d-anim-btn btn btn-sm btn-primary"
        : "naura3d-anim-btn btn btn-sm btn-ghost";
      btn.style.fontFamily = "var(--font-mono)";
      btn.style.fontSize = "var(--text-xs)";
    });
  }

  toggleHalo() {
    this.haloEnabled = !this.haloEnabled;
    if (this.haloMesh) this.haloMesh.visible = this.haloEnabled;
    this.btnHalo?.classList.toggle("btn-primary", this.haloEnabled);
    this.btnHalo?.classList.toggle("btn-ghost", !this.haloEnabled);
  }

  resetCamera() {
    this.controls.reset();
    this.controls.target.set(0, 1.1, 0);
    this.camera.position.set(0, 1.4, 3.2);
  }

  takeSnapshot() {
    const link = document.createElement("a");
    link.download = `naura-hero-${Date.now()}.png`;
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.click();
  }

  onResize() {
    if (!this.wrapper || !this.renderer || !this.camera) return;
    const rect = this.wrapper.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 400;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  showLoading(show) {
    if (this.loadingEl) this.loadingEl.style.display = show ? "flex" : "none";
  }

  showError() {
    if (this.errorEl) this.errorEl.style.display = "flex";
    if (this.loadingEl) this.loadingEl.style.display = "none";
  }

  hideError() {
    if (this.errorEl) this.errorEl.style.display = "none";
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    if (this.mixer) this.mixer.update(delta);
    if (this.controls) this.controls.update();
    if (this.haloMesh && this.haloEnabled) {
      this.haloMesh.rotation.z += 0.0008;
    }
    if (this.model) {
      this.model.rotation.y += 0.0003;
    }

    this.renderer?.render(this.scene, this.camera);
  }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.nauraHero3D = new NauraHero3D();
});
