/**
 * viewer3d.js - Modul Renderer 3D WebGL Realtime untuk NauraViewer (NAURA OS).
 *
 * Mengelola:
 *   1. Three.js Scene, PerspectiveCamera, WebGLRenderer (antialiased, transparent background).
 *   2. Studio Lighting: Key light, Ambient fill, & Anime Neon Rim Light (Pink/Cyan).
 *   3. Pemuatan & penataan model 3D rigged GLB (models/naura.glb).
 *   4. Cursor Tracking: Kepala dan mata Naura mengikuti pergerakan kursor pengguna secara halus.
 *   5. Interaktivitas klik: Memutar animasi wave & memicu partikel sparkle.
 *   6. Animasi ekspresi & blend shapes (Happy, Thinking, Sad, Angry, Blink, Talk).
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadModel } from "./loader.js";
import { createAnimationController } from "./animations.js";
import { createParticleSystem } from "./particles.js";
import { createNauraBrand3D } from "./brand3d.js";

export class Naura3DViewer {
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.options = {
            modelPath: options.modelPath || "/models/naura.glb",
            autoRotate: options.autoRotate ?? false,
            lookAtCursor: options.lookAtCursor ?? true,
            cameraFov: options.cameraFov || 38,
            cameraZ: options.cameraZ || 1.15,
            cameraY: options.cameraY || 0.28,
            ...options,
        };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animController = null;
        this.particles = null;
        this.brand3d = null; // Astral Halo & Holographic Pedestal
        this.modelGroup = null;
        this.vrm = null;
        this.pmremGenerator = null;
        this.envTexture = null;
        // Simpan semua SkinnedMesh (model bisa punya banyak: tubuh, rambut, baju)
        this.skinnedMeshes = [];
        // Referensi ke skinnedMesh primer untuk morph target (yang punya morphTargetDictionary)
        this.primarySkinnedMesh = null;
        this.bones = {};
        this.boneRestQuats = {};
        this.isLoaded = false;
        this.isPaused = false;
        this.audioEnergy = 0;
        this.clock = new THREE.Clock();
        this.animationFrameId = null;
        this.currentMood = "happy";

        // Koordinat kursor ternormalisasi (-1 s/d 1)
        this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.isHovered = false;

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

        // Bobot ekspresi wajah dengan interpolasi halus (lerp)
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

        this._onMouseMove = this._onMouseMove.bind(this);
        this._onResize = this._onResize.bind(this);
        this._animate = this._animate.bind(this);

        // ResizeObserver untuk resize yang lebih akurat dibanding window resize
        this._resizeObserver = null;
    }

    /**
     * Inisialisasi Scene Three.js dan muat model 3D.
     */
    async init() {
        if (!this.canvas) return false;

        try {
            this._initThree();
            this._initLighting();
            this._initEvents();
            await this._loadNauraModel();
            this._animate();
            return true;
        } catch (err) {
            console.warn("[Naura3DViewer] Gagal inisialisasi WebGL 3D, menggunakan fallback 2D:", err.message);
            return false;
        }
    }

    _initThree() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || 120;
        const height = rect.height || 120;

        // 1. Scene
        this.scene = new THREE.Scene();

        // 2. Camera: Fokus pada area dada s/d kepala karakter Naura (portrait framing)
        this.camera = new THREE.PerspectiveCamera(
            this.options.cameraFov,
            width / height,
            0.1,
            20
        );
        this.camera.position.set(0, this.options.cameraY, this.options.cameraZ);
        this.camera.lookAt(0, this.options.cameraY, 0);

        // 3. WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
        });
        this.renderer.setSize(width, height, false);
        // Batasi pixel ratio: ≤1.5 di viewport sempit (mobile), ≤2 di desktop
        const maxDpr = window.innerWidth < 768 ? 1.5 : 2;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // Naikkan exposure: karakter anime perlu lebih terang dari scene PBR default
        this.renderer.toneMappingExposure = 1.1;
        // Shadow map tidak diperlukan untuk floating widget kecil ini
        this.renderer.shadowMap.enabled = false;

        // 4. PMREMGenerator: Buat environment map dari RoomEnvironment agar
        //    MeshStandardMaterial (PBR) dapat merender tekstur & spekuler dengan benar.
        //    Tanpa env map, material metalik/PBR tampak hitam total meski ada tekstur.
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();
        const roomEnv = new RoomEnvironment();
        this.envTexture = this.pmremGenerator.fromScene(roomEnv).texture;
        roomEnv.dispose();
        this.pmremGenerator.dispose();
        this.scene.environment = this.envTexture;
        // Tidak set scene.background agar background tetap transparan
    }

    _initLighting() {
        // 1. Soft Ambient Fill - menjaga warna anime tetap cerah merata
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);

        // 2. Main Key Light (Hangat alami, dari depan atas kanan)
        const keyLight = new THREE.DirectionalLight(0xfff8f2, 1.2);
        keyLight.position.set(1.2, 1.8, 1.5);
        this.scene.add(keyLight);

        // 3. Cyber-Anime Rim Light (Neon Pink / Cherry Blossom - dari belakang kiri)
        const rimLightPink = new THREE.DirectionalLight(0xffb3cb, 0.35);
        rimLightPink.position.set(-1.5, 1.0, -1.0);
        this.scene.add(rimLightPink);

        // 4. Cyber Accent Light (Cyan Neon - dari bawah depan kiri)
        const fillLightCyan = new THREE.PointLight(0x38bdf8, 0.4, 5);
        fillLightCyan.position.set(-0.8, -0.2, 1.0);
        this.scene.add(fillLightCyan);
    }

    _initEvents() {
        // Gunakan ResizeObserver pada canvas agar lebih akurat dari window.resize
        // (window.resize juga trigger saat keyboard muncul di mobile)
        if (typeof ResizeObserver !== "undefined") {
            this._resizeObserver = new ResizeObserver(() => this._onResize());
            this._resizeObserver.observe(this.canvas);
        } else {
            // Fallback untuk browser lama
            window.addEventListener("resize", this._onResize);
        }

        window.addEventListener("mousemove", this._onMouseMove);

        // Interaksi klik: variasi animasi interaktif ramah dan khas Hoshino
        const clickReactions = ["Wave", "StarPose", "BlowKiss", "AstralCast", "Cheers", "Thinking", "Shy"];
        let reactionIdx = 0;
        this.canvas.addEventListener("click", () => {
            const chosen = clickReactions[reactionIdx % clickReactions.length];
            reactionIdx++;
            this.playAnimation(chosen);

            if (chosen === "AstralCast") {
                if (this.brand3d) this.brand3d.pulse(1.5);
                if (this.particles) {
                    if (typeof this.particles.starShower === "function") {
                        this.particles.starShower(45);
                    } else if (typeof this.particles.burst === "function") {
                        this.particles.burst(35);
                    }
                }
            } else if (chosen === "StarPose") {
                if (this.brand3d) this.brand3d.pulse(1.2);
                if (this.particles && typeof this.particles.burst === "function") {
                    this.particles.burst(30);
                }
            } else if (this.particles) {
                this.particles.burst(25);
            }
        });

        this.canvas.addEventListener("mouseenter", () => {
            this.isHovered = true;
        });

        this.canvas.addEventListener("mouseleave", () => {
            this.isHovered = false;
            this.mouse.targetX = 0;
            this.mouse.targetY = 0;
        });
    }

    async _loadNauraModel() {
        const { scene, vrm, animations } = await loadModel(this.options.modelPath);
        this.modelGroup = scene;
        this.vrm = vrm;

        // Temukan SEMUA SkinnedMesh dan petakan tulang
        // Model GLB/VRM karakter bisa punya banyak mesh: tubuh, rambut, baju, aksesori
        this.skinnedMeshes = [];
        this.primarySkinnedMesh = null;

        this.modelGroup.traverse((node) => {
            if (node.isMesh || node.isSkinnedMesh) {
                if (node.isSkinnedMesh) {
                    this.skinnedMeshes.push(node);
                }

                // Pilih mesh primer: yang pertama punya morphTargetDictionary (untuk ekspresi wajah)
                if (!this.primarySkinnedMesh && node.morphTargetDictionary) {
                    this.primarySkinnedMesh = node;
                }

                // Petakan tulang dari skeleton dan simpan orientasi awal (rest pose)
                if (node.skeleton && node.skeleton.bones && Object.keys(this.bones).length === 0) {
                    node.skeleton.bones.forEach((b) => {
                        this.bones[b.name] = b;
                        this.boneRestQuats[b.name] = b.quaternion.clone();
                    });
                }

                // Optimasi material PBR, handle material tunggal MAUPUN array material
                const materials = Array.isArray(node.material)
                    ? node.material
                    : node.material
                        ? [node.material]
                        : [];

                materials.forEach((mat) => {
                    if (mat && mat.isMaterial) {
                        mat.side = THREE.DoubleSide;
                        mat.metalness = 0.0;
                        mat.roughness = 0.75;
                        mat.roughnessMap = null;
                        mat.metalnessMap = null;
                        if ("envMapIntensity" in mat) {
                            mat.envMapIntensity = 0.5;
                        }
                        mat.needsUpdate = true;
                    }
                });
            }
        });

        // Posisikan model agar pas di viewport
        this.modelGroup.position.set(0, 0, 0);

        // Rotasi pada sumbu Y: karakter menghadap +Z sehingga wajah tepat menghadap kamera
        this.modelGroup.rotation.y = -Math.PI / 2;

        this.scene.add(this.modelGroup);

        // Siapkan Animation Controller, teruskan vrm bila ada
        this.animController = createAnimationController(
            this.modelGroup,
            animations,
            this.vrm,
            { lookAtCursor: this.options.lookAtCursor }
        );

        // Partikel ambient cyber-sparkle & 3D Star Fragments di sekitar Naura
        try {
            this.particles = createParticleSystem(this.scene);
        } catch (_) {
            // Partikel gagal, tidak kritis
        }

        // Astral Halo of Hoshino & Holographic Pedestal
        try {
            this.brand3d = createNauraBrand3D(this.scene, {
                visible: true,
                haloY: 0.52,
                pedestalY: -0.88,
            });
        } catch (_) {
            // Brand 3D opsional, tidak kritis
        }

        this.isLoaded = true;
    }

    _onMouseMove(event) {
        if (!this.options.lookAtCursor) return;

        // Normalisasi posisi mouse relatif terhadap tengah layar [-1, 1]
        this.mouse.targetX = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.targetY = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    /**
     * Handler mouse/pointer move terprogram atau interaktif langsung.
     * @param {MouseEvent|PointerEvent} event
     * @param {DOMRect} [customRect]
     */
    handlePointerMove(event, customRect) {
        if (!this.options.lookAtCursor) return;
        if (customRect) {
            const centerX = customRect.left + customRect.width / 2;
            const centerY = customRect.top + customRect.height / 2;
            this.mouse.targetX = Math.max(-1, Math.min(1, (event.clientX - centerX) / (customRect.width * 1.5)));
            this.mouse.targetY = Math.max(-1, Math.min(1, -(event.clientY - centerY) / (customRect.height * 1.5)));
        } else {
            this._onMouseMove(event);
        }
    }

    _onResize() {
        if (!this.canvas || !this.renderer || !this.camera) return;
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || 120;
        const height = rect.height || 120;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    _animate() {
        if (this.isPaused) {
            this.animationFrameId = null;
            return;
        }

        this.animationFrameId = requestAnimationFrame(this._animate);

        const elapsed = this.clock.getElapsedTime();
        const delta = Math.min(this.clock.getDelta(), 0.1); // Clamp delta cegah lonjakan waktu

        // 1. Update Animation Controller (Mixer glTF & procedural sway)
        if (this.animController) {
            this.animController.update(delta, elapsed);
        }

        // 2. Damping interpolasi kursor mouse yang halus dan independen framerate
        const mouseDecay = 1.0 - Math.exp(-12.0 * delta);
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * mouseDecay;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * mouseDecay;

        // 3. Cursor Tracking: Kinematic Chain (untuk model ber-skeleton) atau Procedural Tilt (untuk model mesh)
        if (this.modelGroup && this.options.lookAtCursor) {
            const lookYaw = -this.mouse.x * 0.32;    // menoleh kiri/kanan
            const lookPitch = this.mouse.y * 0.16;   // menengadah/menunduk
            const headTilt = -this.mouse.x * 0.06;   // kemiringan kepala alami (Z-roll)

            if (this.vrm) {
                // Pada model VRM, interpolasikan rotasi modelGroup secara halus menghadap depan (-PI/2)
                const lerpSpeed = 1.0 - Math.exp(-8.0 * delta);
                const targetRotY = -Math.PI / 2 + (-this.mouse.x * 0.28);
                const targetRotX = this.mouse.y * 0.14;
                const targetRotZ = -this.mouse.x * 0.05;

                this.modelGroup.rotation.y += (targetRotY - this.modelGroup.rotation.y) * lerpSpeed;
                this.modelGroup.rotation.x += (targetRotX - this.modelGroup.rotation.x) * lerpSpeed;
                this.modelGroup.rotation.z += (targetRotZ - this.modelGroup.rotation.z) * lerpSpeed;
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

                // Fisika sekunder (Spring-Damper) untuk kuncir rambut (Ponytail)
                if (this.bones.Ponytail && this.boneRestQuats.Ponytail) {
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
                    this.bones.Ponytail.quaternion.copy(this.boneRestQuats.Ponytail).multiply(new THREE.Quaternion().setFromEuler(ponyEuler));
                }
            } else {
                // Procedural tilt & sway halus yang mengikuti cursor mouse secara real-time
                const targetRotY = -Math.PI / 2 + (-this.mouse.x * 0.28);
                const targetRotX = this.mouse.y * 0.14;
                const targetRotZ = -this.mouse.x * 0.05;

                const lerpSpeed = 1.0 - Math.exp(-8.0 * delta);
                this.modelGroup.rotation.y += (targetRotY - this.modelGroup.rotation.y) * lerpSpeed;
                this.modelGroup.rotation.x += (targetRotX - this.modelGroup.rotation.x) * lerpSpeed;
                this.modelGroup.rotation.z += (targetRotZ - this.modelGroup.rotation.z) * lerpSpeed;
            }
        }

        // 4. Autonomous Blinking Engine (Micro-Expressions)
        this._updateBlinking(delta);

        // 5. Smooth Morph Target Interpolation
        this._updateMorphs(delta, elapsed);

        // 6. Update Partikel (Cyber sparks & 3D Star Fragments)
        if (this.particles) {
            this.particles.update(delta, elapsed);
        }

        // 6b. Update Brand 3D (Astral Halo & Holographic Pedestal)
        if (this.brand3d) {
            this.brand3d.update(delta, elapsed, {
                audioEnergy: this.audioEnergy,
            });
        }

        // 7. Render Scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Engine kedipan mata otonom: interval acak 2.8 - 5.0 detik dengan kemungkinan double-blink khas anime.
     */
    _updateBlinking(delta) {
        this.blinkState.timer += delta;
        if (!this.blinkState.isBlinking && this.blinkState.timer >= this.blinkState.interval) {
            this.blinkState.isBlinking = true;
            this.blinkState.progress = 0;
            this.blinkState.isDoubleBlink = Math.random() < 0.18;
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

    /**
     * Interpolasi bobot morph target secara halus (S-curve lerp) untuk semua ekspresi wajah.
     */
    _updateMorphs(delta, elapsed) {
        const morphDecay = 1.0 - Math.exp(-14.0 * delta);

        // Bicara dinamis jika mood adalah talk
        if (this.currentMood === "talk") {
            this.targetMorphWeights.Talk = 0.2 + Math.abs(Math.sin(elapsed * 9.0) * Math.cos(elapsed * 4.5)) * 0.7;
        }

        // Lerp setiap blendshape
        for (const key of Object.keys(this.morphWeights)) {
            const target = this.targetMorphWeights[key] || 0;
            this.morphWeights[key] += (target - this.morphWeights[key]) * morphDecay;
        }

        // Terapkan kedipan aditif
        const activeBlink = Math.max(this.morphWeights.Blink, this.blinkState.currentWeight || 0);

        if (this.vrm && this.vrm.expressionManager) {
            const vrmExprMap = {
                Happy: "happy",
                Sad: "sad",
                Angry: "angry",
                Thinking: "relaxed",
                Talk: "aa",
                Blink: "blink",
            };
            for (const [key, exprName] of Object.entries(vrmExprMap)) {
                const w = key === "Blink" ? activeBlink : this.morphWeights[key];
                try {
                    this.vrm.expressionManager.setValue(exprName, Math.max(0, Math.min(1, w)));
                } catch (_) {}
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

    /**
     * Set ekspresi wajah dan mood Naura dalam 3D secara transisi halus.
     * @param {string} mood - 'Happy' | 'Thinking' | 'Sad' | 'Angry' | 'Sleepy' | 'Read' | 'Cry' | 'Talk'
     */
    setMood(mood) {
        if (!this.isLoaded) return;
        const normalizedMood = (mood || "Happy").toLowerCase();
        this.currentMood = normalizedMood;

        const targetMapping = {
            happy: "Happy",
            cheers: "Happy",
            read: "Happy",
            talk: "Talk",
            thinking: "Thinking",
            confused: "Thinking",
            sad: "Sad",
            cry: "Sad",
            angry: "Angry",
            hmph: "Angry",
            annoy: "Angry",
            sleepy: "Blink",
            shocked: "Thinking",
            akward: "Thinking",
            surprised: "Thinking",
            idle: "Happy",
        };

        const targetName = targetMapping[normalizedMood] || "Happy";

        for (const k of Object.keys(this.targetMorphWeights)) {
            this.targetMorphWeights[k] = k === targetName ? 1.0 : 0.0;
        }

        // Postur Tulang & AnimationController
        if (this.animController && this.animController.setMood) {
            this.animController.setMood(normalizedMood);
        }

        if (this.particles) {
            this.particles.burst(15);
        }
    }

    /**
     * Memicu lambaian tangan menyapa.
     */
    triggerWave() {
        this.playAnimation("Wave");
    }

    /**
     * Mainkan animasi spesifik ('Idle', 'Wave', 'Thinking', 'Dizzy', 'Cheers', 'Shy', 'Sleepy', 'BlowKiss')
     * @param {string} name
     * @param {Object} [options]
     */
    playAnimation(name, options = {}) {
        if (this.animController && this.animController.playClip) {
            return this.animController.playClip(name, options);
        }
        return null;
    }

    /**
     * Wardrobe & Skin Tint Shader Selector.
     * Mengubah palet kostum 3D model Naura secara dinamis:
     * - 'cyberpunk': Neon cyan & magenta rim
     * - 'maid': Monokromatik klasik elegan
     * - 'casual': Pastel peach & soft lavender
     * - 'adventurer': Emerald moss & gold bronze
     * @param {string} skinName
     */
    setSkin(skinName = "cyberpunk") {
        if (!this.modelGroup) return;
        const skinPalettes = {
            cyberpunk: { emissive: 0x38bdf8, emissiveIntensity: 0.25, metalness: 0.3, roughness: 0.4 },
            maid: { emissive: 0x1f2937, emissiveIntensity: 0.1, metalness: 0.1, roughness: 0.6 },
            casual: { emissive: 0xf472b6, emissiveIntensity: 0.15, metalness: 0.1, roughness: 0.5 },
            adventurer: { emissive: 0x10b981, emissiveIntensity: 0.2, metalness: 0.2, roughness: 0.45 },
        };

        const config = skinPalettes[skinName.toLowerCase()] || skinPalettes.cyberpunk;

        this.modelGroup.traverse((node) => {
            if (node.isMesh && node.material) {
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                mats.forEach((mat) => {
                    if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                        if (config.emissive !== undefined) mat.emissive.setHex(config.emissive);
                        if (config.emissiveIntensity !== undefined) mat.emissiveIntensity = config.emissiveIntensity;
                        if (config.metalness !== undefined) mat.metalness = config.metalness;
                        if (config.roughness !== undefined) mat.roughness = config.roughness;
                        mat.needsUpdate = true;
                    }
                });
            }
        });

        if (this.particles) {
            this.particles.burst(20);
        }
    }

    /**
     * Pause render loop saat floating widget diminimalkan atau tab 3D tidak aktif.
     * Menghemat 100% konsumsi daya GPU & CPU saat model tidak dilihat.
     */
    pause() {
        this.isPaused = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Resume render loop saat floating widget dibuka kembali.
     */
    resume() {
        if (!this.isPaused && this.animationFrameId) return;
        this.isPaused = false;
        this.clock.start();
        this._animate();
    }

    /**
     * Set level energi audio untuk sinkronisasi pendaran Astral Halo dengan musik.
     * @param {number} energy - 0.0 s/d 1.0
     */
    setAudioEnergy(energy) {
        this.audioEnergy = Math.max(0, Math.min(1, Number(energy) || 0));
    }

    /**
     * Bersihkan resource GPU secara menyeluruh saat widget dihancurkan.
     * Mencegah WebGL context leak dan GPU memory leak.
     */
    destroy() {
        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Lepas event listeners
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        } else {
            window.removeEventListener("resize", this._onResize);
        }
        window.removeEventListener("mousemove", this._onMouseMove);

        // Hentikan animasi
        if (this.animController && this.animController.destroy) {
            this.animController.destroy();
        }

        // Dispose partikel (geometry + material + remove from scene)
        if (this.particles && this.particles.dispose) {
            this.particles.dispose();
        }

        // Traverse scene dan dispose semua geometry + material untuk cegah GPU leak
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    const mats = Array.isArray(object.material)
                        ? object.material
                        : [object.material];
                    mats.forEach((mat) => {
                        // Dispose semua texture dalam material
                        if (mat.map) mat.map.dispose();
                        if (mat.normalMap) mat.normalMap.dispose();
                        if (mat.roughnessMap) mat.roughnessMap.dispose();
                        if (mat.metalnessMap) mat.metalnessMap.dispose();
                        if (mat.emissiveMap) mat.emissiveMap.dispose();
                        if (mat.aoMap) mat.aoMap.dispose();
                        mat.dispose();
                    });
                }
            });
        }

        // Dispose environment texture (PMREMGenerator)
        if (this.envTexture) {
            this.envTexture.dispose();
            this.envTexture = null;
        }

        // Dispose renderer (lepas WebGL context)
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        // Clear referensi
        if (this.vrm) {
            try {
                if (this.vrm.dispose) this.vrm.dispose();
            } catch (_) {}
            this.vrm = null;
        }

        if (this.particles && this.particles.dispose) {
            this.particles.dispose();
            this.particles = null;
        }

        if (this.brand3d && this.brand3d.dispose) {
            this.brand3d.dispose();
            this.brand3d = null;
        }

        this.scene = null;
        this.camera = null;
        this.modelGroup = null;
        this.skinnedMeshes = [];
        this.primarySkinnedMesh = null;
        this.bones = {};
        this.isLoaded = false;
    }
}
