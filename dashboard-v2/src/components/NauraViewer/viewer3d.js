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

export class Naura3DViewer {
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.options = {
            modelPath: options.modelPath || "/models/naura.vrm",
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
        this.modelGroup = null;
        this.vrm = null;
        this.pmremGenerator = null;
        this.envTexture = null;
        // Simpan semua SkinnedMesh (model bisa punya banyak: tubuh, rambut, baju)
        this.skinnedMeshes = [];
        // Referensi ke skinnedMesh primer untuk morph target (yang punya morphTargetDictionary)
        this.primarySkinnedMesh = null;
        this.bones = {};
        this.isLoaded = false;
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
        this.renderer.toneMappingExposure = 1.6;
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
        // Karakter anime butuh ambient lebih kuat agar warna tekstur muncul natural
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
        this.scene.add(ambientLight);

        // 2. Main Key Light (Hangat alami, dari depan atas kanan)
        const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.4);
        keyLight.position.set(1.2, 1.8, 1.5);
        this.scene.add(keyLight);

        // 3. Cyber-Anime Rim Light (Neon Pink / Cherry Blossom - dari belakang kiri)
        const rimLightPink = new THREE.DirectionalLight(0xff77a9, 2.2);
        rimLightPink.position.set(-1.5, 1.0, -1.0);
        this.scene.add(rimLightPink);

        // 4. Cyber Accent Light (Cyan Neon - dari bawah depan kiri)
        const fillLightCyan = new THREE.PointLight(0x38bdf8, 1.5, 5);
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

        // Interaksi klik: variasi animasi interaktif ramah (Wave, BlowKiss, Cheers, Thinking, Shy)
        const clickReactions = ["Wave", "BlowKiss", "Cheers", "Thinking", "Shy"];
        let reactionIdx = 0;
        this.canvas.addEventListener("click", () => {
            const chosen = clickReactions[reactionIdx % clickReactions.length];
            reactionIdx++;
            this.playAnimation(chosen);
            if (this.particles) {
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
            if (node.isSkinnedMesh) {
                this.skinnedMeshes.push(node);

                // Pilih mesh primer: yang pertama punya morphTargetDictionary (untuk ekspresi wajah)
                if (!this.primarySkinnedMesh && node.morphTargetDictionary) {
                    this.primarySkinnedMesh = node;
                }

                // Petakan tulang dari skeleton (hanya perlu sekali, semua mesh berbagi skeleton sama)
                if (node.skeleton && node.skeleton.bones && Object.keys(this.bones).length === 0) {
                    node.skeleton.bones.forEach((b) => {
                        this.bones[b.name] = b;
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
                        // Non-metallic anime toon style look
                        mat.metalness = 0;
                        mat.roughness = 0.75;
                        if ("envMapIntensity" in mat) {
                            mat.envMapIntensity = 1.2;
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

        // Partikel ambient cyber-sparkle di sekitar Naura
        try {
            this.particles = createParticleSystem(this.scene);
        } catch (_) {
            // Partikel gagal, tidak kritis
        }

        this.isLoaded = true;
    }

    _onMouseMove(event) {
        if (!this.options.lookAtCursor) return;

        // Normalisasi posisi mouse relatif terhadap tengah layar [-1, 1]
        this.mouse.targetX = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.targetY = -(event.clientY / window.innerHeight) * 2 + 1;
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

        // 3. Interactive Kinematic Chain Cursor Tracking (Chest 15%, Neck 35%, Head 50%)
        // Gunakan perkalian quaternion aditif agar tidak berkonflik/jitter dengan AnimationMixer
        if (this.bones.Head && this.options.lookAtCursor) {
            const lookYaw = -this.mouse.x * 0.35;    // menoleh kiri/kanan
            const lookPitch = this.mouse.y * 0.18;   // menengadah/menunduk
            const headTilt = -this.mouse.x * 0.08;   // kemiringan kepala alami (Z-roll)

            const headEuler = new THREE.Euler(headTilt * 0.6, lookYaw * 0.50, lookPitch * 0.50, "YXZ");
            const headOffset = new THREE.Quaternion().setFromEuler(headEuler);
            this.bones.Head.quaternion.multiply(headOffset);

            if (this.bones.Neck) {
                const neckEuler = new THREE.Euler(headTilt * 0.25, lookYaw * 0.35, lookPitch * 0.35, "YXZ");
                const neckOffset = new THREE.Quaternion().setFromEuler(neckEuler);
                this.bones.Neck.quaternion.multiply(neckOffset);
            }

            if (this.bones.Chest) {
                const chestEuler = new THREE.Euler(0, lookYaw * 0.15, lookPitch * 0.15, "YXZ");
                const chestOffset = new THREE.Quaternion().setFromEuler(chestEuler);
                this.bones.Chest.quaternion.multiply(chestOffset);
            }

            // Fisika sekunder (Spring-Damper) untuk kuncir rambut (Ponytail)
            if (this.bones.Ponytail) {
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
                const ponyOffset = new THREE.Quaternion().setFromEuler(ponyEuler);
                this.bones.Ponytail.quaternion.multiply(ponyOffset);
            }
        }

        // 4. Autonomous Blinking Engine (Micro-Expressions)
        this._updateBlinking(delta);

        // 5. Smooth Morph Target Interpolation
        this._updateMorphs(delta, elapsed);

        // 6. Update Partikel
        if (this.particles) {
            this.particles.update(delta, elapsed);
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

        this.scene = null;
        this.camera = null;
        this.modelGroup = null;
        this.skinnedMeshes = [];
        this.primarySkinnedMesh = null;
        this.bones = {};
        this.particles = null;
        this.isLoaded = false;
    }
}
