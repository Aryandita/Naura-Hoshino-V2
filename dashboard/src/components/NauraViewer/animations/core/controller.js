/**
 * core/controller.js - Orkestrator Sistem Animasi Modular Naura Hoshino.
 *
 * Mengoordinasikan seluruh sub-modul tubuh yang bergerak secara independen.
 *
 * Arsitektur Granular (1 file per anggota tubuh):
 * - parts.hips        (HipsController)        - pinggul / pelvis contrapposto
 * - parts.spine       (SpineController)        - lumbal tulang belakang
 * - parts.chest       (ChestController)        - dada tengah & napas
 * - parts.upperChest  (UpperChestController)   - dada atas & klavikula
 * - parts.leftArm     (LeftArmController)      - bahu+lengan kiri eksklusif
 * - parts.rightArm    (RightArmController)     - bahu+lengan kanan eksklusif
 * - parts.leftHand    (LeftHandController)     - pergelangan kiri
 * - parts.rightHand   (RightHandController)    - pergelangan kanan + wave oscillation
 * - parts.leftLeg     (LeftLegController)      - paha+lutut+kaki kiri (stance)
 * - parts.rightLeg    (RightLegController)     - paha+lutut+kaki kanan (free leg)
 * - parts.neck        (NeckController)         - leher servikal
 * - parts.head        (HeadController)         - tengkorak kepala + cursor tracking
 * - parts.eyes        (EyeController)          - bola mata & saccadic
 * - parts.blink       (BlinkController)        - kedipan kelopak acak
 * - parts.face        (FaceController)         - ekspresi morph target
 * - parts.hair        (HairController)         - fisika rambut & spring bones
 *
 * Legacy (backward-compat untuk sequences lama):
 * - parts.arms        (ArmController)          - gabungan lengan kiri+kanan
 * - parts.hands       (HandController)         - gabungan tangan kiri+kanan
 * - parts.legs        (LegController)          - gabungan kaki kiri+kanan
 *
 * Setiap bagian berjalan dalam sandbox try-catch terisolasi.
 */

import * as THREE from "three";
import { evaluateTrack } from "./interpolation.js";
import { ACTION_DURATIONS, HUMANOID_BONE_KEYS } from "./constants.js";
import { ANIMATION_DEFINITIONS } from "../sequences/index.js";
import { buildHumanoidBones, GlbExpressionRig } from "./rigProfile.js";

// Sub-modul granular (1 per anggota tubuh)
import { HipsController } from "../parts/hips.js";
import { SpineController } from "../parts/spine.js";
import { ChestController } from "../parts/chest.js";
import { UpperChestController } from "../parts/upperChest.js";
import { LeftArmController } from "../parts/leftArm.js";
import { RightArmController } from "../parts/rightArm.js";
import { LeftHandController } from "../parts/leftHand.js";
import { RightHandController } from "../parts/rightHand.js";
import { LeftLegController } from "../parts/leftLeg.js";
import { RightLegController } from "../parts/rightLeg.js";
import { NeckController } from "../parts/neck.js";
import { HeadController } from "../parts/head.js";
import { EyeController } from "../parts/eyes.js";
import { BlinkController } from "../parts/blink.js";
import { FaceController } from "../parts/face.js";
import { HairController } from "../parts/hair.js";
// Sub-modul legacy (backward-compat untuk sequences yang masih memakai arms/hands/legs)
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

    // Inisialisasi controller granular per-anggota-tubuh
    this.parts = {
      // Torso rantai bawah -> atas
      hips: new HipsController(options),
      spine: new SpineController(options),
      chest: new ChestController(options),
      upperChest: new UpperChestController(options),
      // Lengan (kiri & kanan independen)
      leftArm: new LeftArmController(options),
      rightArm: new RightArmController(options),
      // Tangan (kiri & kanan independen)
      leftHand: new LeftHandController(options),
      rightHand: new RightHandController(options),
      // Kaki (kiri & kanan independen)
      leftLeg: new LeftLegController(options),
      rightLeg: new RightLegController(options),
      // Kepala & leher
      neck: new NeckController(options),
      head: new HeadController(options),
      // Wajah & pendukung
      eyes: new EyeController(options),
      blink: new BlinkController(options),
      face: new FaceController(options),
      hair: new HairController(options),
      // Legacy (backward-compat untuk sequences lama)
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
          if (!node && typeof this.vrm.humanoid.getRawBoneNode === "function") {
            node = this.vrm.humanoid.getRawBoneNode(key);
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
      // Mapping untuk model GLB menggunakan rigProfile adapter
      const glbBones = buildHumanoidBones(this.modelScene);
      this.humanoidBones = { ...glbBones };
    }
  }

  _initParts() {
    // Gunakan GlbExpressionRig untuk VRM & GLB karena blendShapeGroups pada model kosong
    if (this.modelScene) {
      const expr = new GlbExpressionRig(this.modelScene);
      this.parts.face.init(expr.channel("face"));
      this.parts.blink.init(expr.channel("blink"));
      this.parts.eyes.init(expr.channel("eyes"), this.modelScene);
      this.parts.hair.init(this.vrm, this.modelScene); // tetap kirim vrm agar spring bone terdeteksi
    } else if (this.vrm) {
      this.parts.eyes.init(this.vrm, this.modelScene);
      this.parts.blink.init(this.vrm);
      this.parts.hair.init(this.vrm, this.modelScene);
      this.parts.face.init(this.vrm);
    }

    // Torso granular
    this.parts.hips.init(this.humanoidBones);
    this.parts.spine.init(this.humanoidBones);
    this.parts.chest.init(this.humanoidBones);
    this.parts.upperChest.init(this.humanoidBones);

    // Lengan granular
    this.parts.leftArm.init(this.humanoidBones);
    this.parts.rightArm.init(this.humanoidBones);
    this.parts.leftHand.init(this.humanoidBones);
    this.parts.rightHand.init(this.humanoidBones);

    // Kaki granular
    this.parts.leftLeg.init(this.humanoidBones);
    this.parts.rightLeg.init(this.humanoidBones);

    // Kepala & leher granular
    this.parts.neck.init(this.humanoidBones);
    this.parts.head.init(this.humanoidBones);

    // Legacy (backward-compat untuk sequences yang masih memakai arms/hands/legs)
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
   * @param {string} partName - Nama modul: 'hips'|'spine'|'chest'|'upperChest'|
   *   'leftArm'|'rightArm'|'leftHand'|'rightHand'|'leftLeg'|'rightLeg'|
   *   'neck'|'head'|'eyes'|'blink'|'face'|'hair'|
   *   'arms'(legacy)|'hands'(legacy)|'legs'(legacy)
   */
  getPart(partName) {
    return this.parts[partName] || null;
  }

  /**
   * Update loop utama per frame.
   */
  update(delta, elapsed, extContext = {}) {
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
        this.animTime = 0;
        this.isWaving = false;
      }
    }

    // 4. Evaluasi keyframe sequence terkini
    const def =
      ANIMATION_DEFINITIONS[this.activeAnim] || ANIMATION_DEFINITIONS.Idle;
    const dur = def.duration || 3.0;
    const tNorm = this.isActionLooping
      ? (this.animTime % dur) / dur
      : Math.min(1.0, this.animTime / dur);

    const isLoop = this.isActionLooping ?? def.isLoop ?? false;

    // Evaluasi root transformasi
    const root = {
      posX: 0,
      posY: evaluateTrack(def.root?.posY, tNorm, "scalar", isLoop),
      posZ: evaluateTrack(def.root?.posZ, tNorm, "scalar", isLoop),
      rotX: evaluateTrack(def.root?.rotX, tNorm, "scalar", isLoop),
      rotY: evaluateTrack(def.root?.rotY, tNorm, "scalar", isLoop),
      rotZ: evaluateTrack(def.root?.rotZ, tNorm, "scalar", isLoop),
      scale: evaluateTrack(def.root?.scale, tNorm, "scalar", isLoop) || 1.0,
    };

    // Evaluasi seluruh target sendi keyframe
    const targetBones = {};
    if (def.bones) {
      for (const [boneName, track] of Object.entries(def.bones)) {
        targetBones[boneName] = evaluateTrack(track, tNorm, "euler", isLoop);
      }
    }

    // Evaluasi morph target wajah
    const targetMorphs = {};
    if (def.morphs) {
      for (const [morphName, track] of Object.entries(def.morphs)) {
        targetMorphs[morphName] = evaluateTrack(track, tNorm, "scalar", isLoop);
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
    this.currentBlend.scale +=
      (root.scale - this.currentBlend.scale) * lerpFactor;

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
      lookYaw: extContext.lookYaw ?? this.lookYaw ?? 0,
      lookPitch: extContext.lookPitch ?? this.lookPitch ?? 0,
      headTilt: extContext.headTilt ?? this.headTilt ?? 0,
      ...extContext,
    };

    // 6. Update setiap bagian tubuh secara independen & aman
    // -- Torso rantai bawah -> atas --
    this.parts.hips.update(delta, elapsed, context);
    this.parts.spine.update(delta, elapsed, context);
    this.parts.chest.update(delta, elapsed, context);
    this.parts.upperChest.update(delta, elapsed, context);

    // -- Lengan granular kiri & kanan --
    this.parts.leftArm.update(delta, elapsed, context);
    this.parts.rightArm.update(delta, elapsed, context);
    this.parts.leftHand.update(delta, elapsed, context);
    this.parts.rightHand.update(delta, elapsed, context);

    // -- Kaki granular kiri & kanan --
    this.parts.leftLeg.update(delta, elapsed, context);
    this.parts.rightLeg.update(delta, elapsed, context);

    // -- Kepala & leher --
    this.parts.neck.update(delta, elapsed, context);
    this.parts.head.update(delta, elapsed, context);

    // -- Rambut, mata, kedipan, wajah --
    this.parts.hair.update(delta, elapsed, context);
    this.parts.eyes.update(delta, elapsed, context);
    this.parts.blink.update(delta, elapsed, context);

    this.parts.face.setMorphTargets(targetMorphs);
    this.parts.face.update(delta, elapsed, context);

    // Legacy controllers (arms, hands, legs) tetap tersimpan di this.parts untuk backward-compat getPart(),
    // namun tidak di-update ganda per-frame karena sendi-sendinya telah ditangani secara presisi
    // dan eksklusif oleh Left/Right granular controllers di atas.
  }

  /**
   * Mainkan aksi prosedural atau klip animasi.
   */
  playClip(name, options = {}) {
    const { loop, onFinish = null } = options;

    const matchedKey =
      Object.keys(ANIMATION_DEFINITIONS).find(
        (k) => k.toLowerCase() === (name || "").toLowerCase(),
      ) || "Idle";

    const def = ANIMATION_DEFINITIONS[matchedKey] || ANIMATION_DEFINITIONS.Idle;
    this.activeAnim = matchedKey;
    this.animTime = 0;
    this.isActionLooping =
      loop !== undefined ? Boolean(loop) : (def.isLoop ?? false);
    this.actionTimer = 0;
    this.actionDuration = this.isActionLooping
      ? 0
      : ACTION_DURATIONS[matchedKey] || def.duration || 2.4;
    this.onActionFinish = onFinish || null;

    if (matchedKey.toLowerCase() === "wave") {
      this.isWaving = true;
    } else {
      this.isWaving = false;
    }

    return {
      name: matchedKey,
      isProcedural: true,
      stop: () => {
        this.activeAnim = "Idle";
        this.isActionLooping = true;
        this.animTime = 0;
        this.actionTimer = 0;
        this.isWaving = false;
      },
    };
  }

  setLookTarget(yaw = 0, pitch = 0, tilt = 0) {
    this.lookYaw = yaw;
    this.lookPitch = pitch;
    this.headTilt = tilt;
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
export function createAnimationController(
  modelScene,
  clips = [],
  vrm = null,
  options = {},
) {
  const controller = new AnimationController(modelScene, clips, vrm, options);

  return {
    update: (delta, elapsed, extCtx) =>
      controller.update(delta, elapsed, extCtx),
    setLookTarget: (y, p, t) => controller.setLookTarget(y, p, t),
    triggerWave: () => controller.triggerWave(),
    playClip: (name, opts) => controller.playClip(name, opts),
    setMood: (mood) => controller.setMood(mood),
    syncVisemes: (phoneme, intensity = 1.0) =>
      controller.syncVisemes(phoneme, intensity),
    destroy: () => controller.destroy(),
    getMixer: () => controller.getMixer(),
    getActiveAnim: () => controller.getActiveAnim(),
    getHumanoidBones: () => controller.getHumanoidBones(),
    getPart: (name) => controller.getPart(name),
    controller,
  };
}
