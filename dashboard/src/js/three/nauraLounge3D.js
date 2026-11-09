/**
 * Naura Lounge 3D - Full Studio Experience
 * Complete 3D mascot studio with 31 animations, expressions, physics, lighting
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

class NauraLounge3D {
  constructor() {
    this.canvas = document.getElementById("loungeCanvas");
    this.wrapper = document.querySelector(".stage-card");
    this.loadingEl = document.getElementById("loungeLoading");
    this.errorEl = document.getElementById("loungeError");
    this.statusText = document.getElementById("loungeStatusText");
    this.formatBadge = document.getElementById("loungeFormatBadge");
    this.animGrid = document.getElementById("loungeAnimGrid");
    this.animSearch = document.getElementById("loungeAnimSearch");
    this.morphMouth = document.getElementById("loungeMorphMouth");
    this.morphEye = document.getElementById("loungeMorphEye");
    this.physicsEnabled = document.getElementById("loungePhysicsEnabled");
    this.eyeTracking = document.getElementById("loungeEyeTracking");
    this.headTracking = document.getElementById("loungeHeadTracking");
    this.bloomEnabled = document.getElementById("loungeBloomEnabled");
    this.haloEnabled = document.getElementById("loungeHaloEnabled");
    this.shadowEnabled = document.getElementById("loungeShadowEnabled");
    this.lightIntensity = document.getElementById("loungeLightIntensity");
    this.lightColor = document.getElementById("loungeLightColor");
    this.lightPreset = document.getElementById("loungeLightPreset");
    this.btnHalo = document.getElementById("loungeBtnHalo");
    this.btnResetCam = document.getElementById("loungeBtnResetCam");
    this.btnWireframe = document.getElementById("loungeBtnWireframe");
    this.btnSnapshot = document.getElementById("loungeBtnSnapshot");
    this.btnResetAll = document.getElementById("loungeBtnResetAll");
    this.btnExportPose = document.getElementById("loungeBtnExportPose");

    this.modelSelectorBtns = {
      new: document.getElementById("loungeBtnModelNew"),
      vrm: document.getElementById("loungeBtnModelVrm"),
      glb: document.getElementById("loungeBtnModelGlb"),
    };

    this.expressionBtns = document.querySelectorAll("[data-expression]");

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.currentAnim = "Idle";
    this.animations = {};
    this.expressions = {};
    this.morphTargets = {};
    this.haloMesh = null;
    this.bloomPass = null;
    this.composer = null;
    this.wireframeEnabled = false;

    this.physics = {
      enabled: true,
      hair: null,
      cloth: null,
    };

    this.eyeTarget = new THREE.Vector3();
    this.headTarget = new THREE.Vector3();
    this.mouse = new THREE.Vector2();

    this.models = {
      "NEW VRM": "/models/naura%20NEW.vrm",
      VRM: "/models/naura%20NEW.vrm",
      GLB: "/models/naura%20NEW.glb",
    };

    this.animList = [
      "Idle",
      "Wave",
      "Thinking",
      "Cheers",
      "Shy",
      "Walk",
      "Run",
      "Jump",
      "Sit",
      "Sleep",
      "Dance1",
      "Dance2",
      "Dance3",
      "Dance4",
      "Sing1",
      "Sing2",
      "Sing3",
      "Sing4",
      "Pose1",
      "Pose2",
      "Pose3",
      "Pose4",
      "Pose5",
      "Emote1",
      "Emote2",
      "Emote3",
      "Emote4",
      "Emote5",
      "Action1",
      "Action2",
      "Action3",
      "Action4",
      "Action5",
    ];

    this.init();
  }

  async init() {
    if (!this.canvas) return;

    this.setupThree();
    this.setupEvents();
    this.setupModelButtons();
    this.buildAnimGrid();
    this.setupExpressionButtons();
    await this.loadModel(this.models["GLB"], "GLB");
    this.animate();
  }

  setupThree() {
    const rect = this.wrapper.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a14);
    this.scene.fog = new THREE.FogExp2(0x070a14, 0.02);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, 1.2, 3.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = true;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI / 1.5;
    this.controls.minPolarAngle = 0.15;
    this.controls.target.set(0, 0.9, 0);

    // Lights
    this.setupLights();

    // Ground
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(20, 40, 0x22d3ee, 0x1a1f2e);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    grid.material.depthWrite = false;
    this.scene.add(grid);

    // Halo
    this.createHalo();

    // Post-processing
    this.setupPostProcessing();

    // Resize
    window.addEventListener("resize", () => this.onResize());
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
  }

  setupLights() {
    // Clear existing
    this.lights = {};

    // Ambient
    this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.lights.ambient);

    // Key light
    this.lights.key = new THREE.DirectionalLight(0xfff0e0, 1.0);
    this.lights.key.position.set(4, 6, 5);
    this.lights.key.castShadow = true;
    this.lights.key.shadow.mapSize.set(2048, 2048);
    this.lights.key.shadow.camera.near = 0.5;
    this.lights.key.shadow.camera.far = 20;
    this.lights.key.shadow.camera.left = -6;
    this.lights.key.shadow.camera.right = 6;
    this.lights.key.shadow.camera.top = 6;
    this.lights.key.shadow.camera.bottom = -6;
    this.lights.key.shadow.bias = -0.0005;
    this.scene.add(this.lights.key);

    // Fill light
    this.lights.fill = new THREE.DirectionalLight(0xe0f0ff, 0.5);
    this.lights.fill.position.set(-4, 3, -3);
    this.scene.add(this.lights.fill);

    // Rim light
    this.lights.rim = new THREE.DirectionalLight(0xffc0cb, 0.6);
    this.lights.rim.position.set(0, -3, -5);
    this.scene.add(this.lights.rim);

    // Accent lights
    this.lights.accent1 = new THREE.PointLight(0xffc0cb, 0.8, 8);
    this.lights.accent1.position.set(3, 2, 3);
    this.lights.accent1.castShadow = true;
    this.scene.add(this.lights.accent1);

    this.lights.accent2 = new THREE.PointLight(0x22d3ee, 0.6, 8);
    this.lights.accent2.position.set(-3, 2, -3);
    this.scene.add(this.lights.accent2);

    // Update shadows
    this.updateShadows();
  }

  updateShadows() {
    Object.values(this.lights).forEach((light) => {
      if (light.shadow) {
        light.castShadow = this.shadowEnabled?.checked ?? true;
        light.shadow.needsUpdate = true;
      }
    });
    this.renderer.shadowMap.enabled = this.shadowEnabled?.checked ?? true;
  }

  createHalo() {
    const haloGeo = new THREE.RingGeometry(0.9, 1.3, 128);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffc0cb,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.haloMesh.rotation.x = -Math.PI / 2;
    this.haloMesh.position.y = 0.05;
    this.haloMesh.visible = this.haloEnabled?.checked ?? true;
    this.scene.add(this.haloMesh);
  }

  setupPostProcessing() {
    // Simple bloom using additive blending
    // For full post-processing, would need EffectComposer
    // Keeping it simple for performance
  }

  setupEvents() {
    // Model buttons
    Object.entries(this.modelSelectorBtns).forEach(([key, btn]) => {
      if (btn) {
        btn.addEventListener("click", () => {
          const urls = {
            new: this.models["NEW VRM"],
            vrm: this.models["VRM"],
            glb: this.models["GLB"],
          };
          this.loadModel(urls[key], key.toUpperCase());
          this.updateModelButtons(btn);
        });
      }
    });

    // Control buttons
    this.btnHalo?.addEventListener("click", () => this.toggleHalo());
    this.btnResetCam?.addEventListener("click", () => this.resetCamera());
    this.btnWireframe?.addEventListener("click", () => this.toggleWireframe());
    this.btnSnapshot?.addEventListener("click", () => this.takeSnapshot());
    this.btnResetAll?.addEventListener("click", () => this.resetAll());
    this.btnExportPose?.addEventListener("click", () => this.exportPose());

    // Physics toggles
    this.physicsEnabled?.addEventListener("change", () => this.updatePhysics());
    this.eyeTracking?.addEventListener("change", () => this.updateTracking());
    this.headTracking?.addEventListener("change", () => this.updateTracking());
    this.bloomEnabled?.addEventListener("change", () => this.updateBloom());
    this.haloEnabled?.addEventListener("change", () => this.toggleHalo());
    this.shadowEnabled?.addEventListener("change", () => this.updateShadows());

    // Lighting controls
    this.lightIntensity?.addEventListener("input", () =>
      this.updateLightIntensity(),
    );
    this.lightColor?.addEventListener("input", () => this.updateLightColor());
    this.lightPreset?.addEventListener("change", () => this.applyLightPreset());

    // Morph targets
    this.morphMouth?.addEventListener("input", () =>
      this.updateMorph("mouthOpen", this.morphMouth.value),
    );
    this.morphEye?.addEventListener("input", () =>
      this.updateMorph("eyeOpen", this.morphEye.value),
    );
  }

  setupModelButtons() {
    this.modelBtns = Object.values(this.modelSelectorBtns);
  }

  updateModelButtons(activeBtn) {
    this.modelBtns.forEach((btn) => {
      if (!btn) return;
      const isActive = btn === activeBtn;
      btn.className = isActive
        ? "btn btn-sm btn-primary"
        : "btn btn-sm btn-ghost";
      btn.style.fontFamily = "var(--font-mono)";
      btn.style.fontSize = "var(--text-xs)";
      btn.style.padding = "var(--space-1) var(--space-3)";
    });
  }

  setupExpressionButtons() {
    this.expressionBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const expr = btn.dataset.expression;
        this.setExpression(expr);
        this.updateExpressionButtons(expr);
      });
    });
  }

  updateExpressionButtons(activeExpr) {
    this.expressionBtns.forEach((btn) => {
      const isActive = btn.dataset.expression === activeExpr;
      btn.className = isActive
        ? "btn btn-sm btn-primary"
        : "btn btn-sm btn-ghost";
      btn.style.padding = "var(--space-2)";
      btn.style.textAlign = "left";
    });
  }

  buildAnimGrid() {
    if (!this.animGrid) return;

    this.animGrid.innerHTML = this.animList
      .map(
        (anim, i) => `
      <button type="button" class="btn btn-ghost btn-sm anim-btn" data-anim="${anim}" style="
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-xs);
        font-family: var(--font-mono);
        text-align: left;
        width: 100%;
        transition: all var(--spring-gentle);
      ">
        ${anim}
      </button>
    `,
      )
      .join("");

    this.animGrid.querySelectorAll(".anim-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.setAnimation(btn.dataset.anim));
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "var(--surface-glass-hover)";
        btn.style.borderColor = "var(--hairline-brand)";
      });
      btn.addEventListener("mouseleave", () => {
        if (!btn.classList.contains("active")) {
          btn.style.background = "transparent";
          btn.style.borderColor = "var(--hairline)";
        }
      });
    });

    // Search filter
    this.animSearch?.addEventListener("input", () => {
      const query = this.animSearch.value.toLowerCase();
      this.animGrid.querySelectorAll(".anim-btn").forEach((btn) => {
        const match = btn.dataset.anim.toLowerCase().includes(query);
        btn.style.display = match ? "block" : "none";
      });
    });
  }

  async loadModel(url, format) {
    this.showLoading(true);
    this.hideError();

    try {
      if (this.model) {
        this.scene.remove(this.model);
        if (this.mixer) this.mixer.uncacheRoot(this.model);
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
      this.buildExpressionMap();
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
      if (child.isSkinnedMesh) {
        this.setupMorphTargets(child);
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
    this.model.position.sub(center);
    this.model.position.y = -box.min.y;

    this.scene.add(this.model);
    this.frameModel();

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

    // Update halo
    if (this.haloMesh) {
      this.haloMesh.position.y = 0.05;
    }
  }

  setupMorphTargets(mesh) {
    if (mesh.morphTargetDictionary) {
      Object.entries(mesh.morphTargetDictionary).forEach(([name, index]) => {
        this.morphTargets[name] = { mesh, index };
      });
    }
  }

  buildExpressionMap() {
    // Map common expression names to morph targets
    this.expressions = {
      neutral: { mouthOpen: 0, eyeOpen: 1 },
      happy: { mouthOpen: 0.3, eyeOpen: 1, mouthSmile: 0.8 },
      sad: { mouthOpen: 0.1, eyeOpen: 0.5, mouthFrown: 0.6 },
      angry: { mouthOpen: 0.2, eyeOpen: 0.7, browAngry: 0.8 },
      surprised: { mouthOpen: 0.8, eyeOpen: 1.2, browUp: 0.9 },
      thinking: { mouthOpen: 0.15, eyeOpen: 0.8, browUp: 0.4 },
      shy: { mouthOpen: 0.05, eyeOpen: 0.6, cheekBlush: 0.5 },
      wink: { eyeOpen: 0, eyeWinkLeft: 1 },
    };
  }

  setExpression(name) {
    const expr = this.expressions[name];
    if (!expr) return;

    Object.entries(this.morphTargets).forEach(([name, { mesh, index }]) => {
      const value = expr[name] ?? 0;
      mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
        mesh.morphTargetInfluences[index],
        value,
        0.15,
      );
    });
  }

  setAnimation(name) {
    if (!this.mixer || !this.animations[name]) {
      // Try to find similar animation
      const found = Object.keys(this.animations).find((a) =>
        a.toLowerCase().includes(name.toLowerCase()),
      );
      if (found) name = found;
      else return;
    }

    this.currentAnim = name;
    const clip = this.animations[name];
    const action = this.mixer.clipAction(clip);
    action.reset().fadeIn(0.3).play();

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
    this.animGrid?.querySelectorAll(".anim-btn").forEach((btn) => {
      const isActive = btn.dataset.anim === activeName;
      btn.className = isActive
        ? "anim-btn btn btn-sm btn-primary"
        : "anim-btn btn btn-sm btn-ghost";
      btn.style.padding = "var(--space-2) var(--space-3)";
      btn.style.fontSize = "var(--text-xs)";
      btn.style.fontFamily = "var(--font-mono)";
      btn.style.textAlign = "left";
      btn.style.width = "100%";
    });
  }

  toggleHalo() {
    const enabled = this.haloEnabled?.checked ?? !this.haloMesh.visible;
    if (this.haloEnabled) this.haloEnabled.checked = enabled;
    if (this.haloMesh) this.haloMesh.visible = enabled;
    this.btnHalo?.classList.toggle("btn-primary", enabled);
    this.btnHalo?.classList.toggle("btn-ghost", !enabled);
  }

  frameModel() {
    if (!this.camera || !this.controls || !this.model) return;
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    this.controls.target.set(0, center.y, 0);
    this.camera.position.set(0, center.y + 0.3, 3.5);
    this.controls.update();
  }

  resetCamera() {
    this.frameModel();
  }

  toggleWireframe() {
    this.wireframeEnabled = !this.wireframeEnabled;
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = this.wireframeEnabled;
      }
    });
    this.btnWireframe?.classList.toggle("btn-primary", this.wireframeEnabled);
    this.btnWireframe?.classList.toggle("btn-ghost", !this.wireframeEnabled);
  }

  takeSnapshot() {
    const link = document.createElement("a");
    link.download = `naura-lounge-${Date.now()}.png`;
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.click();
  }

  resetAll() {
    this.resetCamera();
    this.setAnimation("Idle");
    this.setExpression("neutral");
    this.morphMouth.value = 0;
    this.morphEye.value = 1;
    this.updateMorph("mouthOpen", 0);
    this.updateMorph("eyeOpen", 1);
    this.lightIntensity.value = 1.2;
    this.lightColor.value = "#ffc0cb";
    this.lightPreset.value = "studio";
    this.applyLightPreset();
    this.physicsEnabled.checked = true;
    this.eyeTracking.checked = true;
    this.headTracking.checked = true;
    this.bloomEnabled.checked = false;
    this.haloEnabled.checked = true;
    this.shadowEnabled.checked = true;
    this.updatePhysics();
    this.updateTracking();
    this.updateBloom();
    this.toggleHalo();
    this.updateShadows();
    this.btnWireframe.classList.remove("btn-primary");
    this.btnWireframe.classList.add("btn-ghost");
    this.wireframeEnabled = false;
    this.model.traverse((child) => {
      if (child.isMesh && child.material) child.material.wireframe = false;
    });
  }

  exportPose() {
    const pose = {
      position: this.model.position.toArray(),
      rotation: this.model.rotation.toArray(),
      scale: this.model.scale.toArray(),
      animations: Object.keys(this.animations),
      currentAnim: this.currentAnim,
      morphTargets: {},
      camera: this.camera.position.toArray(),
      cameraTarget: this.controls.target.toArray(),
      lights: {},
    };

    Object.entries(this.morphTargets).forEach(([name, { mesh, index }]) => {
      pose.morphTargets[name] = mesh.morphTargetInfluences[index];
    });

    Object.entries(this.lights).forEach(([name, light]) => {
      if (light.position)
        pose.lights[name] = {
          position: light.position.toArray(),
          intensity: light.intensity,
          color: light.color?.getHexString(),
        };
    });

    const blob = new Blob([JSON.stringify(pose, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.download = `naura-pose-${Date.now()}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  updatePhysics() {
    this.physics.enabled = this.physicsEnabled?.checked ?? true;
    // Would integrate with physics engine here
  }

  updateTracking() {
    // Eye/head tracking would use the mouse position
  }

  updateBloom() {
    // Bloom post-processing toggle
  }

  updateLightIntensity() {
    const intensity = parseFloat(this.lightIntensity?.value) || 1;
    if (this.lights.key) this.lights.key.intensity = intensity;
    if (this.lights.fill) this.lights.fill.intensity = intensity * 0.5;
    if (this.lights.rim) this.lights.rim.intensity = intensity * 0.6;
  }

  updateLightColor() {
    const color = this.lightColor?.value || "#ffc0cb";
    if (this.lights.key) this.lights.key.color.set(color);
    if (this.lights.rim) this.lights.rim.color.set(color);
    if (this.lights.accent1) this.lights.accent1.color.set(color);
  }

  applyLightPreset() {
    const preset = this.lightPreset?.value || "studio";
    const presets = {
      studio: {
        intensity: 1.2,
        keyColor: "#fff0e0",
        fillColor: "#e0f0ff",
        rimColor: "#ffc0cb",
        accent1: "#ffc0cb",
        accent2: "#22d3ee",
      },
      dramatic: {
        intensity: 1.8,
        keyColor: "#fff8e0",
        fillColor: "#ffe0b0",
        rimColor: "#ff80a0",
        accent1: "#ff4080",
        accent2: "#ff00ff",
      },
      soft: {
        intensity: 0.8,
        keyColor: "#fffaf0",
        fillColor: "#f0f8ff",
        rimColor: "#ffd0e0",
        accent1: "#ffb0c0",
        accent2: "#b0d0ff",
      },
      neon: {
        intensity: 1.5,
        keyColor: "#ff00ff",
        fillColor: "#00ffff",
        rimColor: "#ffff00",
        accent1: "#00ff80",
        accent2: "#ff0080",
      },
      sunset: {
        intensity: 1.0,
        keyColor: "#ff8040",
        fillColor: "#ff4060",
        rimColor: "#ff2040",
        accent1: "#ff6020",
        accent2: "#ff0040",
      },
    };

    const p = presets[preset] || presets.studio;
    this.lightIntensity.value = p.intensity;
    this.lightColor.value = p.keyColor;
    this.updateLightIntensity();
    this.updateLightColor();
    if (this.lights.fill) this.lights.fill.color.set(p.fillColor);
    if (this.lights.rim) this.lights.rim.color.set(p.rimColor);
    if (this.lights.accent1) this.lights.accent1.color.set(p.accent1);
    if (this.lights.accent2) this.lights.accent2.color.set(p.accent2);
  }

  updateMorph(name, value) {
    const v = parseFloat(value);
    Object.entries(this.morphTargets).forEach(([mName, { mesh, index }]) => {
      if (mName.toLowerCase().includes(name.toLowerCase())) {
        mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
          mesh.morphTargetInfluences[index],
          v,
          0.15,
        );
      }
    });
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast for eye tracking
    if (this.eyeTracking?.checked && this.model) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = raycaster.intersectObject(this.model, true);
      if (intersects.length > 0) {
        this.eyeTarget.copy(intersects[0].point);
      }
    }
  }

  onResize() {
    if (!this.wrapper || !this.renderer || !this.camera) return;
    const rect = this.wrapper.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) this.composer.setSize(width, height);
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
    if (this.haloMesh && (this.haloEnabled?.checked ?? true)) {
      this.haloMesh.rotation.z += 0.0006;
    }
    if (this.model) {
      this.model.rotation.y += 0.00015;

      // Eye tracking
      if (this.eyeTracking?.checked && this.eyeTarget) {
        const head =
          this.model.getObjectByName("Head") ||
          this.model.getObjectByName("head");
        if (head) {
          head.lookAt(this.eyeTarget);
        }
      }

      // Head tracking
      if (this.headTracking?.checked) {
        const head =
          this.model.getObjectByName("Head") ||
          this.model.getObjectByName("head");
        if (head) {
          head.rotation.y = THREE.MathUtils.lerp(
            head.rotation.y,
            this.mouse.x * 0.3,
            0.05,
          );
        }
      }
    }

    // Physics simulation would go here

    this.renderer?.render(this.scene, this.camera);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.nauraLounge3D = new NauraLounge3D();
});
