/**
 * core/rigProfile.js - Jembatan antara controller (gaya VRM) dan model Naura_Hoshino_3D_NEW.glb.
 *
 * Model ini BUKAN VRM, sehingga ada tiga hal yang harus diterjemahkan:
 *   1. Nama bone      : controller memakai nama VRM (rightUpperArm), GLB memakai RightArm.
 *   2. Ekspresi wajah : tidak ada vrm.expressionManager; yang ada hanya morph target
 *                       Happy / Thinking / Sad / Angry / Blink / Talk pada SkinnedMesh.
 *   3. Sumbu rotasi   : Rig menghadap +X dengan lengan menggantung ke -Y, sehingga
 *                         X = roll (miring samping), Y = yaw/twist, Z = pitch (maju-mundur).
 *                       Nod ke bawah = Z negatif. Lengan terangkat ke depan = Z positif.
 *
 * Semua nilai rotasi di sequences/*.js sudah memakai sumbu rig (Euler urutan YXZ seperti
 * core/interpolation.js, radian).
 */

import * as THREE from "three";

/* ========================================================================== */
/* 1. PETA BONE                                                               */
/* ========================================================================== */

/** Kunci yang dipakai controller  ->  nama bone di GLB. */
export const VRM_TO_GLB_BONE = {
  hips: "Hips",
  spine: "Spine",
  chest: "Chest",
  neck: "Neck",
  head: "Head",

  leftShoulder: "LeftShoulder",
  leftUpperArm: "LeftArm",
  leftLowerArm: "LeftForeArm",
  leftHand: "LeftHand",

  rightShoulder: "RightShoulder",
  rightUpperArm: "RightArm",
  rightLowerArm: "RightForeArm",
  rightHand: "RightHand",

  // Kaki: disediakan dua gaya nama (VRM & Mixamo) karena legs.js dan leftLeg.js/rightLeg.js berbeda.
  leftUpperLeg: "LeftUpLeg",
  leftUpLeg: "LeftUpLeg",
  leftLowerLeg: "LeftLeg",
  leftLeg: "LeftLeg",
  leftFoot: "LeftFoot",

  rightUpperLeg: "RightUpLeg",
  rightUpLeg: "RightUpLeg",
  rightLowerLeg: "RightLeg",
  rightLeg: "RightLeg",
  rightFoot: "RightFoot",
};

/** Bone opsional: model ini tidak punya upperChest, jadi tidak perlu diperingatkan. */
const OPTIONAL_BONES = new Set(["upperChest"]);

const normalizeName = (name) =>
  String(name)
    .toLowerCase()
    .replace(/^mixamorig[:_]?/, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Membangun peta humanoidBones untuk semua controller.
 * @param {THREE.Object3D} root - gltf.scene
 * @returns {Record<string, THREE.Object3D|null>}
 */
export function buildHumanoidBones(root) {
  const byName = new Map();
  root.traverse((obj) => {
    if (obj.name) byName.set(normalizeName(obj.name), obj);
  });

  const bones = { upperChest: null };
  const missing = [];

  for (const [vrmKey, glbName] of Object.entries(VRM_TO_GLB_BONE)) {
    const node = byName.get(normalizeName(glbName)) || null;
    bones[vrmKey] = node;
    if (!node && !OPTIONAL_BONES.has(vrmKey))
      missing.push(`${vrmKey} (${glbName})`);
  }

  if (missing.length) {
    console.warn(
      "[NauraAnimation:RigProfile] Bone tidak ditemukan:",
      missing.join(", "),
    );
  }
  return bones;
}

/* ========================================================================== */
/* 2. EKSPRESI WAJAH (morph target GLB)                                       */
/* ========================================================================== */

/** Urutan morph target di GLB (dipakai jika morphTargetDictionary tidak terbaca). */
const FALLBACK_TARGET_NAMES = [
  "Happy",
  "Thinking",
  "Sad",
  "Angry",
  "Blink",
  "Talk",
];

/**
 * nama ekspresi (huruf kecil)  ->  [[morph target GLB, pengali], ...]
 * Mencakup nama baru (happy, talk...), nama VRM 1.0 (relaxed, aa...) dan nama lama
 * di sequence sebelumnya (joy, fun, a, u, blink_r...). Nama tak dikenal (lookLeft, dst.) diabaikan.
 */
const EXPRESSION_MAP = {
  happy: [["Happy", 1.0]],
  joy: [["Happy", 1.0]],
  relaxed: [["Happy", 0.6]],
  fun: [["Happy", 0.6]],
  sad: [["Sad", 1.0]],
  sorrow: [["Sad", 1.0]],
  angry: [["Angry", 1.0]],
  thinking: [["Thinking", 1.0]],
  surprised: [["Talk", 0.5]],

  blink: [["Blink", 1.0]],
  blink_l: [["Blink", 1.0]],
  blink_r: [["Blink", 1.0]],
  blinkleft: [["Blink", 1.0]],
  blinkright: [["Blink", 1.0]],

  talk: [["Talk", 1.0]],
  aa: [["Talk", 1.0]],
  a: [["Talk", 1.0]],
  ih: [["Talk", 0.45]],
  i: [["Talk", 0.45]],
  ou: [["Talk", 0.35]],
  u: [["Talk", 0.35]],
  ee: [["Talk", 0.55]],
  e: [["Talk", 0.55]],
  oh: [["Talk", 0.75]],
  o: [["Talk", 0.75]],
};

/**
 * Penyedia ekspresi untuk model GLB biasa (non-VRM).
 *
 * Setiap controller (face / blink / eyes) mendapat "channel" sendiri. Pengaruh akhir sebuah
 * morph target = nilai TERBESAR dari semua channel, sehingga kedipan otomatis (blink.js)
 * tidak menimpa mata setengah tertutup dari animasi Sleepy, dan sebaliknya.
 *
 * Penggunaan:
 *   const expr = new GlbExpressionRig(gltf.scene);
 *   face.init(expr.channel("face"));
 *   blink.init(expr.channel("blink"));
 *   eyes.init(expr.channel("eyes"), gltf.scene);
 */
export class GlbExpressionRig {
  /** @param {THREE.Object3D} root - gltf.scene */
  constructor(root) {
    this.meshes = [];
    this.entries = new Map(); // "channel|nama" -> { target, value }

    root.traverse((obj) => {
      if (
        !obj.isMesh ||
        !obj.morphTargetInfluences ||
        !obj.morphTargetInfluences.length
      )
        return;
      let dict = obj.morphTargetDictionary;
      if (!dict || !Object.keys(dict).length) {
        dict = {};
        FALLBACK_TARGET_NAMES.forEach((n, i) => {
          dict[n] = i;
        });
      }
      this.meshes.push({ mesh: obj, dict });
    });

    if (!this.meshes.length) {
      console.warn(
        "[NauraAnimation:RigProfile] Tidak ada mesh dengan morph target ditemukan.",
      );
    }
  }

  /** Objek yang berperilaku seperti VRM 1.0 untuk face.js / blink.js / eyes.js. */
  channel(channelId) {
    return {
      lookAt: null,
      blendShapeProxy: null,
      expressionManager: {
        setValue: (name, value) => this._setValue(channelId, name, value),
      },
    };
  }

  _setValue(channelId, name, value) {
    const mapping = EXPRESSION_MAP[String(name).toLowerCase()];
    if (!mapping) return; // mis. lookLeft: tidak ada morph-nya
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    const touched = new Set();

    for (const [target, factor] of mapping) {
      this.entries.set(`${channelId}|${name}|${target}`, {
        target,
        value: v * factor,
      });
      touched.add(target);
    }
    for (const target of touched) this._apply(target);
  }

  _apply(target) {
    let influence = 0;
    for (const entry of this.entries.values()) {
      if (entry.target === target && entry.value > influence)
        influence = entry.value;
    }
    for (const { mesh, dict } of this.meshes) {
      const index = dict[target];
      if (index !== undefined) mesh.morphTargetInfluences[index] = influence;
    }
  }

  /** Kembalikan semua ekspresi ke netral. */
  reset() {
    this.entries.clear();
    for (const { mesh } of this.meshes) mesh.morphTargetInfluences.fill(0);
  }
}

/* ========================================================================== */
/* 3. SUMBU & BATAS SUDUT                                                     */
/* ========================================================================== */

/**
 * Konversi vektor rotasi gaya VRM [pitch, yaw, roll] ke sumbu rig GLB [roll, yaw, pitch].
 * Dipakai controller untuk gerak tambahan (tracking kursor, napas, sway).
 *   VRM x (pitch, +nod ke bawah)  ->  rig Z dengan tanda dibalik
 *   VRM y (yaw)                   ->  rig Y
 *   VRM z (roll)                  ->  rig X
 */
export const vrmToRig = (v) => [v[2], v[1], -v[0]];

/**
 * Batas sudut aman per sendi dalam sumbu rig: { x: [min, max], y: [...], z: [...] }.
 * Lengan sengaja sangat lebar (+/-7 rad): dalam Euler YXZ, rotasi mendekati 180 derajat (lengan lurus ke atas,
 * putaran telapak saat lengan turun) bisa bernilai hingga ~2*pi pada satu sumbu, padahal rotasinya tetap wajar.
 */
export const RIG_LIMITS = {
  head: { x: [-0.4, 0.4], y: [-0.78, 0.78], z: [-0.78, 0.78] },
  neck: { x: [-0.35, 0.35], y: [-0.61, 0.61], z: [-0.61, 0.61] },
  upperArm: { x: [-3.5, 3.5], y: [-3.5, 3.5], z: [-3.5, 3.5] },
  lowerArm: { x: [-1.5, 1.5], y: [-2.8, 2.8], z: [-0.3, 2.8] },
};

/** Clamp vektor [x, y, z] (in-place) sesuai batas { x, y, z }. */
export function clampToLimits(vec, limits) {
  vec[0] = THREE.MathUtils.clamp(vec[0], limits.x[0], limits.x[1]);
  vec[1] = THREE.MathUtils.clamp(vec[1], limits.y[0], limits.y[1]);
  vec[2] = THREE.MathUtils.clamp(vec[2], limits.z[0], limits.z[1]);
  return vec;
}

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

/**
 * Seberapa tinggi sebuah lengan terangkat (radian, 0 = menggantung), tidak bergantung
 * pada sumbu Euler yang dipakai. Menggantikan pembacaan rotasi X pada kopling torso.
 */
export function armElevation(rot = [0, 0, 0]) {
  _euler.set(rot[0], rot[1], rot[2]);
  _quat.setFromEuler(_euler);
  return 2 * Math.acos(Math.min(1, Math.abs(_quat.w)));
}
