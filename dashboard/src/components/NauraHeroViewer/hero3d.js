/**
 * hero3d.js - Modul Interactive 3D & VRM Hero Viewer untuk Naura Hoshino Web Dashboard.
 *
 * Mengelola:
 *   1. Three.js Scene, PerspectiveCamera, WebGLRenderer (ACESFilmic, SRGB, RoomEnvironment PBR).
 *   2. OrbitControls (360° Drag Rotate, Pinch/Scroll Zoom, Pan) dengan damping halus & batas polar.
 *   3. Smooth Head & Eye Cursor Tracking yang terisolasi saat tidak sedang drag kamera.
 *   4. Pemuatan model ganda: .vrm (@pixiv/three-vrm) dengan fallback .glb (GLTFLoader),
 *      serta metode switchModel(modelPath) untuk pergantian dinamis realtime.
 *   5. Sistem 8 Animasi Utama & Transisi Hermite S-Curve / SLERP tanpa sentakan.
 *   6. Autonomous Micro-Expressions: Single/Double Blinking, Lip-Sync phoneme, & Blendshape Lerp.
 *   7. Secondary Spring-Damper Physics untuk Ponytail & Spring Bones.
 *   8. Cyber-Anime Ambient Sparkle Particles & Click Burst.
 *   9. Snapshot Mode (unduh pose PNG transparan) & Reset Camera Glide.
 *  10. Adaptive Performance: IntersectionObserver auto-pause render saat di luar layar & DPR capping.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadModel } from "../NauraViewer/loader.js";
import { createAnimationController } from "../NauraViewer/animations.js";
import { createParticleSystem } from "../NauraViewer/particles.js";
import { createNauraBrand3D } from "../NauraViewer/brand3d.js";

export class NauraHero3DViewer {
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.options = {
            modelPath: options.modelPath || "/models/naura.vrm",
            cameraFov: options.cameraFov || 34,
            cameraZ: options.cameraZ || 1.25,
            cameraY: options.cameraY || 0.22,
            lookAtCursor: options.lookAtCursor ?? true,
            brandFxVisible: options.brandFxVisible ?? true,
            onProgress: options.onProgress || null,
            onLoad: options.onLoad || null,
            onError: options.onError || null,
            onModelSwitch: options.onModelSwitch || null,
            ...options,
        };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animController = null;
        this.particles = null;
        this.brand3d = null;     // Astral Halo of Hoshino & Holographic Pedestal
        this.brandFxVisible = this.options.brandFxVisible;
        this.audioEnergy = 0.0;
        this.modelRoot = null;   // Outer pivot untuk cursor tracking & orientasi
        this.modelGroup = null;  // Inner group untuk mesh dan animasi prosedural
        this.vrm = null;
        this.pmremGenerator = null;
        this.envTexture = null;
        this.skinnedMeshes = [];
        this.primarySkinnedMesh = null;
        this.bones = {};
        this.skirtBones = [];
        this.boneRestQuats = {};
        this.isLoaded = false;
        this.isLoadingModel = false;
        this.isVisible = true;
        this.isInteracting = false; // true saat pengguna sedang drag orbit
        this.isResettingCamera = false;

        this.clock = new THREE.Clock();
        this.animationFrameId = null;
        this.currentMood = "Happy";
        this.currentAnimName = "Idle";

        // Posisi default kamera untuk reset
        this.defaultCameraPos = new THREE.Vector3(0, this.options.cameraY, this.options.cameraZ);
        this.defaultTargetPos = new THREE.Vector3(0, 0.18, 0);

        // Kursor ternormalisasi (-1 s/d 1)
        this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

        // Sistem kedipan otonom (Micro-Expressions)
        this.blinkState = {
            timer: 0,
            interval: 3.2,
            duration: 0.16,
            progress: 0,
            isBlinking: false,
            isDoubleBlink: false,
            currentWeight: 0,
        };

        // Bobot ekspresi wajah
        this.morphWeights = {
            Happy: 1.0,
            Thinking: 0.0,
            Sad: 0.0,
            Angry: 0.0,
            Blink: 0.0,
            Talk: 0.0,
        };
        this.targetMorphWeights = {
            Happy: 1.0,
            Thinking: 0.0,
            Sad: 0.0,
            Angry: 0.0,
            Blink: 0.0,
            Talk: 0.0,
        };

        // Fisika sekunder (Spring-Damper) untuk kuncir rambut
        this.ponytailPhysics = {
            angleY: 0,
            velY: 0,
            angleZ: 0,
            velZ: 0,
        };

        this._onPointerMove = this._onPointerMove.bind(this);
        this._onResize = this._onResize.bind(this);
        this._animate = this._animate.bind(this);

        this._resizeObserver = null;
        this._intersectionObserver = null;
    }

    /**
     * Inisialisasi renderer Three.js, lighting, controls, dan load model.
     */
    async init() {
        if (!this.canvas) return false;

        try {
            this._initThree();
            this._initLighting();
            this._initControls();
            this._initEvents();
            await this._loadNauraModel();
            this._animate();
            if (typeof this.options.onLoad === "function") {
                this.options.onLoad();
            }
            return true;
        } catch (err) {
            console.error("[NauraHero3DViewer] Gagal inisialisasi 3D:", err);
            if (typeof this.options.onError === "function") {
                this.options.onError(err);
            }
            return false;
        }
    }

    _initThree() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || this.canvas.parentElement?.clientWidth || 360;
        const height = rect.height || this.canvas.parentElement?.clientHeight || 460;

        // 1. Scene & Outer Model Root Pivot
        this.scene = new THREE.Scene();
        this.modelRoot = new THREE.Group();
        this.scene.add(this.modelRoot);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(
            this.options.cameraFov,
            width / height,
            0.1,
            20
        );
        this.camera.position.copy(this.defaultCameraPos);
        this.camera.lookAt(this.defaultTargetPos);

        // 3. WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true, // Diperlukan untuk snapshot/foto PNG
        });
        this.renderer.setSize(width, height, false);

        // DPR Capping adaptif: 1.5x di mobile, 2x di desktop
        const maxDpr = window.innerWidth < 768 ? 1.5 : 2;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        // 4. PMREM Environment
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();
        const roomEnv = new RoomEnvironment();
        this.envTexture = this.pmremGenerator.fromScene(roomEnv).texture;
        roomEnv.dispose();
        this.pmremGenerator.dispose();
        this.scene.environment = this.envTexture;
    }

    _initLighting() {
        // Soft Ambient Light merata
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
        this.scene.add(ambientLight);

        // Key Light hangat natural
        const keyLight = new THREE.DirectionalLight(0xfff8f2, 1.25);
        keyLight.position.set(1.4, 2.0, 1.6);
        this.scene.add(keyLight);

        // Soft Front Fill Light (Menerangi wajah dan detail rambut anime secara cerah dan jelas)
        const frontFillLight = new THREE.DirectionalLight(0xfff5ea, 0.85);
        frontFillLight.position.set(0, 1.2, 2.2);
        this.scene.add(frontFillLight);

        // Cyber Neon Rim Light (Cherry Blossom Pink)
        const rimPink = new THREE.DirectionalLight(0xffb3cb, 0.35);
        rimPink.position.set(-1.6, 1.2, -1.2);
        this.scene.add(rimPink);

        // Cyber Accent Light (Cyan Neon)
        const fillCyan = new THREE.PointLight(0x38bdf8, 0.4, 6);
        fillCyan.position.set(-1.0, -0.3, 1.2);
        this.scene.add(fillCyan);
    }

    _initControls() {
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 0.65;
        this.controls.maxDistance = 2.4;
        this.controls.minPolarAngle = Math.PI * 0.15; // Cegah sudut terlalu atas
        this.controls.maxPolarAngle = Math.PI * 0.58; // Cegah tembus bawah tanah
        this.controls.target.copy(this.defaultTargetPos);
        this.controls.autoRotate = false;

        this.controls.addEventListener("start", () => {
            this.isInteracting = true;
        });

        this.controls.addEventListener("end", () => {
            this.isInteracting = false;
        });
    }

    _initEvents() {
        // ResizeObserver pada canvas/parent
        if (typeof ResizeObserver !== "undefined") {
            this._resizeObserver = new ResizeObserver(() => this._onResize());
            this._resizeObserver.observe(this.canvas);
        } else {
            window.addEventListener("resize", this._onResize);
        }

        // Pointer tracking
        window.addEventListener("pointermove", this._onPointerMove);

        // Click interaction: trigger burst sparkle
        this.canvas.addEventListener("click", () => {
            if (this.particles) {
                this.particles.burst(30);
            }
        });

        // IntersectionObserver untuk hemat daya saat scroll keluar layar
        if (typeof IntersectionObserver !== "undefined") {
            this._intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    this.isVisible = entry.isIntersecting;
                    if (this.isVisible && !this.animationFrameId) {
                        this.clock.start();
                        this._animate();
                    }
                });
            }, { threshold: 0.05 });
            this._intersectionObserver.observe(this.canvas);
        }
    }

    async _loadNauraModel() {
        this.isLoadingModel = true;
        try {
            const { scene, vrm, animations, format } = await loadModel(
                this.options.modelPath,
                this.options.onProgress
            );
            this.modelGroup = scene;
            this.vrm = vrm;
            this.modelFormat = format || (vrm ? "vrm" : "glb");
            this.skinnedMeshes = [];
            this.primarySkinnedMesh = null;
            this.bones = {};
            this.skirtBones = [];
            this.boneRestQuats = {};

            this.modelGroup.traverse((node) => {
                if (node.isBone && /skirt|dress|cloth/i.test(node.name)) {
                    this.skirtBones.push(node);
                    this.boneRestQuats[node.name] = node.quaternion.clone();
                }

                if (node.isMesh || node.isSkinnedMesh) {
                    if (node.isSkinnedMesh) {
                        this.skinnedMeshes.push(node);
                    }

                    if (!this.primarySkinnedMesh && node.morphTargetDictionary) {
                        this.primarySkinnedMesh = node;
                    }

                    if (node.skeleton && node.skeleton.bones && Object.keys(this.bones).length === 0) {
                        node.skeleton.bones.forEach((b) => {
                            this.bones[b.name] = b;
                            if (!this.boneRestQuats[b.name]) {
                                this.boneRestQuats[b.name] = b.quaternion.clone();
                            }
                            if (/skirt|dress|cloth/i.test(b.name) && !this.skirtBones.includes(b)) {
                                this.skirtBones.push(b);
                            }
                        });
                    }

                    const materials = Array.isArray(node.material)
                        ? node.material
                        : node.material
                            ? [node.material]
                            : [];

                    materials.forEach((mat) => {
                        if (mat && mat.isMaterial) {
                            mat.side = THREE.DoubleSide;
                            if (mat.isMeshStandardMaterial) {
                                mat.metalness = 0.0;
                                mat.roughness = 0.75;
                                mat.roughnessMap = null;
                                mat.metalnessMap = null;
                                if ("envMapIntensity" in mat) {
                                    mat.envMapIntensity = 0.5;
                                }
                            }
                            mat.needsUpdate = true;
                        }
                    });
                }
            });

            this.modelGroup.position.set(0, -0.02, 0);
            this.modelGroup.rotation.y = -Math.PI / 2;
            if (this.modelRoot) {
                this.modelRoot.add(this.modelGroup);
            } else {
                this.scene.add(this.modelGroup);
            }

            // Animation Controller
            this.animController = createAnimationController(
                this.modelGroup,
                animations,
                this.vrm,
                { lookAtCursor: this.options.lookAtCursor }
            );

            // Cyber sparkle particles & 3D Star Fragments
            if (!this.particles) {
                try {
                    this.particles = createParticleSystem(this.scene);
                } catch (_) {}
            }

            // Astral Halo of Hoshino & Holographic Cyber Pedestal
            if (!this.brand3d) {
                try {
                    this.brand3d = createNauraBrand3D(this.scene, {
                        visible: this.brandFxVisible,
                        haloY: 0.52,
                        pedestalY: -0.55,
                    });
                } catch (err) {
                    console.warn("[NauraHero3D] Gagal inisialisasi brand3d:", err);
                }
            }

            this.isLoaded = true;
        } finally {
            this.isLoadingModel = false;
        }
    }

    /**
     * Beralih secara mulus antara model GLB dan VRM secara realtime.
     * @param {string} modelPath - Misal "/models/naura.glb" atau "/models/naura.vrm"
     * @returns {Promise<boolean>}
     */
    async switchModel(modelPath) {
        if (!modelPath) return false;
        while (this.isLoadingModel) {
            await new Promise((r) => setTimeout(r, 100));
        }
        if (this.options.modelPath === modelPath && this.isLoaded) return true;

        this.isLoadingModel = true;
        this.options.modelPath = modelPath;

        if (typeof this.options.onProgress === "function") {
            this.options.onProgress(10);
        }

        try {
            // Hentikan controller animasi yang sedang berjalan
            if (this.animController && this.animController.destroy) {
                this.animController.destroy();
                this.animController = null;
            }

            // Bersihkan model scene lama dari GPU
            if (this.modelGroup) {
                if (this.modelRoot) {
                    this.modelRoot.remove(this.modelGroup);
                } else if (this.scene) {
                    this.scene.remove(this.modelGroup);
                }

                this.modelGroup.traverse((node) => {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        const mats = Array.isArray(node.material) ? node.material : [node.material];
                        mats.forEach((m) => {
                            if (m.map) m.map.dispose();
                            if (m.normalMap) m.normalMap.dispose();
                            if (m.roughnessMap) m.roughnessMap.dispose();
                            if (m.metalnessMap) m.metalnessMap.dispose();
                            m.dispose();
                        });
                    }
                });
            }

            if (this.vrm) {
                try {
                    if (this.vrm.dispose) this.vrm.dispose();
                } catch (_) {}
                this.vrm = null;
            }

            this.skinnedMeshes = [];
            this.primarySkinnedMesh = null;
            this.bones = {};
            this.skirtBones = [];
            this.boneRestQuats = {};
            this.modelGroup = null;
            this.isLoaded = false;

            // Muat model baru
            await this._loadNauraModel();

            // Pulihkan state animasi dan mood aktif
            const restoreAnim = this.currentAnimName || "Idle";
            this.playAnimation(restoreAnim, { loop: true });
            if (this.currentMood) {
                this.setMood(this.currentMood);
            }

            if (typeof this.options.onLoad === "function") {
                this.options.onLoad();
            }

            if (typeof this.options.onModelSwitch === "function") {
                this.options.onModelSwitch(modelPath);
            }

            if (this.particles) {
                this.particles.burst(35);
            }

            this.isLoadingModel = false;
            return true;
        } catch (err) {
            console.error("[NauraHero3DViewer] Gagal beralih model ke " + modelPath + ":", err);
            this.isLoadingModel = false;
            if (typeof this.options.onError === "function") {
                this.options.onError(err);
            }
            return false;
        }
    }

    _onPointerMove(event) {
        if (!this.options.lookAtCursor) return;

        const rect = this.canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const rawX = (event.clientX - cx) / (window.innerWidth / 2);
        const rawY = -(event.clientY - cy) / (window.innerHeight / 2);

        this.mouse.targetX = Math.max(-1, Math.min(1, rawX));
        this.mouse.targetY = Math.max(-1, Math.min(1, rawY));
    }

    _onResize() {
        if (!this.canvas || !this.renderer || !this.camera) return;
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || this.canvas.parentElement?.clientWidth || 360;
        const height = rect.height || this.canvas.parentElement?.clientHeight || 460;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    _animate() {
        if (!this.isVisible) {
            this.animationFrameId = null;
            return;
        }

        this.animationFrameId = requestAnimationFrame(this._animate);

        const delta = Math.min(this.clock.getDelta(), 0.1);
        const elapsed = this.clock.getElapsedTime();

        // 1. Update OrbitControls
        if (this.controls) {
            this.controls.update();
        }

        // 2. Glide smooth reset camera
        if (this.isResettingCamera) {
            this._updateCameraGlide(delta);
        }

        // 3. Update AnimationMixer & procedural kinematic engine (which updates vrm physics then sets humanoid bones)
        if (this.animController) {
            this.animController.update(delta, elapsed);
        }

        // Penstabil tulang rok (Skirt Bone Stabilizer) untuk menjaga tekstur rok tetap stabil ke bawah
        if (this.skirtBones && this.skirtBones.length > 0) {
            for (let i = 0; i < this.skirtBones.length; i++) {
                const b = this.skirtBones[i];
                const restQuat = this.boneRestQuats[b.name];
                if (restQuat) {
                    b.quaternion.slerp(restQuat, 0.45);
                }
            }
        }

        // 4. Mouse dampening
        const mouseDecay = 1.0 - Math.exp(-12.0 * delta);
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * mouseDecay;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * mouseDecay;

        // 5. Cursor Tracking: Terisolasi pada outer pivot container atau tulang leher/kepala
        // Hanya aktif saat pengguna TIDAK sedang melakukan drag orbit
        if (this.options.lookAtCursor && !this.isInteracting) {
            const lookYaw = -this.mouse.x * 0.30;
            const lookPitch = this.mouse.y * 0.16;
            const headTilt = -this.mouse.x * 0.05;

            if (this.vrm) {
                // Pada model VRM, rotasikan modelRoot secara halus agar seluruh tubuh Naura
                // merespons posisi kursor tanpa merusak artikulasi anatomis animasi kepala/leher
                const lerpSpeed = 1.0 - Math.exp(-8.0 * delta);
                if (this.modelRoot) {
                    this.modelRoot.rotation.y += (lookYaw * 0.45 - this.modelRoot.rotation.y) * lerpSpeed;
                    this.modelRoot.rotation.x += (lookPitch * 0.45 - this.modelRoot.rotation.x) * lerpSpeed;
                    this.modelRoot.rotation.z += (headTilt * 0.45 - this.modelRoot.rotation.z) * lerpSpeed;
                }
            } else if (this.bones.Head && this.boneRestQuats.Head) {
                const headEuler = new THREE.Euler(headTilt * 0.6, lookYaw * 0.50, lookPitch * 0.50, "YXZ");
                this.bones.Head.quaternion.copy(this.boneRestQuats.Head).multiply(new THREE.Quaternion().setFromEuler(headEuler));

                if (this.bones.Neck && this.boneRestQuats.Neck) {
                    const neckEuler = new THREE.Euler(headTilt * 0.25, lookYaw * 0.35, lookPitch * 0.35, "YXZ");
                    this.bones.Neck.quaternion.copy(this.boneRestQuats.Neck).multiply(new THREE.Quaternion().setFromEuler(neckEuler));
                }

                if (this.bones.Chest && this.boneRestQuats.Chest) {
                    const chestEuler = new THREE.Euler(0, lookYaw * 0.15, lookPitch * 0.15, "YXZ");
                    this.bones.Chest.quaternion.copy(this.boneRestQuats.Chest).multiply(new THREE.Quaternion().setFromEuler(chestEuler));
                }
            } else if (this.modelRoot) {
                // Procedural tilt & orientasi halus pada modelRoot
                const targetRotY = -this.mouse.x * 0.28;
                const targetRotX = this.mouse.y * 0.14;
                const targetRotZ = -this.mouse.x * 0.05;

                const lerpSpeed = 1.0 - Math.exp(-8.0 * delta);
                this.modelRoot.rotation.y += (targetRotY - this.modelRoot.rotation.y) * lerpSpeed;
                this.modelRoot.rotation.x += (targetRotX - this.modelRoot.rotation.x) * lerpSpeed;
                this.modelRoot.rotation.z += (targetRotZ - this.modelRoot.rotation.z) * lerpSpeed;
            }

            // Spring-damper untuk Ponytail (hanya jika VRM tidak mengelola springBoneManager sendiri)
            if (this.bones.Ponytail && !this.vrm?.springBoneManager) {
                const targetAngleY = -lookYaw * 0.25 + Math.sin(elapsed * 1.8) * 0.03;
                const targetAngleZ = -lookPitch * 0.20 + Math.cos(elapsed * 1.2) * 0.02;

                const stiffness = 85.0;
                const damping = 9.0;

                const forceY = (targetAngleY - this.ponytailPhysics.angleY) * stiffness - this.ponytailPhysics.velY * damping;
                this.ponytailPhysics.velY += forceY * delta;
                this.ponytailPhysics.angleY += this.ponytailPhysics.velY * delta;

                const forceZ = (targetAngleZ - this.ponytailPhysics.angleZ) * stiffness - this.ponytailPhysics.velZ * damping;
                this.ponytailPhysics.velZ += forceZ * delta;
                this.ponytailPhysics.angleZ += this.ponytailPhysics.velZ * delta;

                const ponyEuler = new THREE.Euler(
                    Math.sin(elapsed * 1.5) * 0.03,
                    this.ponytailPhysics.angleY,
                    this.ponytailPhysics.angleZ,
                    "YXZ"
                );
                if (this.boneRestQuats.Ponytail) {
                    this.bones.Ponytail.quaternion.copy(this.boneRestQuats.Ponytail).multiply(new THREE.Quaternion().setFromEuler(ponyEuler));
                }
            }
        }

        // 6. Micro-expressions & Blinking
        this._updateBlinking(delta);
        this._updateMorphs(delta, elapsed);

        // 7. Partikel update (Cyber sparks & 3D Star Fragments)
        if (this.particles) {
            this.particles.update(delta, elapsed);
        }

        // 7b. Astral Halo of Hoshino & Holographic Pedestal update
        if (this.brand3d) {
            this.brand3d.update(delta, elapsed, {
                audioEnergy: this.audioEnergy,
            });
        }

        // 8. Render
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    _updateBlinking(delta) {
        this.blinkState.timer += delta;
        if (!this.blinkState.isBlinking && this.blinkState.timer >= this.blinkState.interval) {
            this.blinkState.isBlinking = true;
            this.blinkState.progress = 0;
            this.blinkState.isDoubleBlink = Math.random() < 0.2;
            this.blinkState.duration = this.blinkState.isDoubleBlink ? 0.28 : 0.16;
        }

        if (this.blinkState.isBlinking) {
            this.blinkState.progress += delta / this.blinkState.duration;
            const p = this.blinkState.progress;

            let blinkVal = 0;
            if (this.blinkState.isDoubleBlink) {
                blinkVal = Math.max(0, Math.sin(p * Math.PI * 2));
            } else {
                if (p <= 0.35) {
                    blinkVal = p / 0.35;
                } else if (p <= 1.0) {
                    blinkVal = 1.0 - (p - 0.35) / 0.65;
                }
            }

            this.blinkState.currentWeight = Math.max(0, Math.min(1, blinkVal));

            if (p >= 1.0) {
                this.blinkState.isBlinking = false;
                this.blinkState.timer = 0;
                this.blinkState.interval = 2.8 + Math.random() * 2.5;
                this.blinkState.currentWeight = 0;
            }
        } else {
            this.blinkState.currentWeight = 0;
        }
    }

    _updateMorphs(delta, elapsed) {
        const morphDecay = 1.0 - Math.exp(-14.0 * delta);

        if (this.currentMood === "Talk") {
            this.targetMorphWeights.Talk = 0.2 + Math.abs(Math.sin(elapsed * 9.0) * Math.cos(elapsed * 4.5)) * 0.7;
        }

        for (const key of Object.keys(this.morphWeights)) {
            const target = this.targetMorphWeights[key] || 0;
            this.morphWeights[key] += (target - this.morphWeights[key]) * morphDecay;
        }

        const activeBlink = Math.max(this.morphWeights.Blink, this.blinkState.currentWeight || 0);
        const isIdle = !this.animController || this.animController.getActiveAnim() === "Idle";

        if (this.vrm && this.vrm.expressionManager) {
            if (activeBlink > 0) {
                try {
                    this.vrm.expressionManager.setValue("blink", activeBlink);
                } catch (_) {}
            }
            if (isIdle || this.currentMood === "Talk") {
                const vrmExprMap = {
                    Happy: "happy",
                    Sad: "sad",
                    Angry: "angry",
                    Thinking: "relaxed",
                    Talk: "aa",
                };
                for (const [key, exprName] of Object.entries(vrmExprMap)) {
                    try {
                        this.vrm.expressionManager.setValue(exprName, Math.max(0, Math.min(1, this.morphWeights[key])));
                    } catch (_) {}
                }
            }
        } else if (this.vrm && this.vrm.blendShapeProxy) {
            if (activeBlink > 0) {
                try {
                    this.vrm.blendShapeProxy.setValue("Blink", activeBlink);
                } catch (_) {}
            }
            if (isIdle || this.currentMood === "Talk") {
                const vrm0Map = {
                    Happy: "Joy",
                    Sad: "Sorrow",
                    Angry: "Angry",
                    Thinking: "Fun",
                    Talk: "A",
                };
                for (const [key, blendName] of Object.entries(vrm0Map)) {
                    try {
                        this.vrm.blendShapeProxy.setValue(blendName, Math.max(0, Math.min(1, this.morphWeights[key])));
                    } catch (_) {}
                }
            }
        } else if (this.primarySkinnedMesh && this.primarySkinnedMesh.morphTargetDictionary) {
            const dict = this.primarySkinnedMesh.morphTargetDictionary;
            const influences = this.primarySkinnedMesh.morphTargetInfluences;
            for (const [key, val] of Object.entries(this.morphWeights)) {
                const idx = dict[key];
                if (idx !== undefined) {
                    const finalVal = key === "Blink" ? activeBlink : val;
                    influences[idx] = Math.max(0, Math.min(1, finalVal));
                }
            }
        }
    }

    _updateCameraGlide(delta) {
        const lerpFactor = 1.0 - Math.exp(-9.0 * delta);
        this.camera.position.lerp(this.defaultCameraPos, lerpFactor);
        this.controls.target.lerp(this.defaultTargetPos, lerpFactor);

        if (
            this.camera.position.distanceTo(this.defaultCameraPos) < 0.005 &&
            this.controls.target.distanceTo(this.defaultTargetPos) < 0.005
        ) {
            this.camera.position.copy(this.defaultCameraPos);
            this.controls.target.copy(this.defaultTargetPos);
            this.isResettingCamera = false;
        }
    }

    /**
     * Putar animasi gerakan utama dengan transisi mulus.
     * @param {string} name - 'Idle' | 'Wave' | 'Thinking' | 'Dizzy' | 'Cheers' | 'Shy' | 'Sleepy' | 'BlowKiss' | 'AstralCast' | 'StarPose'
     * @param {Object} [options]
     */
    playAnimation(name, options = {}) {
        const validNames = [
            "Idle",
            "Wave",
            "Thinking",
            "Dizzy",
            "Cheers",
            "Shy",
            "Sleepy",
            "BlowKiss",
            "AstralCast",
            "StarPose",
        ];
        const resolvedName = validNames.find(n => n.toLowerCase() === (name || "").toLowerCase()) || "Idle";
        this.currentAnimName = resolvedName;

        // Auto update status text if present
        const statusText = document.getElementById("naura3d-status-text");
        if (statusText) {
            const labelMap = {
                Idle: "🌸 Idle (Bernafas)",
                Wave: "👋 Melambai Hangat",
                Thinking: "🤔 Berpikir Kritis",
                Dizzy: "💫 Pusing / Bingung",
                Cheers: "🎉 Ceria Bersorak",
                Shy: "😳 Malu-malu",
                Sleepy: "💤 Mengantuk",
                BlowKiss: "😘 Tiup Ciuman",
                AstralCast: "✨ Sihir Bintang Hoshino",
                StarPose: "⭐ Pose Idol Hoshino",
            };
            statusText.textContent = labelMap[resolvedName] || resolvedName;
        }

        // Efek Visual Khusus 3D Brand saat animasi dipicu
        if (resolvedName === "AstralCast") {
            if (this.brand3d) this.brand3d.pulse(1.5);
            if (this.particles) {
                if (typeof this.particles.starShower === "function") {
                    this.particles.starShower(65);
                } else if (typeof this.particles.burst === "function") {
                    this.particles.burst(50);
                }
            }
        } else if (resolvedName === "StarPose") {
            if (this.brand3d) this.brand3d.pulse(1.2);
            if (this.particles && typeof this.particles.burst === "function") {
                this.particles.burst(40);
            }
        }

        // Synchronize facial mood
        this.setMood(resolvedName);

        if (this.animController && this.animController.playClip) {
            const isLoop = options.loop ?? (resolvedName === "Idle" || resolvedName === "Dizzy" || resolvedName === "Sleepy" || resolvedName === "Thinking" || resolvedName === "Shy");
            return this.animController.playClip(resolvedName, {
                loop: isLoop,
                fadeDuration: options.fadeDuration || 0.45,
                onFinish: () => {
                    if (typeof options.onFinish === "function") options.onFinish();
                    if (!isLoop) {
                        this.currentAnimName = "Idle";
                        if (statusText) statusText.textContent = "🌸 Idle (Bernafas)";
                        this.setMood("Idle");
                    }
                },
            });
        }
        return null;
    }

    /**
     * Alias untuk playAnimation agar kompatibel dengan berbagai pemanggil API.
     */
    playAction(name, options = {}) {
        return this.playAnimation(name, options);
    }

    /**
     * Set mood dan ekspresi wajah.
     * @param {string} mood - 'Happy' | 'Thinking' | 'Sad' | 'Angry' | 'Sleepy' | 'Talk'
     */
    setMood(mood) {
        const norm = (mood || "Happy").toLowerCase();
        const mapping = {
            happy: "Happy",
            cheers: "Happy",
            wave: "Happy",
            talk: "Talk",
            thinking: "Thinking",
            confused: "Thinking",
            sad: "Sad",
            cry: "Sad",
            angry: "Angry",
            sleepy: "Blink",
            idle: "Happy",
            blowkiss: "Happy",
            shy: "Happy",
            dizzy: "Thinking",
            astral: "Happy",
            astralcast: "Happy",
            starpose: "Happy",
            idol: "Happy",
        };

        const target = mapping[norm] || "Happy";
        this.currentMood = target;

        for (const k of Object.keys(this.targetMorphWeights)) {
            this.targetMorphWeights[k] = k === target ? 1.0 : 0.0;
        }

        if (this.animController && this.animController.setMood) {
            this.animController.setMood(norm);
        }

        if (this.particles) {
            this.particles.burst(20);
        }
    }

    /**
     * Kembalikan posisi kamera dan target ke sudut awal secara animasi halus.
     */
    resetCamera() {
        this.isResettingCamera = true;
        if (this.particles) {
            this.particles.burst(15);
        }
    }

    /**
     * Ambil foto pose Naura resolusi tinggi berlatar transparan dan unduh file PNG.
     * @param {string} [filename="naura-pose.png"]
     */
    takeSnapshot(filename = "naura-pose.png") {
        if (!this.renderer || !this.scene || !this.camera) return;

        this.renderer.render(this.scene, this.camera);

        this.canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            if (this.particles) {
                this.particles.burst(40);
            }
        }, "image/png");
    }

    /**
     * Tampilkan atau sembunyikan efek Astral Halo & Holographic Pedestal.
     * @param {boolean} val
     */
    setBrandFxVisible(val) {
        this.brandFxVisible = Boolean(val);
        if (this.brand3d) {
            this.brand3d.setVisibility(this.brandFxVisible);
        }
    }

    /**
     * Toggle status efek Astral Halo & Holographic Pedestal.
     * @returns {boolean} Status baru.
     */
    toggleBrandFx() {
        this.brandFxVisible = !this.brandFxVisible;
        if (this.brand3d) {
            this.brand3d.setVisibility(this.brandFxVisible);
        }
        return this.brandFxVisible;
    }

    /**
     * Memicu denyut pendaran starlight pada Astral Halo.
     * @param {number} [intensity=1.2]
     */
    pulseBrandFx(intensity = 1.2) {
        if (this.brand3d) {
            this.brand3d.pulse(intensity);
        }
    }

    /**
     * Mengatur energi reaktivitas audio (mode AI DJ).
     * @param {number} energy - 0.0 s/d 1.0
     */
    setAudioEnergy(energy) {
        this.audioEnergy = Math.max(0, Math.min(1.0, energy));
        if (this.brand3d) {
            this.brand3d.setAudioEnergy(this.audioEnergy);
        }
    }

    /**
     * Lepas resource GPU dan event listeners.
     */
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        } else {
            window.removeEventListener("resize", this._onResize);
        }

        if (this._intersectionObserver) {
            this._intersectionObserver.disconnect();
            this._intersectionObserver = null;
        }

        window.removeEventListener("pointermove", this._onPointerMove);

        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        if (this.animController && this.animController.destroy) {
            this.animController.destroy();
        }

        if (this.particles && this.particles.dispose) {
            this.particles.dispose();
        }

        if (this.brand3d && this.brand3d.dispose) {
            this.brand3d.dispose();
            this.brand3d = null;
        }

        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const mats = Array.isArray(object.material) ? object.material : [object.material];
                    mats.forEach((mat) => {
                        if (mat.map) mat.map.dispose();
                        if (mat.normalMap) mat.normalMap.dispose();
                        if (mat.roughnessMap) mat.roughnessMap.dispose();
                        if (mat.metalnessMap) mat.metalnessMap.dispose();
                        mat.dispose();
                    });
                }
            });
        }

        if (this.envTexture) {
            this.envTexture.dispose();
            this.envTexture = null;
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        if (this.vrm) {
            try {
                if (this.vrm.dispose) this.vrm.dispose();
            } catch (_) {}
            this.vrm = null;
        }

        this.scene = null;
        this.camera = null;
        this.modelRoot = null;
        this.modelGroup = null;
        this.skinnedMeshes = [];
        this.primarySkinnedMesh = null;
        this.bones = {};
        this.boneRestQuats = {};
        this.isLoaded = false;
    }
}
