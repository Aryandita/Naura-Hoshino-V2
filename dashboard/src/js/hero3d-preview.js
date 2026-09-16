/**
 * hero3d-preview.js, Interactive 3D & VRM Hero Viewer for Naura Hoshino Web Dashboard.
 * 
 * Features:
 *   1. Full Three.js PBR with RoomEnvironment PMREM reflections (smooth anime cell-shading).
 *   2. Dual-Engine Model Loader: .vrm (via @pixiv/three-vrm) with seamless fallback to .glb (GLTFLoader).
 *   3. Astral Halo of Hoshino (celestial crown & orbiting diamond stars at Y: 0.52).
 *   4. Holographic Cyber Pedestal (runic concentric rings & ambient sparkle particles at Y: -0.88).
 *   5. Accurate Portrait Framing (Camera at Y: 0.26, Z: 1.30, Target at Y: 0.22) focusing on upper body & head.
 *   6. Procedural & Bone Kinematics: Autonomous micro-expressions, breathing, and 5 interactive poses.
 *   7. Smooth OrbitControls with damping, soft cursor head-tracking, and Camera Reset Glide.
 *   8. HD Snapshot capture with transparent background.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

class NauraHeroPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.wrapper = document.getElementById('naura3d-canvas-wrapper');
    this.loadingBox = document.getElementById('naura3d-loading');
    this.loadingText = document.getElementById('naura3d-loading-text');
    this.errorBox = document.getElementById('naura3d-error');
    this.statusText = document.getElementById('naura3d-status-text');
    this.formatBadge = document.getElementById('naura3d-format-badge');

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.modelRoot = null;
    this.model = null;
    this.vrm = null;
    this.bones = {};
    this.boneRestQuats = {};
    this.clock = new THREE.Clock();

    // Brand 3D Elements
    this.haloGroup = null;
    this.pedestalGroup = null;
    this.particles = null;
    this.starDiamonds = [];
    this.haloVisible = true;

    // Animation & Pose State
    this.currentAnim = 'Idle';
    this.animTime = 0;
    this.isLoaded = false;
    this.isLoading = false;
    this.activeModelFormat = 'VRM';

    // Camera default target & position
    this.defaultCamPos = new THREE.Vector3(0, 0.22, 1.20);
    this.defaultTarget = new THREE.Vector3(0, 0.18, 0);
    this.isResettingCam = false;

    // Base transform for model (Naura is centered at Y: 0, head at +0.52, feet at -0.54)
    this.basePosY = -0.02;
    this.baseRotY = -Math.PI / 2;

    // Mouse cursor tracking
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    // Blinking micro-expression state
    this.blinkTimer = 0;
    this.blinkInterval = 3.5;
    this.isBlinking = false;

    this.init();
  }

  init() {
    if (!this.canvas) return;

    // 1. Scene & Root Pivot
    this.scene = new THREE.Scene();
    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);

    // 2. Camera Setup
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 280;
    const height = rect.height || 360;
    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    this.camera.position.copy(this.defaultCamPos);

    // 3. WebGL Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
    } catch (e) {
      console.warn('⚠️ WebGL context init failed:', e);
      this.showFallback();
      return;
    }

    // 4. PMREM RoomEnvironment for anime reflections
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      this.envTexture = pmrem.fromScene(roomEnv).texture;
      roomEnv.dispose();
      pmrem.dispose();
      this.scene.environment = this.envTexture;
    } catch (e) {
      console.warn('⚠️ PMREM RoomEnvironment failed, continuing with direct lights:', e);
    }

    // 5. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.copy(this.defaultTarget);
    this.controls.minDistance = 0.65;
    this.controls.maxDistance = 2.4;
    this.controls.minPolarAngle = Math.PI * 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.58;
    this.controls.enablePan = false;

    // 6. Lighting
    this.setupLighting();

    // 7. Astral Halo & Holographic Pedestal
    this.createBrand3DElements();

    // 8. Event listeners
    window.addEventListener('mousemove', (e) => {
      const b = this.canvas.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      this.mouse.targetX = Math.max(-1, Math.min(1, ((e.clientX - cx) / (window.innerWidth / 2)))) * 0.5;
      this.mouse.targetY = Math.max(-1, Math.min(1, ((e.clientY - cy) / (window.innerHeight / 2)))) * 0.3;
    });

    const ro = new ResizeObserver(() => this.onResize());
    ro.observe(this.canvas.parentElement || this.canvas);

    // 9. Load Default Model (VRM first, auto-fallback to GLB)
    this.loadModel('/models/naura.vrm');

    // 10. Wire UI Buttons
    this.bindUI();

    // 11. Start animation loop
    this.animate();
  }

  setupLighting() {
    // 1. Soft Ambient Light
    const ambient = new THREE.AmbientLight(0xffffff, 1.35);
    this.scene.add(ambient);

    // 2. Warm Key Light
    const keyLight = new THREE.DirectionalLight(0xfff8f2, 1.25);
    keyLight.position.set(1.4, 2.0, 1.6);
    this.scene.add(keyLight);

    // 3. Front Fill Light (Clears shadows from face, hair, and chest)
    const frontFill = new THREE.DirectionalLight(0xfff5ea, 0.85);
    frontFill.position.set(0, 1.2, 2.2);
    this.scene.add(frontFill);

    // 4. Sakura Pink Rim Light
    const pinkRim = new THREE.DirectionalLight(0xffb3cb, 0.4);
    pinkRim.position.set(-1.6, 1.2, -1.2);
    this.scene.add(pinkRim);

    // 5. Cyber Neon Cyan Point Light
    const cyanPoint = new THREE.PointLight(0x38bdf8, 0.45, 6);
    cyanPoint.position.set(-1.0, -0.3, 1.2);
    this.scene.add(cyanPoint);
  }

  createBrand3DElements() {
    // 1. ASTRAL HALO OF HOSHINO (Around head at Y: 0.52)
    this.haloGroup = new THREE.Group();
    this.haloGroup.name = 'Naura_AstralHalo';
    this.haloGroup.position.set(0, 0.52, -0.05);
    this.haloGroup.rotation.x = Math.PI * 0.12;

    // Outer Celestial Purple Ring
    const outerGeo = new THREE.TorusGeometry(0.24, 0.005, 16, 64);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerRing = new THREE.Mesh(outerGeo, outerMat);
    this.haloGroup.add(outerRing);

    // Inner Sakura Pink Ring
    const innerGeo = new THREE.TorusGeometry(0.18, 0.004, 16, 48);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerRing = new THREE.Mesh(innerGeo, innerMat);
    this.haloGroup.add(innerRing);

    // Accent Cyber Cyan Ring
    const accentGeo = new THREE.TorusGeometry(0.21, 0.002, 12, 48);
    const accentMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const accentRing = new THREE.Mesh(accentGeo, accentMat);
    accentRing.rotation.y = Math.PI * 0.25;
    this.haloGroup.add(accentRing);

    // 4 Orbiting Diamond Star Crystals
    const starGeo = new THREE.OctahedronGeometry(0.022, 0);
    const goldMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pinkStarMat = new THREE.MeshBasicMaterial({
      color: 0xffb6c1,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < 4; i++) {
      const isGold = i % 2 === 0;
      const star = new THREE.Mesh(starGeo, isGold ? goldMat : pinkStarMat);
      this.starDiamonds.push({
        mesh: star,
        angleOffset: (i * Math.PI) / 2,
        radius: 0.24,
      });
      this.haloGroup.add(star);
    }

    this.scene.add(this.haloGroup);

    // 2. HOLOGRAPHIC CYBER PEDESTAL (At feet at Y: -0.55)
    this.pedestalGroup = new THREE.Group();
    this.pedestalGroup.name = 'Naura_Pedestal';
    this.pedestalGroup.position.set(0, -0.55, 0);

    // Dais Primary Ring
    const daisGeo = new THREE.RingGeometry(0.38, 0.42, 48);
    const daisMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const dais = new THREE.Mesh(daisGeo, daisMat);
    dais.rotation.x = Math.PI / 2;
    this.pedestalGroup.add(dais);

    // Outer Cyber Ticks Ring
    const daisOuterGeo = new THREE.RingGeometry(0.48, 0.50, 48);
    const daisOuterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const daisOuter = new THREE.Mesh(daisOuterGeo, daisOuterMat);
    daisOuter.rotation.x = Math.PI / 2;
    this.pedestalGroup.add(daisOuter);

    this.scene.add(this.pedestalGroup);

    // 3. AMBIENT SPARKLE PARTICLES
    const pCount = 50;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.15 + Math.random() * 0.45;
      pPos[i] = Math.cos(angle) * r;
      pPos[i + 1] = -0.85 + Math.random() * 1.4;
      pPos[i + 2] = Math.sin(angle) * r;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xfbcfe8,
      size: 0.022,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particles = new THREE.Points(pGeo, pMat);
    this.scene.add(this.particles);
  }

  loadModel(modelPath) {
    if (this.isLoading) return;
    this.isLoading = true;

    if (this.loadingBox) {
      this.loadingBox.style.display = 'flex';
      this.loadingBox.style.opacity = '1';
    }
    if (this.errorBox) this.errorBox.style.display = 'none';

    const isVrm = String(modelPath).toLowerCase().endsWith('.vrm');
    if (this.loadingText) {
      this.loadingText.textContent = `Memuat Model ${isVrm ? 'VRM' : 'GLB'}...`;
    }

    const loader = new GLTFLoader();
    if (isVrm) {
      try {
        loader.register((parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));
      } catch (e) {
        console.warn('VRMLoaderPlugin register warning:', e);
      }
    }

    const timeoutId = setTimeout(() => {
      if (!this.isLoaded) {
        console.warn('[NauraHeroPreview] Load took longer than expected, applying fallback state');
        this.onModelLoadedSuccess();
      }
    }, 8000);

    loader.load(
      modelPath,
      (gltf) => {
        clearTimeout(timeoutId);
        this.disposeCurrentModel();

        this.vrm = gltf.userData.vrm || null;
        this.model = gltf.scene;
        this.activeModelFormat = this.vrm ? 'VRM' : 'GLB';

        // Map bones if VRM is present
        this.bones = {};
        this.boneRestQuats = {};
        if (this.vrm && this.vrm.humanoid) {
          const boneNames = ['head', 'neck', 'chest', 'spine', 'rightUpperArm', 'leftUpperArm', 'rightLowerArm', 'leftLowerArm'];
          boneNames.forEach(bName => {
            const boneNode = this.vrm.humanoid.getNormalizedBoneNode(bName);
            if (boneNode) {
              this.bones[bName] = boneNode;
              this.boneRestQuats[bName] = boneNode.quaternion.clone();
            }
          });
        }

        // Apply smooth cell-shading anime materials
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = false;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat) => {
              if (mat && mat.isMaterial) {
                mat.side = THREE.DoubleSide;
                if (mat.isMeshStandardMaterial) {
                  mat.metalness = 0.0;
                  mat.roughness = 0.75;
                  mat.roughnessMap = null;
                  mat.metalnessMap = null;
                  if ('envMapIntensity' in mat) {
                    mat.envMapIntensity = 0.5;
                  }
                }
                mat.needsUpdate = true;
              }
            });
          }
        });

        // Exact portrait positioning & orientation
        this.basePosY = -0.02;
        this.baseRotY = -Math.PI / 2;

        this.model.position.set(0, this.basePosY, 0);
        this.model.rotation.set(0, this.baseRotY, 0);

        this.modelRoot.add(this.model);

        // Update UI format badge
        if (this.formatBadge) {
          this.formatBadge.textContent = this.activeModelFormat;
        }

        this.isLoading = false;
        this.onModelLoadedSuccess();
      },
      (xhr) => {
        if (xhr.lengthComputable && this.loadingText) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          this.loadingText.textContent = `Memuat ${isVrm ? 'VRM' : 'GLB'}... ${pct}%`;
        }
      },
      (err) => {
        clearTimeout(timeoutId);
        console.warn(`[NauraHeroPreview] Gagal load ${modelPath}, mencoba fallback:`, err);
        this.isLoading = false;
        if (modelPath !== '/models/naura.glb') {
          this.loadModel('/models/naura.glb');
        } else {
          this.showFallback();
        }
      }
    );
  }

  disposeCurrentModel() {
    if (this.model) {
      this.modelRoot.remove(this.model);
      this.model.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => m.dispose());
        }
      });
      this.model = null;
    }
    if (this.vrm) {
      try {
        if (this.vrm.dispose) this.vrm.dispose();
      } catch (_) {}
      this.vrm = null;
    }
  }

  onModelLoadedSuccess() {
    this.isLoaded = true;
    if (this.loadingBox) {
      this.loadingBox.style.opacity = '0';
      setTimeout(() => {
        if (this.loadingBox) this.loadingBox.style.display = 'none';
      }, 350);
    }
    if (this.wrapper) {
      this.wrapper.style.borderColor = 'rgba(244, 114, 182, 0.4)';
      this.wrapper.style.boxShadow = 'inset 0 0 25px rgba(244, 114, 182, 0.1), 0 10px 30px rgba(0,0,0,0.6)';
    }
  }

  showFallback() {
    if (this.loadingBox) this.loadingBox.style.display = 'none';
    if (this.errorBox) this.errorBox.style.display = 'flex';
  }

  bindUI() {
    // Pose / Animation buttons
    document.querySelectorAll('.naura3d-anim-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const anim = btn.dataset.anim;
        const label = btn.dataset.label;
        this.playAnim(anim, label);

        document.querySelectorAll('.naura3d-anim-btn').forEach((b) => {
          b.style.background = 'transparent';
          b.style.borderColor = 'var(--border-subtle)';
          b.style.color = 'var(--text-muted)';
        });
        btn.style.background = 'var(--primary-dim)';
        btn.style.borderColor = 'var(--border-primary)';
        btn.style.color = 'var(--primary)';
      });
    });

    // Model Switcher buttons (GLB vs VRM)
    const btnGlb = document.getElementById('btn-model-glb');
    const btnVrm = document.getElementById('btn-model-vrm');
    if (btnGlb && btnVrm) {
      btnGlb.addEventListener('click', () => {
        btnGlb.style.background = 'var(--primary-dim)';
        btnGlb.style.borderColor = 'var(--border-primary)';
        btnGlb.style.color = 'var(--primary)';
        btnVrm.style.background = 'var(--bg-elevated)';
        btnVrm.style.borderColor = 'var(--border-subtle)';
        btnVrm.style.color = 'var(--text-muted)';
        this.loadModel('/models/naura.glb');
      });

      btnVrm.addEventListener('click', () => {
        btnVrm.style.background = 'var(--primary-dim)';
        btnVrm.style.borderColor = 'var(--border-primary)';
        btnVrm.style.color = 'var(--primary)';
        btnGlb.style.background = 'var(--bg-elevated)';
        btnGlb.style.borderColor = 'var(--border-subtle)';
        btnGlb.style.color = 'var(--text-muted)';
        this.loadModel('/models/naura.vrm');
      });
    }

    // Toggle Halo
    const btnHalo = document.getElementById('naura3d-btn-halo');
    if (btnHalo) {
      btnHalo.addEventListener('click', () => {
        this.haloVisible = !this.haloVisible;
        if (this.haloGroup) this.haloGroup.visible = this.haloVisible;
        btnHalo.style.opacity = this.haloVisible ? '1' : '0.4';
      });
    }

    // Reset Camera Glide
    const btnReset = document.getElementById('naura3d-btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.isResettingCam = true;
      });
    }

    // Snapshot HD PNG
    const btnSnapshot = document.getElementById('naura3d-btn-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => {
        this.renderer.render(this.scene, this.camera);
        const dataUrl = this.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Naura_Hoshino_3D_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      });
    }
  }

  playAnim(animName, label) {
    this.currentAnim = animName;
    this.animTime = 0;
    if (this.statusText && label) {
      this.statusText.textContent = label;
    }
  }

  onResize() {
    if (!this.renderer || !this.camera || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 280;
    const height = rect.height || 360;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Controls & Camera Reset Glide
    if (this.isResettingCam) {
      this.camera.position.lerp(this.defaultCamPos, 0.08);
      this.controls.target.lerp(this.defaultTarget, 0.08);
      if (this.camera.position.distanceTo(this.defaultCamPos) < 0.01) {
        this.camera.position.copy(this.defaultCamPos);
        this.controls.target.copy(this.defaultTarget);
        this.isResettingCam = false;
      }
      this.controls.update();
    } else if (this.controls) {
      this.controls.update();
    }

    // 2. Smooth Cursor Tracking with damping
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.06;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.06;

    // 3. Rotate Halo & Orbiting Star Octahedrons
    if (this.haloGroup && this.haloVisible) {
      this.haloGroup.rotation.z += 0.005;
      this.starDiamonds.forEach((star) => {
        const a = time * 1.2 + star.angleOffset;
        star.mesh.position.x = Math.cos(a) * star.radius;
        star.mesh.position.y = Math.sin(a) * star.radius;
        star.mesh.rotation.x += 0.02;
        star.mesh.rotation.y += 0.02;
      });
    }

    // 4. Rotate Pedestal slowly
    if (this.pedestalGroup) {
      this.pedestalGroup.rotation.y += 0.003;
    }

    // 5. Float Sparkle Particles
    if (this.particles) {
      const posAttr = this.particles.geometry.attributes.position;
      const arr = posAttr.array;
      for (let i = 1; i < arr.length; i += 3) {
        arr[i] += 0.002;
        if (arr[i] > 0.6) arr[i] = -0.85;
      }
      posAttr.needsUpdate = true;
    }

    // 6. Micro-Expression: Autonomous Blinking
    this.blinkTimer += delta;
    if (this.blinkTimer > this.blinkInterval) {
      this.blinkTimer = 0;
      this.blinkInterval = 2.5 + Math.random() * 2.5;
      this.isBlinking = true;
    }

    let blinkVal = 0;
    if (this.isBlinking) {
      const bProgress = this.blinkTimer / 0.18;
      if (bProgress < 0.5) {
        blinkVal = bProgress * 2;
      } else if (bProgress < 1.0) {
        blinkVal = (1.0 - bProgress) * 2;
      } else {
        this.isBlinking = false;
      }
    }

    if (this.vrm && this.vrm.expressionManager) {
      try {
        this.vrm.expressionManager.setValue('blink', blinkVal);
      } catch (_) {}
    }

    // 7. Model Motion & Procedural Kinematics
    if (this.model) {
      this.animTime += delta;

      // Base orientation facing front (+ Math.PI) with cursor tracking
      this.model.rotation.y = this.baseRotY + this.mouse.x * 0.25;
      this.model.rotation.x = this.mouse.y * 0.12;

      // Vertical position base
      let targetY = this.basePosY;

      // Animation state switcher
      switch (this.currentAnim) {
        case 'Idle': {
          // Smooth sinusoidal breathing
          targetY = this.basePosY + Math.sin(time * 2.2) * 0.012;
          // Subtle spine and head breathing
          if (this.bones.spine) {
            this.bones.spine.rotation.x = Math.sin(time * 2.2) * 0.02;
          }
          if (this.bones.head) {
            this.bones.head.rotation.y = this.mouse.x * 0.2;
            this.bones.head.rotation.x = this.mouse.y * 0.15;
          }
          break;
        }
        case 'Wave': {
          // Energetic wave
          targetY = this.basePosY + Math.abs(Math.sin(time * 4)) * 0.02;
          this.model.rotation.z = Math.sin(time * 5) * 0.03;
          if (this.bones.rightUpperArm) {
            this.bones.rightUpperArm.rotation.z = -1.2 + Math.sin(time * 8) * 0.25;
            this.bones.rightUpperArm.rotation.x = 0.3;
          }
          if (this.bones.head) {
            this.bones.head.rotation.z = -0.1;
          }
          break;
        }
        case 'Thinking': {
          // Head tilted curiously
          targetY = this.basePosY + Math.sin(time * 1.5) * 0.008;
          this.model.rotation.z = 0.06;
          this.model.rotation.x = 0.08 + Math.sin(time * 1.8) * 0.02;
          if (this.bones.head) {
            this.bones.head.rotation.z = 0.15;
            this.bones.head.rotation.x = 0.08;
          }
          if (this.bones.rightUpperArm) {
            this.bones.rightUpperArm.rotation.z = -0.6;
            this.bones.rightUpperArm.rotation.x = 0.4;
          }
          break;
        }
        case 'Cheers': {
          // Joyful celebratory bounce
          targetY = this.basePosY + Math.abs(Math.sin(time * 6)) * 0.038;
          this.model.rotation.y += Math.sin(time * 4) * 0.04;
          if (this.bones.rightUpperArm && this.bones.leftUpperArm) {
            this.bones.rightUpperArm.rotation.z = -1.4 + Math.sin(time * 6) * 0.15;
            this.bones.leftUpperArm.rotation.z = 1.4 - Math.sin(time * 6) * 0.15;
          }
          break;
        }
        case 'Shy': {
          // Gentle sway, tucking arms in
          targetY = this.basePosY + Math.sin(time * 1.8) * 0.008;
          this.model.rotation.y += Math.sin(time * 1.8) * 0.1;
          this.model.rotation.x = 0.08;
          if (this.bones.head) {
            this.bones.head.rotation.x = 0.12;
            this.bones.head.rotation.z = -0.08;
          }
          break;
        }
      }

      this.model.position.y = targetY;

      // Update VRM spring bones and expression manager
      if (this.vrm) {
        try {
          this.vrm.update(delta);
        } catch (_) {}
      }
    }

    // 8. Render Scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('naura-hero-3d-canvas');
  if (canvas) {
    window.__heroViewer = new NauraHeroPreview(canvas);
  }
});
