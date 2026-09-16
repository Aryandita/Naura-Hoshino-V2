/**
 * core/controller.js - Orkestrator Sistem Animasi Modular Naura Hoshino.
 *
 * Mengoordinasikan seluruh sub-modul tubuh yang bergerak secara independen:
 * - parts.eyes    (EyeController)
 * - parts.blink   (BlinkController)
 * - parts.hair    (HairController)
 * - parts.head    (HeadController)
 * - parts.face    (FaceController)
 * - parts.spine   (SpineController)
 * - parts.arms    (ArmController)
 * - parts.hands   (HandController)
 * - parts.legs    (LegController)
 *
 * Setiap bagian berjalan dalam sandbox try-catch terisolasi. Jika satu modul mengalami
 * galat, modul lainnya tetap berjalan mulus tanpa merusak render loop 3D.
 */

import * as THREE from "three";
import { evaluateTrack } from "./interpolation.js";
import {
    ACTION_DURATIONS,
    HUMANOID_BONE_KEYS,
    GLB_BONE_PATTERNS,
} from "./constants.js";
import { ANIMATION_DEFINITIONS } from "../sequences/index.js";

// Sub-modul per bagian tubuh
import { EyeController } from "../parts/eyes.js";
import { BlinkController } from "../parts/blink.js";
import { HairController } from "../parts/hair.js";
import { HeadController } from "../parts/head.js";
import { FaceController } from "../parts/face.js";
import { SpineController } from "../parts/spine.js";
import { ArmController } from "../parts/arms.js";
import { HandController } from "../parts/hands.js";
import { LegController } from "../parts/legs.js";

export class AnimationController {
    constructor(modelScene, clips = [], vrm = null, options = {}) {
        this.modelScene = modelScene;
        this.clips = clips || [];
        this.vrm = vrm;
        this.options = options;

        this.mixer = new THREE.AnimationMixer(modelScene);
        this.humanoidBones = {};

        // Inisialisasi controller per-bagian tubuh
        this.parts = {
            eyes: new EyeController(options),
            blink: new BlinkController(options),
            hair: new HairController(options),
            head: new HeadController(options),
            face: new FaceController(options),
            spine: new SpineController(options),
            arms: new ArmController(options),
            hands: new HandController(options),
            legs: new LegController(options),
        };

        // State mesin animasi
        this.activeAnim = "Idle";
        this.animTime = 0;
        this.isActionLooping = true;
        this.actionTimer = 0;
        this.actionDuration = 0;
        this.onActionFinish = null;
        this.currentMood = "idle";
        this.isWaving = false;
        this.currentAction = null;

        // Base referensi posisi awal model
        this.base = {
            posX: modelScene ? modelScene.position.x : 0,
            posY: modelScene ? modelScene.position.y : 0,
            posZ: modelScene ? modelScene.position.z : 0,
            rotX: modelScene ? modelScene.rotation.x : 0,
            rotY: modelScene ? modelScene.rotation.y : 0,
            rotZ: modelScene ? modelScene.rotation.z : 0,
            scaleX: modelScene ? modelScene.scale.x : 1,
            scaleY: modelScene ? modelScene.scale.y : 1,
            scaleZ: modelScene ? modelScene.scale.z : 1,
        };

        this.currentBlend = {
            posX: 0,
            posY: 0,
            posZ: 0,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
            scale: 1,
        };

        this._initBones();
        this._initParts();
        this._initDefaultClips();
    }

    _initBones() {
        if (this.vrm && this.vrm.humanoid) {
            HUMANOID_BONE_KEYS.forEach((key) => {
                try {
                    let node = null;
                    if (typeof this.vrm.humanoid.getNormalizedBoneNode === "function") {
                        node = this.vrm.humanoid.getNormalizedBoneNode(key);
                    }
                    if (!node && typeof this.vrm.humanoid.getBoneNode === "function") {
                        node = this.vrm.humanoid.getBoneNode(key);
                    }
                    if (node) {
                        this.humanoidBones[key] = node;
                    }
                } catch (_) {}
            });
        } else if (this.modelScene) {
            // Mapping untuk model GLB fallback
            this.modelScene.traverse((node) => {
                if (node.isBone) {
                    for (const [key, pattern] of Object.entries(GLB_BONE_PATTERNS)) {
                        if (!this.humanoidBones[key] && pattern.test(node.name)) {
                            this.humanoidBones[key] = node;
                        }
                    }
                }
            });
        }
    }

    _initParts() {
        this.parts.eyes.init(this.vrm, this.modelScene);
        this.parts.blink.init(this.vrm);
        this.parts.hair.init(this.vrm, this.modelScene);
        this.parts.head.init(this.humanoidBones);
        this.parts.face.init(this.vrm);
        this.parts.spine.init(this.humanoidBones);
        this.parts.arms.init(this.humanoidBones);
        this.parts.hands.init(this.humanoidBones);
        this.parts.legs.init(this.humanoidBones);
    }

    _initDefaultClips() {
        const idleClip = this.clips.find((c) => /idle|stand|breath/i.test(c.name));
        if (idleClip && !this.vrm) {
            this.currentAction = this.mixer.clipAction(idleClip);
            this.currentAction.play();
        }
    }

    /**
     * Dapatkan sub-modul tubuh untuk debugging mandiri.
     * @param {string} partName - 'eyes' | 'blink' | 'hair' | 'head' | 'face' | 'spine' | 'arms' | 'hands' | 'legs'
     */
    getPart(partName) {
        return this.parts[partName] || null;
    }

    /**
     * Update loop utama per frame.
     */
    update(delta, elapsed) {
        this.animTime += delta;

        // 1. Update Mixer animasi skeletal bawaan
        this.mixer.update(delta);

        // 2. Update fisika bawaan VRM
        if (this.vrm) {
            try {
                this.vrm.update(delta);
            } catch (err) {
                console.warn("[NauraAnimation:VRM] vrm.update error:", err.message);
            }
        }

        // 3. Timer untuk aksi berdurasi non-looping
        if (!this.isActionLooping && this.actionDuration > 0) {
            this.actionTimer += delta;
            if (this.actionTimer >= this.actionDuration) {
                if (typeof this.onActionFinish === "function") {
                    this.onActionFinish();
                    this.onActionFinish = null;
                }
                this.activeAnim = "Idle";
                this.isActionLooping = true;
                this.actionTimer = 0;
                this.isWaving = false;
            }
        }

        // 4. Evaluasi keyframe sequence terkini
        const def = ANIMATION_DEFINITIONS[this.activeAnim] || ANIMATION_DEFINITIONS.Idle;
        const dur = def.duration || 3.0;
        const tNorm = (this.animTime % dur) / dur;

        // Evaluasi root transformasi
        const root = {
            posX: 0,
            posY: evaluateTrack(def.root?.posY, tNorm, "scalar"),
            posZ: evaluateTrack(def.root?.posZ, tNorm, "scalar"),
            rotX: evaluateTrack(def.root?.rotX, tNorm, "scalar"),
            rotY: evaluateTrack(def.root?.rotY, tNorm, "scalar"),
            rotZ: evaluateTrack(def.root?.rotZ, tNorm, "scalar"),
            scale: evaluateTrack(def.root?.scale, tNorm, "scalar") || 1.0,
        };

        // Evaluasi seluruh target sendi keyframe
        const targetBones = {};
        if (def.bones) {
            for (const [boneName, track] of Object.entries(def.bones)) {
                targetBones[boneName] = evaluateTrack(track, tNorm, "euler");
            }
        }

        // Evaluasi morph target wajah
        const targetMorphs = {};
        if (def.morphs) {
            for (const [morphName, track] of Object.entries(def.morphs)) {
                targetMorphs[morphName] = evaluateTrack(track, tNorm, "scalar");
            }
        }

        // 5. Terapkan transformasi root model
        const lerpFactor = 1.0 - Math.exp(-12.0 * delta);
        this.currentBlend.posX += (root.posX - this.currentBlend.posX) * lerpFactor;
        this.currentBlend.posY += (root.posY - this.currentBlend.posY) * lerpFactor;
        this.currentBlend.posZ += (root.posZ - this.currentBlend.posZ) * lerpFactor;
        this.currentBlend.rotX += (root.rotX - this.currentBlend.rotX) * lerpFactor;
        this.currentBlend.rotY += (root.rotY - this.currentBlend.rotY) * lerpFactor;
        this.currentBlend.rotZ += (root.rotZ - this.currentBlend.rotZ) * lerpFactor;
        this.currentBlend.scale += (root.scale - this.currentBlend.scale) * lerpFactor;

        if (this.modelScene) {
            this.modelScene.position.x = this.base.posX + this.currentBlend.posX;
            this.modelScene.position.y = this.base.posY + this.currentBlend.posY;
            this.modelScene.position.z = this.base.posZ + this.currentBlend.posZ;
            this.modelScene.rotation.x = this.base.rotX + this.currentBlend.rotX;
            this.modelScene.rotation.z = this.base.rotZ + this.currentBlend.rotZ;
            this.modelScene.rotation.y = this.base.rotY + this.currentBlend.rotY;
            this.modelScene.scale.x = this.base.scaleX * this.currentBlend.scale;
            this.modelScene.scale.y = this.base.scaleY * this.currentBlend.scale;
            this.modelScene.scale.z = this.base.scaleZ * this.currentBlend.scale;
        }

        // Konteks frame untuk disalurkan ke sub-modul tubuh
        const context = {
            targetBones,
            harmonics: def.harmonics || null,
            duration: dur,
            tNorm,
            isIdle: this.activeAnim === "Idle",
            enableTracking: this.options.lookAtCursor ?? true,
        };

        // 6. Update setiap bagian tubuh secara independen & aman
        this.parts.spine.update(delta, elapsed, context);
        this.parts.legs.update(delta, elapsed, context);
        this.parts.arms.update(delta, elapsed, context);
        this.parts.hands.update(delta, elapsed, context);
        this.parts.head.update(delta, elapsed, context);
        this.parts.hair.update(delta, elapsed, context);
        this.parts.eyes.update(delta, elapsed, context);
        this.parts.blink.update(delta, elapsed, context);

        this.parts.face.setMorphTargets(targetMorphs);
        this.parts.face.update(delta, elapsed, context);
    }

    /**
     * Mainkan aksi prosedural atau klip animasi.
     */
    playClip(name, options = {}) {
        const { loop = true, onFinish = null } = options;

        const matchedKey = Object.keys(ANIMATION_DEFINITIONS).find(
            (k) => k.toLowerCase() === (name || "").toLowerCase()
        ) || "Idle";

        const def = ANIMATION_DEFINITIONS[matchedKey];
        this.activeAnim = matchedKey;
        this.animTime = 0;
        this.isActionLooping = loop ?? def.isLoop;
        this.actionTimer = 0;
        this.actionDuration = this.isActionLooping
            ? 0
            : (ACTION_DURATIONS[matchedKey] || def.duration || 2.4);
        this.onActionFinish = onFinish || null;

        if (name.toLowerCase() === "wave") {
            this.isWaving = true;
        }

        return {
            name,
            isProcedural: true,
            stop: () => {
                this.activeAnim = "Idle";
                this.isActionLooping = true;
            },
        };
    }

    triggerWave() {
        if (this.isWaving) return;
        this.isWaving = true;

        this.playClip("Wave", {
            loop: false,
            fadeDuration: 0.35,
            onFinish: () => {
                this.isWaving = false;
            },
        });
    }

    setMood(mood) {
        this.currentMood = mood;
        const norm = (mood || "").toLowerCase();

        const animMap = {
            wave: "Wave",
            welcome: "Wave",
            happy: "Wave",
            thinking: "Thinking",
            processing: "Thinking",
            loading: "Thinking",
            confused: "Dizzy",
            dizzy: "Dizzy",
            pusing: "Dizzy",
            cheers: "Cheers",
            celebrate: "Cheers",
            levelup: "Cheers",
            shy: "Shy",
            malu: "Shy",
            sleepy: "Sleepy",
            afk: "Sleepy",
            cooldown: "Sleepy",
            ngantuk: "Sleepy",
            blowkiss: "BlowKiss",
            love: "BlowKiss",
            romance: "BlowKiss",
            kiss: "BlowKiss",
            astral: "AstralCast",
            astralcast: "AstralCast",
            magic: "AstralCast",
            hoshino: "AstralCast",
            starpose: "StarPose",
            idol: "StarPose",
            pose: "StarPose",
            idle: "Idle",
        };

        const targetAnim = animMap[norm] || "Idle";
        const isLooping =
            targetAnim === "Idle" ||
            targetAnim === "Dizzy" ||
            targetAnim === "Sleepy" ||
            targetAnim === "Thinking" ||
            targetAnim === "Shy";

        this.playClip(targetAnim, { loop: isLooping, fadeDuration: 0.4 });
    }

    syncVisemes(phoneme, intensity = 1.0) {
        this.parts.face.syncViseme(phoneme, intensity);
    }

    destroy() {
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot(this.modelScene);
        for (const part of Object.values(this.parts)) {
            if (typeof part.destroy === "function") part.destroy();
        }
        this.clips = [];
    }

    getMixer() {
        return this.mixer;
    }

    getActiveAnim() {
        return this.activeAnim;
    }

    getHumanoidBones() {
        return this.humanoidBones;
    }
}

/**
 * Factory function yang kompatibel 100% dengan kode lama.
 */
export function createAnimationController(modelScene, clips = [], vrm = null, options = {}) {
    const controller = new AnimationController(modelScene, clips, vrm, options);

    return {
        update: (delta, elapsed) => controller.update(delta, elapsed),
        triggerWave: () => controller.triggerWave(),
        playClip: (name, opts) => controller.playClip(name, opts),
        setMood: (mood) => controller.setMood(mood),
        syncVisemes: (phoneme, intensity = 1.0) => controller.syncVisemes(phoneme, intensity),
        destroy: () => controller.destroy(),
        getMixer: () => controller.getMixer(),
        getActiveAnim: () => controller.getActiveAnim(),
        getHumanoidBones: () => controller.getHumanoidBones(),
        getPart: (name) => controller.getPart(name),
        controller,
    };
}
