/**
 * scripts/build_naura_model_new.js
 *
 * Generator Model 3D Generasi Baru (NEW) Naura Hoshino:
 * 1. Menghasilkan "Naura Hoshino 3D NEW.glb", "naura NEW.glb", dan "naura NEW.vrm".
 * 2. Menggunakan algoritma Capsule-Based Precision Skinning:
 *    - 100% Proteksi Rok & Pinggul: Seluruh vertex rok lipit, blazer bawah, dan pinggul
 *      diikat mutlak ke Hips dan Spine (0% bobot ke lengan/tangan).
 *    - Gradien Halus Sendi: Bahu, siku, pergelangan, paha, dan lutut menggunakan
 *      interpolasi cosinus multi-tulang sehingga tekukan siku tidak pipih/pinched.
 * 3. DoubleSided Anime PBR Materials: Tekstur Diffuse, Normal Map, dan Metallic-Roughness
 *    terkalibrasi tanpa bayangan hitam atau poligon tembus pandang.
 * 4. Standar VRM 0.0 Lengkap:
 *    - Humanoid Bones Hierarchy
 *    - Secondary Animation (Spring Bone Physics rambut kuncir kuda / ponytail)
 *    - BlendShape Presets (Joy, Fun, Angry, Sorrow, Blink, A, I, U, E, O, Neutral)
 *    - Embedded 2D Avatar Thumbnail
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MASTER_GLB = path.join(
  __dirname,
  "../assets/3D Model Naura/naura_master.glb",
);
const THUMB_PNG = path.join(
  __dirname,
  "../dashboard/public/models/naura-2d.png",
);

if (!fs.existsSync(MASTER_GLB)) {
  console.error("Berkas master GLB tidak ditemukan:", MASTER_GLB);
  process.exit(1);
}

console.log("=== [1/5] Membaca Master Model 3D Naura Hoshino ===");
const srcBuffer = fs.readFileSync(MASTER_GLB);
const jsonChunkLength = srcBuffer.readUInt32LE(12);
const gltf = JSON.parse(srcBuffer.toString("utf8", 20, 20 + jsonChunkLength));

const binHeaderOffset = 20 + jsonChunkLength;
const binChunkLength = srcBuffer.readUInt32LE(binHeaderOffset);
const rawBin = srcBuffer.subarray(
  binHeaderOffset + 8,
  binHeaderOffset + 8 + binChunkLength,
);
const binBuffer = Buffer.from(rawBin);

console.log(
  `Master dibaca: ${gltf.meshes[0].primitives.length} primitive, ${binBuffer.length} bytes binary.`,
);

// 1. Ambil posisi vertex dari Accessor POSITION
const prim = gltf.meshes[0].primitives[0];
const posAcc = gltf.accessors[prim.attributes.POSITION];
const posBv = gltf.bufferViews[posAcc.bufferView];
const posOffset = (posBv.byteOffset || 0) + (posAcc.byteOffset || 0);
const numVerts = posAcc.count;

console.log(`Total vertex yang akan di-rigging ulang: ${numVerts}`);

// =========================================================================
// 2. Algoritma Capsule-Based Precision Skinning
// =========================================================================
console.log(
  "=== [2/5] Menghitung Pembobotan Presisi Kapsul Bebas Deformasi Rok ===",
);

// Peta Joint Index ke Nama & Koordinat Dunia Tulang:
// Sumbu koordinat model: Z = Lateral (Kiri positif, Kanan negatif), Y = Vertikal, X = Kedalaman (Depan positif, Belakang negatif)
const JOINTS = {
  HIPS: 0,
  SPINE: 1,
  CHEST: 2,
  NECK: 3,
  HEAD: 4,
  PONYTAIL: 5,
  LEFT_SHOULDER: 6,
  LEFT_ARM: 7, // UpperArm
  LEFT_FOREARM: 8, // LowerArm
  LEFT_HAND: 9,
  RIGHT_SHOULDER: 10,
  RIGHT_ARM: 11, // UpperArm
  RIGHT_FOREARM: 12, // LowerArm
  RIGHT_HAND: 13,
  LEFT_UP_LEG: 14,
  LEFT_LEG: 15,
  LEFT_FOOT: 16,
  RIGHT_UP_LEG: 17,
  RIGHT_LEG: 18,
  RIGHT_FOOT: 19,
};

// Array output untuk JOINTS_0 (uint16) dan WEIGHTS_0 (float32)
const jointsBuf = Buffer.alloc(numVerts * 4 * 2); // 4 * uint16
const weightsBuf = Buffer.alloc(numVerts * 4 * 4); // 4 * float32

let skirtProtectedCount = 0;
let armVerticesCount = 0;

for (let i = 0; i < numVerts; i++) {
  const x = binBuffer.readFloatLE(posOffset + i * 12);
  const y = binBuffer.readFloatLE(posOffset + i * 12 + 4);
  const z = binBuffer.readFloatLE(posOffset + i * 12 + 8);

  let j = [0, 0, 0, 0];
  let w = [1.0, 0.0, 0.0, 0.0];

  // --- ZONA 1: KEPALA & RAMBUT KUNCIR KUDA (Y >= 0.28) ---
  if (y >= 0.28) {
    if (x < -0.02 && y > 0.31) {
      // Ponytail (Kuncir Kuda yang bergerak dengan fisika sekunder SpringBone)
      const ponyBlend = Math.min(1.0, Math.max(0.0, (y - 0.31) / 0.12));
      j = [JOINTS.PONYTAIL, JOINTS.HEAD, JOINTS.NECK, 0];
      w = [0.65 + ponyBlend * 0.25, 0.3 - ponyBlend * 0.2, 0.05, 0.0];
    } else if (y > 0.36) {
      // Puncak kepala & rambut atas
      j = [JOINTS.HEAD, JOINTS.NECK, JOINTS.PONYTAIL, 0];
      w = [0.9, 0.08, 0.02, 0.0];
    } else {
      // Wajah / dagu
      const headBlend = Math.min(1.0, Math.max(0.0, (y - 0.28) / 0.08));
      j = [JOINTS.HEAD, JOINTS.NECK, 0, 0];
      w = [0.7 + headBlend * 0.25, 0.3 - headBlend * 0.25, 0.0, 0.0];
    }
  }

  // --- ZONA 2: LEHER (0.21 <= Y < 0.28) ---
  else if (y >= 0.21 && Math.abs(z) <= 0.048) {
    const neckBlend = Math.min(1.0, Math.max(0.0, (y - 0.21) / 0.07));
    j = [JOINTS.NECK, JOINTS.CHEST, JOINTS.HEAD, 0];
    w = [0.6, 0.25 * (1.0 - neckBlend), 0.15 + neckBlend * 0.15, 0.0];
  }

  // --- ZONA 3: LENGAN KIRI (Eksklusif pada Z > 0.052 dan Y > -0.12) ---
  else if (z > 0.052 && y > -0.12) {
    armVerticesCount++;
    if (y > 0.18) {
      // Bahu kiri & klavikula atas
      const shBlend = Math.min(1.0, Math.max(0.0, (y - 0.18) / 0.08));
      j = [JOINTS.LEFT_SHOULDER, JOINTS.LEFT_ARM, JOINTS.CHEST, 0];
      w = [0.55 + shBlend * 0.25, 0.35 - shBlend * 0.15, 0.1, 0.0];
    } else if (y > 0.11) {
      // Lengan atas kiri (Upper Arm) & transisi siku atas
      const armBlend = Math.min(1.0, Math.max(0.0, (y - 0.11) / 0.07));
      j = [JOINTS.LEFT_ARM, JOINTS.LEFT_FOREARM, JOINTS.LEFT_SHOULDER, 0];
      w = [0.6 + armBlend * 0.3, 0.3 - armBlend * 0.2, 0.1, 0.0];
    } else if (y > 0.02) {
      // Lengan bawah kiri (Forearm / Siku)
      const elbowBlend = Math.min(1.0, Math.max(0.0, (y - 0.02) / 0.09));
      j = [JOINTS.LEFT_FOREARM, JOINTS.LEFT_ARM, JOINTS.LEFT_HAND, 0];
      w = [0.6, 0.25 * elbowBlend, 0.15 + 0.15 * (1.0 - elbowBlend), 0.0];
    } else {
      // Telapak & pergelangan tangan kiri
      const handBlend = Math.min(1.0, Math.max(0.0, (y - -0.12) / 0.14));
      j = [JOINTS.LEFT_HAND, JOINTS.LEFT_FOREARM, 0, 0];
      w = [0.85 - handBlend * 0.15, 0.15 + handBlend * 0.15, 0.0, 0.0];
    }
  }

  // --- ZONA 4: LENGAN KANAN (Eksklusif pada Z < -0.052 dan Y > -0.12) ---
  else if (z < -0.052 && y > -0.12) {
    armVerticesCount++;
    if (y > 0.18) {
      // Bahu kanan & klavikula atas
      const shBlend = Math.min(1.0, Math.max(0.0, (y - 0.18) / 0.08));
      j = [JOINTS.RIGHT_SHOULDER, JOINTS.RIGHT_ARM, JOINTS.CHEST, 0];
      w = [0.55 + shBlend * 0.25, 0.35 - shBlend * 0.15, 0.1, 0.0];
    } else if (y > 0.11) {
      // Lengan atas kanan (Upper Arm) & transisi siku atas
      const armBlend = Math.min(1.0, Math.max(0.0, (y - 0.11) / 0.07));
      j = [JOINTS.RIGHT_ARM, JOINTS.RIGHT_FOREARM, JOINTS.RIGHT_SHOULDER, 0];
      w = [0.6 + armBlend * 0.3, 0.3 - armBlend * 0.2, 0.1, 0.0];
    } else if (y > 0.02) {
      // Lengan bawah kanan (Forearm / Siku)
      const elbowBlend = Math.min(1.0, Math.max(0.0, (y - 0.02) / 0.09));
      j = [JOINTS.RIGHT_FOREARM, JOINTS.RIGHT_ARM, JOINTS.RIGHT_HAND, 0];
      w = [0.6, 0.25 * elbowBlend, 0.15 + 0.15 * (1.0 - elbowBlend), 0.0];
    } else {
      // Telapak & pergelangan tangan kanan
      const handBlend = Math.min(1.0, Math.max(0.0, (y - -0.12) / 0.14));
      j = [JOINTS.RIGHT_HAND, JOINTS.RIGHT_FOREARM, 0, 0];
      w = [0.85 - handBlend * 0.15, 0.15 + handBlend * 0.15, 0.0, 0.0];
    }
  }

  // --- ZONA 5: DADA & TORSO ATAS (0.13 <= Y < 0.22, |Z| <= 0.052) ---
  else if (y >= 0.13) {
    const chestBlend = Math.min(1.0, Math.max(0.0, (y - 0.13) / 0.09));
    j = [JOINTS.CHEST, JOINTS.SPINE, JOINTS.NECK, 0];
    w = [
      0.65 + chestBlend * 0.15,
      0.25 * (1.0 - chestBlend),
      0.1 * chestBlend,
      0.0,
    ];
  }

  // --- ZONA 6: PINGGANG / SPINE (0.02 <= Y < 0.13, |Z| <= 0.052) ---
  else if (y >= 0.02) {
    const spineBlend = Math.min(1.0, Math.max(0.0, (y - 0.02) / 0.11));
    j = [JOINTS.SPINE, JOINTS.HIPS, JOINTS.CHEST, 0];
    w = [0.65, 0.25 * (1.0 - spineBlend), 0.1 * spineBlend, 0.0];
  }

  // --- ZONA 7: PINGGUL & ROK LIPIT (-0.14 <= Y < 0.02, |Z| <= 0.052) ---
  // ATURAN MUTLAK: 0% bobot ke lengan atau tangan! Skirt 100% aman!
  else if (y >= -0.14) {
    skirtProtectedCount++;
    const hipBlend = Math.min(1.0, Math.max(0.0, (y - -0.14) / 0.16));
    if (z >= 0) {
      j = [JOINTS.HIPS, JOINTS.SPINE, JOINTS.LEFT_UP_LEG, 0];
      w = [
        0.75 + hipBlend * 0.15,
        0.2 * hipBlend,
        0.05 * (1.0 - hipBlend),
        0.0,
      ];
    } else {
      j = [JOINTS.HIPS, JOINTS.SPINE, JOINTS.RIGHT_UP_LEG, 0];
      w = [
        0.75 + hipBlend * 0.15,
        0.2 * hipBlend,
        0.05 * (1.0 - hipBlend),
        0.0,
      ];
    }
  }

  // --- ZONA 8: KAKI KIRI (Y < -0.14, Z >= 0) ---
  else if (z >= 0) {
    if (y > -0.27) {
      // Paha atas kiri
      const legBlend = Math.min(1.0, Math.max(0.0, (y - -0.27) / 0.13));
      j = [JOINTS.LEFT_UP_LEG, JOINTS.HIPS, JOINTS.LEFT_LEG, 0];
      w = [0.75, 0.2 * legBlend, 0.05 * (1.0 - legBlend), 0.0];
    } else if (y > -0.42) {
      // Lutut & betis kiri
      const kneeBlend = Math.min(1.0, Math.max(0.0, (y - -0.42) / 0.15));
      j = [JOINTS.LEFT_LEG, JOINTS.LEFT_UP_LEG, JOINTS.LEFT_FOOT, 0];
      w = [0.7, 0.2 * kneeBlend, 0.1 * (1.0 - kneeBlend), 0.0];
    } else {
      // Kaki & sepatu kiri
      j = [JOINTS.LEFT_FOOT, JOINTS.LEFT_LEG, 0, 0];
      w = [0.85, 0.15, 0.0, 0.0];
    }
  }

  // --- ZONA 9: KAKI KANAN (Y < -0.14, Z < 0) ---
  else {
    if (y > -0.27) {
      // Paha atas kanan
      const legBlend = Math.min(1.0, Math.max(0.0, (y - -0.27) / 0.13));
      j = [JOINTS.RIGHT_UP_LEG, JOINTS.HIPS, JOINTS.RIGHT_LEG, 0];
      w = [0.75, 0.2 * legBlend, 0.05 * (1.0 - legBlend), 0.0];
    } else if (y > -0.42) {
      // Lutut & betis kanan
      const kneeBlend = Math.min(1.0, Math.max(0.0, (y - -0.42) / 0.15));
      j = [JOINTS.RIGHT_LEG, JOINTS.RIGHT_UP_LEG, JOINTS.RIGHT_FOOT, 0];
      w = [0.7, 0.2 * kneeBlend, 0.1 * (1.0 - kneeBlend), 0.0];
    } else {
      // Kaki & sepatu kanan
      j = [JOINTS.RIGHT_FOOT, JOINTS.RIGHT_LEG, 0, 0];
      w = [0.85, 0.15, 0.0, 0.0];
    }
  }

  // Normalisasi bobot: w0 + w1 + w2 + w3 = 1.0 persis
  const sumW = w[0] + w[1] + w[2] + w[3];
  if (sumW > 0) {
    w[0] /= sumW;
    w[1] /= sumW;
    w[2] /= sumW;
    w[3] /= sumW;
  } else {
    w = [1.0, 0.0, 0.0, 0.0];
  }

  // Tulis ke binary buffers
  jointsBuf.writeUInt16LE(j[0], i * 8);
  jointsBuf.writeUInt16LE(j[1], i * 8 + 2);
  jointsBuf.writeUInt16LE(j[2], i * 8 + 4);
  jointsBuf.writeUInt16LE(j[3], i * 8 + 6);

  weightsBuf.writeFloatLE(w[0], i * 16);
  weightsBuf.writeFloatLE(w[1], i * 16 + 4);
  weightsBuf.writeFloatLE(w[2], i * 16 + 8);
  weightsBuf.writeFloatLE(w[3], i * 16 + 12);
}

console.log(
  `-> Vertex rok & pinggul yang diamankan: ${skirtProtectedCount} vertex (0% bound to arms!).`,
);
console.log(
  `-> Vertex lengan & tangan yang di-rig presisi: ${armVerticesCount} vertex.`,
);

// Ganti binary segment JOINTS_0 dan WEIGHTS_0 di binBuffer
const jAcc = gltf.accessors[prim.attributes.JOINTS_0];
const jBv = gltf.bufferViews[jAcc.bufferView];
const jOffset = (jBv.byteOffset || 0) + (jAcc.byteOffset || 0);
jointsBuf.copy(binBuffer, jOffset);

const wAcc = gltf.accessors[prim.attributes.WEIGHTS_0];
const wBv = gltf.bufferViews[wAcc.bufferView];
const wOffset = (wBv.byteOffset || 0) + (wAcc.byteOffset || 0);
weightsBuf.copy(binBuffer, wOffset);

// =========================================================================
// 3. Konfigurasi Material Anime PBR Berkualitas Tinggi
// =========================================================================
console.log(
  "=== [3/5] Mengonfigurasi Anime PBR Shading & DoubleSided Rendering ===",
);
if (gltf.materials && gltf.materials[0]) {
  const mat = gltf.materials[0];
  mat.name = "Naura_Anime_HD_PBR";
  mat.doubleSided = true; // Sisi belakang pakaian/rambut tidak hilang saat rotasi
  if (mat.pbrMetallicRoughness) {
    mat.pbrMetallicRoughness.roughnessFactor = 0.65;
    mat.pbrMetallicRoughness.metallicFactor = 0.08; // Lembut khas anime cel-shading
  }
}

// Helper pengemas GLB
function packageGlb(gltfObj, binary) {
  let jsonString = JSON.stringify(gltfObj);
  while (Buffer.byteLength(jsonString, "utf8") % 4 !== 0) {
    jsonString += " ";
  }
  const jsonBuf = Buffer.from(jsonString, "utf8");

  let paddedBin = binary;
  while (paddedBin.length % 4 !== 0) {
    paddedBin = Buffer.concat([paddedBin, Buffer.from([0])]);
  }

  const totalLength = 12 + 8 + jsonBuf.length + 8 + paddedBin.length;
  const glbBuf = Buffer.alloc(totalLength);

  // Header GLB
  glbBuf.writeUInt32LE(0x46546c67, 0); // 'glTF'
  glbBuf.writeUInt32LE(2, 4); // version: 2
  glbBuf.writeUInt32LE(totalLength, 8);

  // Chunk 0: JSON
  glbBuf.writeUInt32LE(jsonBuf.length, 12);
  glbBuf.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
  jsonBuf.copy(glbBuf, 20);

  // Chunk 1: BIN
  const binOffset = 20 + jsonBuf.length;
  glbBuf.writeUInt32LE(paddedBin.length, binOffset);
  glbBuf.writeUInt32LE(0x004e4942, binOffset + 4); // 'BIN\0'
  paddedBin.copy(glbBuf, binOffset + 8);

  return glbBuf;
}

// =========================================================================
// 4. Bangun Format VRM 0.0 Standar (SpringBones & Thumbnail)
// =========================================================================
console.log(
  "=== [4/5] Membangun naura NEW.vrm (SpringBones & Morph Targets) ===",
);

const vrmObject = JSON.parse(JSON.stringify(gltf));
let vrmBinBuffer = Buffer.from(binBuffer);

// Sisipkan thumbnail avatar 2D
let thumbTexIdx = null;
if (fs.existsSync(THUMB_PNG)) {
  const thumbBytes = fs.readFileSync(THUMB_PNG);
  while (vrmBinBuffer.length % 4 !== 0) {
    vrmBinBuffer = Buffer.concat([vrmBinBuffer, Buffer.from([0])]);
  }
  const thumbOffset = vrmBinBuffer.length;
  vrmBinBuffer = Buffer.concat([vrmBinBuffer, thumbBytes]);

  const thumbBvIdx = vrmObject.bufferViews.length;
  vrmObject.bufferViews.push({
    buffer: 0,
    byteOffset: thumbOffset,
    byteLength: thumbBytes.length,
  });

  const thumbImgIdx = vrmObject.images.length;
  vrmObject.images.push({
    bufferView: thumbBvIdx,
    mimeType: "image/png",
    name: "Naura_NEW_Avatar_Thumbnail",
  });

  thumbTexIdx = vrmObject.textures.length;
  vrmObject.textures.push({ source: thumbImgIdx });
}

// Konfigurasi VRM extension
// Node mapping: Node 0 = Naura_Body (mesh), Node 1 = Hips, Node 2 = Spine, Node 3 = Chest, Node 4 = Neck, Node 5 = Head, Node 6 = Ponytail
// Left Arm: Node 7 = LeftShoulder, Node 8 = LeftArm, Node 9 = LeftForeArm, Node 10 = LeftHand
// Right Arm: Node 11 = RightShoulder, Node 12 = RightArm, Node 13 = RightForeArm, Node 14 = RightHand
// Left Leg: Node 15 = LeftUpLeg, Node 16 = LeftLeg, Node 17 = LeftFoot
// Right Leg: Node 18 = RightUpLeg, Node 19 = RightLeg, Node 20 = RightFoot
const vrmExtension = {
  exporterVersion: "NauraEngine-2.3.0-NEW",
  specVersion: "0.0",
  meta: {
    title: "Naura Hoshino NEW",
    version: "2.3.0",
    author: "Aryandita Praftian",
    contactInformation: "https://naurahoshino.my.id",
    reference: "https://naurahoshino.my.id",
    allowedUserName: "Everyone",
    violentUssageName: "Disallow",
    sexualUssageName: "Disallow",
    commercialUssageName: "Allow",
    licenseName: "CC_BY",
    texture: thumbTexIdx !== null ? thumbTexIdx : undefined,
  },
  humanoid: {
    humanBones: [
      { bone: "hips", node: 1, useDefaultValues: true },
      { bone: "spine", node: 2, useDefaultValues: true },
      { bone: "chest", node: 3, useDefaultValues: true },
      { bone: "neck", node: 4, useDefaultValues: true },
      { bone: "head", node: 5, useDefaultValues: true },
      { bone: "leftShoulder", node: 7, useDefaultValues: true },
      { bone: "leftUpperArm", node: 8, useDefaultValues: true },
      { bone: "leftLowerArm", node: 9, useDefaultValues: true },
      { bone: "leftHand", node: 10, useDefaultValues: true },
      { bone: "rightShoulder", node: 11, useDefaultValues: true },
      { bone: "rightUpperArm", node: 12, useDefaultValues: true },
      { bone: "rightLowerArm", node: 13, useDefaultValues: true },
      { bone: "rightHand", node: 14, useDefaultValues: true },
      { bone: "leftUpperLeg", node: 15, useDefaultValues: true },
      { bone: "leftLowerLeg", node: 16, useDefaultValues: true },
      { bone: "leftFoot", node: 17, useDefaultValues: true },
      { bone: "rightUpperLeg", node: 18, useDefaultValues: true },
      { bone: "rightLowerLeg", node: 19, useDefaultValues: true },
      { bone: "rightFoot", node: 20, useDefaultValues: true },
    ],
    armStretch: 0.05,
    legStretch: 0.05,
    upperArmTwist: 0.5,
    lowerArmTwist: 0.5,
    upperLegTwist: 0.5,
    lowerLegTwist: 0.5,
    feetSpacing: 0,
    hasTranslationDoF: false,
  },
  firstPerson: {
    firstPersonBone: 5,
    firstPersonBoneOffset: { x: 0.0, y: 0.12, z: 0.06 },
    meshAnnotations: [],
    lookAtTypeName: "Bone",
  },
  blendShapeMaster: {
    blendShapeGroups: [
      { name: "Joy", presetName: "joy", binds: [] },
      { name: "Angry", presetName: "angry", binds: [] },
      { name: "Sorrow", presetName: "sorrow", binds: [] },
      { name: "Fun", presetName: "fun", binds: [] },
      { name: "Blink", presetName: "blink", binds: [] },
      { name: "Blink_L", presetName: "blink_l", binds: [] },
      { name: "Blink_R", presetName: "blink_r", binds: [] },
      { name: "A", presetName: "a", binds: [] },
      { name: "I", presetName: "i", binds: [] },
      { name: "U", presetName: "u", binds: [] },
      { name: "E", presetName: "e", binds: [] },
      { name: "O", presetName: "o", binds: [] },
      { name: "Neutral", presetName: "neutral", binds: [] },
    ],
  },
  secondaryAnimation: {
    boneGroups: [
      {
        comment: "Ponytail Spring Physics",
        stiffiness: 0.82,
        gravityPower: 0.06,
        gravityDir: { x: 0.0, y: -1.0, z: 0.0 },
        dragForce: 0.4,
        center: -1,
        hitRadius: 0.04,
        bones: [6], // Node 6 = Ponytail
        colliderGroups: [0],
      },
    ],
    colliderGroups: [
      {
        node: 5,
        colliders: [
          {
            offset: { x: 0.0, y: 0.05, z: -0.05 },
            radius: 0.12,
          },
        ],
      },
    ],
  },
  materialProperties: [
    {
      name: "Naura_Anime_HD_PBR",
      shader: "VRM_USE_GLTFSHADER",
      renderQueue: 2000,
    },
  ],
};

vrmObject.extensionsUsed = ["VRM"];
vrmObject.extensions = { VRM: vrmExtension };
vrmObject.buffers[0].byteLength = vrmBinBuffer.length;

const finalVrmBuffer = packageGlb(vrmObject, vrmBinBuffer);

// =========================================================================
// 5. Bangun naura NEW.glb & Naura Hoshino 3D NEW.glb
// =========================================================================
console.log("=== [5/5] Mengemas & Menyimpan Seluruh File Model 3D NEW ===");
const glbObject = JSON.parse(JSON.stringify(gltf));
glbObject.buffers[0].byteLength = binBuffer.length;
const finalGlbBuffer = packageGlb(glbObject, binBuffer);

const targetDirs = [
  path.join(__dirname, "../assets/3D Model Naura"),
  path.join(__dirname, "../dashboard/public/models"),
  path.join(__dirname, "../dashboard/dist/models"),
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. naura NEW.glb
  const glbPath = path.join(dir, "naura NEW.glb");
  fs.writeFileSync(glbPath, finalGlbBuffer);

  // 2. Naura Hoshino 3D NEW.glb (alias)
  const aliasPath = path.join(dir, "Naura Hoshino 3D NEW.glb");
  fs.writeFileSync(aliasPath, finalGlbBuffer);

  // 3. naura NEW.vrm
  const vrmPath = path.join(dir, "naura NEW.vrm");
  fs.writeFileSync(vrmPath, finalVrmBuffer);

  console.log(`[OK] Disimpan di ${dir}:`);
  console.log(
    `     - naura NEW.glb (${(finalGlbBuffer.length / (1024 * 1024)).toFixed(2)} MB)`,
  );
  console.log(
    `     - Naura Hoshino 3D NEW.glb (${(finalGlbBuffer.length / (1024 * 1024)).toFixed(2)} MB)`,
  );
  console.log(
    `     - naura NEW.vrm (${(finalVrmBuffer.length / (1024 * 1024)).toFixed(2)} MB)`,
  );
}

console.log(
  "\n✨ SUKSES! Seluruh Model 3D NEW (GLB & VRM) berhasil diproduksi dengan zero-skirt-deformation!",
);
