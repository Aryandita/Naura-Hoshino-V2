/**
 * scripts/build_naura_model.js
 *
 * Mengoptimalkan model 3D Naura Hoshino:
 * 1. Meresample seluruh 8 animasi (Idle, Wave, Thinking, Dizzy, Cheers, Shy, Sleepy, BlowKiss)
 *    secara padat pada 30 FPS dengan interpolasi kurva halus (Hermite S-curve / SLERP).
 * 2. Menyematkan metadata resmi standar VRM 0.0 (Humanoid Bones, BlendShapeMaster, Secondary SpringBones).
 * 3. Menghasilkan berkas:
 *    - naura.glb  (Format GLTF Binary modern dengan animasi padat ultra-smooth)
 *    - naura.vrm  (Format VRM standar untuk Three-VRM, VSeeFace, Warudo, 3Tene, Blender, dll.)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_GLB = path.join(__dirname, "../dashboard-v2/public/models/naura.glb");

if (!fs.existsSync(SOURCE_GLB)) {
  console.error("Berkas sumber tidak ditemukan:", SOURCE_GLB);
  process.exit(1);
}

console.log("=== [1/5] Membaca Berkas GLB Sumber ===");
const srcBuffer = fs.readFileSync(SOURCE_GLB);
const jsonChunkLength = srcBuffer.readUInt32LE(12);
const gltf = JSON.parse(srcBuffer.toString("utf8", 20, 20 + jsonChunkLength));

const binHeaderOffset = 20 + jsonChunkLength;
const binChunkLength = srcBuffer.readUInt32LE(binHeaderOffset);
const rawBin = srcBuffer.slice(binHeaderOffset + 8, binHeaderOffset + 8 + binChunkLength);
let binBuffer = Buffer.from(rawBin);

console.log(`Model berhasil dibaca: ${gltf.nodes.length} nodes, ${gltf.animations.length} animasi.`);

// Helper untuk membaca accessor lama
function readAccessor(accIdx) {
  const acc = gltf.accessors[accIdx];
  const bv = gltf.bufferViews[acc.bufferView];
  const offset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const count = acc.count;
  const numPerElem = acc.type === "SCALAR" ? 1 : acc.type === "VEC3" ? 3 : acc.type === "VEC4" ? 4 : 6;
  const arr = [];
  for (let i = 0; i < count; i++) {
    const elem = [];
    for (let j = 0; j < numPerElem; j++) {
      elem.push(binBuffer.readFloatLE(offset + (i * numPerElem + j) * 4));
    }
    arr.push(numPerElem === 1 ? elem[0] : elem);
  }
  return arr;
}

// SLERP untuk quaternion
function slerp(q1, q2, t) {
  let [x1, y1, z1, w1] = q1;
  let [x2, y2, z2, w2] = q2;
  let dot = x1 * x2 + y1 * y2 + z1 * z2 + w1 * w2;
  if (dot < 0) {
    dot = -dot;
    x2 = -x2; y2 = -y2; z2 = -z2; w2 = -w2;
  }
  if (dot > 0.9995) {
    const rx = x1 + t * (x2 - x1);
    const ry = y1 + t * (y2 - y1);
    const rz = z1 + t * (z2 - z1);
    const rw = w1 + t * (w2 - w1);
    const len = Math.hypot(rx, ry, rz, rw) || 1;
    return [rx / len, ry / len, rz / len, rw / len];
  }
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinTheta = Math.sin(theta);
  const s1 = Math.sin((1 - t) * theta) / sinTheta;
  const s2 = Math.sin(t * theta) / sinTheta;
  return [
    x1 * s1 + x2 * s2,
    y1 * s1 + y2 * s2,
    z1 * s1 + z2 * s2,
    w1 * s1 + w2 * s2
  ];
}

// LERP untuk array float / scalars
function lerpArr(a1, a2, t) {
  if (typeof a1 === "number") return a1 + t * (a2 - a1);
  return a1.map((v, i) => v + t * (a2[i] - v));
}

// Smoothstep cubic easing untuk S-curve acceleration
function smoothstep(u) {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
}

// Fungsi append data ke binBuffer dan return bufferView + accessor
function appendBinary(dataArr, type, componentType = 5126) {
  // Pad 4 bytes
  while (binBuffer.length % 4 !== 0) {
    binBuffer = Buffer.concat([binBuffer, Buffer.from([0])]);
  }
  const byteOffset = binBuffer.length;
  const numPerElem = type === "SCALAR" ? 1 : type === "VEC3" ? 3 : type === "VEC4" ? 4 : dataArr[0].length;
  const elemCount = dataArr.length;
  const byteLength = elemCount * numPerElem * 4;

  const tempBuf = Buffer.alloc(byteLength);
  let writeOffset = 0;
  let min = null;
  let max = null;

  for (let i = 0; i < elemCount; i++) {
    const val = dataArr[i];
    if (type === "SCALAR") {
      tempBuf.writeFloatLE(val, writeOffset);
      writeOffset += 4;
      if (min === null || val < min[0]) min = [val];
      if (max === null || val > max[0]) max = [val];
    } else {
      for (let j = 0; j < numPerElem; j++) {
        const v = val[j];
        tempBuf.writeFloatLE(v, writeOffset);
        writeOffset += 4;
        if (!min) {
          min = new Array(numPerElem).fill(Infinity);
          max = new Array(numPerElem).fill(-Infinity);
        }
        if (v < min[j]) min[j] = v;
        if (v > max[j]) max[j] = v;
      }
    }
  }

  binBuffer = Buffer.concat([binBuffer, tempBuf]);

  const bvIdx = gltf.bufferViews.length;
  gltf.bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength
  });

  const accIdx = gltf.accessors.length;
  const accessor = {
    bufferView: bvIdx,
    byteOffset: 0,
    componentType,
    count: elemCount,
    type
  };
  if (min) accessor.min = min.map(n => Math.fround(n));
  if (max) accessor.max = max.map(n => Math.fround(n));
  gltf.accessors.push(accessor);

  return accIdx;
}

// =========================================================================
// 2. Resample Seluruh Animasi secara Padat (30 FPS)
// =========================================================================
console.log("=== [2/5] Meresample Animasi ke 30 FPS dengan Hermite S-Curves ===");

const newAnimations = [];
const FPS = 30;
const DT = 1 / FPS;

for (const anim of gltf.animations) {
  console.log(`-> Meresample animasi: ${anim.name}`);
  const newSamplers = [];
  const newChannels = [];

  for (let cIdx = 0; cIdx < anim.channels.length; cIdx++) {
    const ch = anim.channels[cIdx];
    const oldSampler = anim.samplers[ch.sampler];
    const oldTimes = readAccessor(oldSampler.input);
    const oldVals = readAccessor(oldSampler.output);
    const duration = oldTimes[oldTimes.length - 1];
    const isRotation = ch.target.path === "rotation";
    const elemType = isRotation ? "VEC4" : Array.isArray(oldVals[0]) ? (oldVals[0].length === 3 ? "VEC3" : "SCALAR") : "SCALAR";

    // Buat timeline sampling padat
    const resampledTimes = [];
    const resampledVals = [];
    const frameCount = Math.ceil(duration * FPS) + 1;

    for (let f = 0; f < frameCount; f++) {
      const t = Math.min(f * DT, duration);
      resampledTimes.push(t);

      // Cari segmen
      let segIdx = 0;
      while (segIdx < oldTimes.length - 2 && oldTimes[segIdx + 1] < t) {
        segIdx++;
      }

      const t0 = oldTimes[segIdx];
      const t1 = oldTimes[segIdx + 1] || duration;
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      const easedU = smoothstep(u);

      const v0 = oldVals[segIdx];
      const v1 = oldVals[segIdx + 1] || oldVals[segIdx];

      if (isRotation) {
        resampledVals.push(slerp(v0, v1, easedU));
      } else {
        resampledVals.push(lerpArr(v0, v1, easedU));
      }
    }

    // Buat input time accessor baru
    const timeAccIdx = appendBinary(resampledTimes, "SCALAR");
    // Buat output value accessor baru
    const valAccIdx = appendBinary(resampledVals, elemType);

    const samplerIdx = newSamplers.length;
    newSamplers.push({
      input: timeAccIdx,
      interpolation: "LINEAR", // Data sudah dipre-compute padat tiap 0.033s (30 FPS S-Curve)
      output: valAccIdx
    });

    // Perbaiki target channel jika undefined target node (node 0 adalah mesh yang memiliki blendshapes)
    const targetNode = ch.target.node !== undefined ? ch.target.node : 0;

    newChannels.push({
      sampler: samplerIdx,
      target: {
        node: targetNode,
        path: ch.target.path
      }
    });
  }

  newAnimations.push({
    name: anim.name,
    samplers: newSamplers,
    channels: newChannels
  });
}

gltf.animations = newAnimations;

// =========================================================================
// 3. Bangun Ekstensi Resmi Standar VRM 0.0
// =========================================================================
console.log("=== [3/5] Mengintegrasikan Ekstensi Resmi Standar VRM 0.0 ===");

const vrmExtension = {
  exporterVersion: "NauraEngine-2.1.0",
  specVersion: "0.0",
  meta: {
    title: "Naura Hoshino",
    version: "2.1.0",
    author: "Aryandita Praftian",
    contactInformation: "https://naurahoshino.my.id",
    reference: "https://naurahoshino.my.id",
    allowedUserName: "Everyone",
    violentUssageName: "Disallow",
    sexualUssageName: "Disallow",
    commercialUssageName: "Allow",
    otherPermissionUrl: "",
    licenseName: "CC_BY",
    otherLicenseUrl: ""
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
      { bone: "rightFoot", node: 20, useDefaultValues: true }
    ],
    armStretch: 0.05,
    legStretch: 0.05,
    upperArmTwist: 0.5,
    lowerArmTwist: 0.5,
    upperLegTwist: 0.5,
    lowerLegTwist: 0.5,
    feetSpacing: 0,
    hasTranslationDoF: false
  },
  firstPerson: {
    firstPersonBone: 5,
    firstPersonBoneOffset: { x: 0.0, y: 0.08, z: 0.04 },
    meshAnnotations: [],
    lookAtTypeName: "Bone",
    lookAtHorizontalInner: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
    lookAtHorizontalOuter: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
    lookAtVerticalDown: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
    lookAtVerticalUp: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 }
  },
  blendShapeMaster: {
    blendShapeGroups: [
      { name: "Joy", presetName: "joy", binds: [{ mesh: 0, index: 0, weight: 100 }] },
      { name: "Angry", presetName: "angry", binds: [{ mesh: 0, index: 3, weight: 100 }] },
      { name: "Sorrow", presetName: "sorrow", binds: [{ mesh: 0, index: 2, weight: 100 }] },
      { name: "Fun", presetName: "fun", binds: [{ mesh: 0, index: 1, weight: 100 }] },
      { name: "Blink", presetName: "blink", binds: [{ mesh: 0, index: 4, weight: 100 }] },
      { name: "A", presetName: "a", binds: [{ mesh: 0, index: 5, weight: 100 }] },
      { name: "Neutral", presetName: "neutral", binds: [] }
    ]
  },
  secondaryAnimation: {
    boneGroups: [
      {
        comment: "Ponytail Hair Spring Physics",
        stiffiness: 0.85,
        gravityPower: 0.08,
        gravityDir: { x: 0.0, y: -1.0, z: 0.0 },
        dragForce: 0.45,
        center: -1,
        hitRadius: 0.04,
        bones: [6]
      }
    ],
    colliderGroups: []
  }
};

// =========================================================================
// 4. Pengemasan File GLB & VRM
// =========================================================================
console.log("=== [4/5] Mengemas Berkas GLB & VRM ===");

// Update buffer byte length di gltf
gltf.buffers[0].byteLength = binBuffer.length;

function packageGlb(gltfObj, binary) {
  let jsonString = JSON.stringify(gltfObj);
  // Pad JSON string agar kelipatan 4 bytes dengan spasi
  while (Buffer.byteLength(jsonString, "utf8") % 4 !== 0) {
    jsonString += " ";
  }
  const jsonBuf = Buffer.from(jsonString, "utf8");

  // Pad binary buffer agar kelipatan 4 bytes
  let paddedBin = binary;
  while (paddedBin.length % 4 !== 0) {
    paddedBin = Buffer.concat([paddedBin, Buffer.from([0])]);
  }

  const totalLength = 12 + 8 + jsonBuf.length + 8 + paddedBin.length;
  const glbBuf = Buffer.alloc(totalLength);

  // Header GLB (12 bytes)
  glbBuf.writeUInt32LE(0x46546c67, 0); // magic: 'glTF'
  glbBuf.writeUInt32LE(2, 4);          // version: 2
  glbBuf.writeUInt32LE(totalLength, 8); // total length

  // Chunk 0: JSON (8 bytes header + json)
  glbBuf.writeUInt32LE(jsonBuf.length, 12);
  glbBuf.writeUInt32LE(0x4e4f534a, 16); // type: 'JSON'
  jsonBuf.copy(glbBuf, 20);

  // Chunk 1: BIN (8 bytes header + bin)
  const binOffset = 20 + jsonBuf.length;
  glbBuf.writeUInt32LE(paddedBin.length, binOffset);
  glbBuf.writeUInt32LE(0x004e4942, binOffset + 4); // type: 'BIN\0'
  paddedBin.copy(glbBuf, binOffset + 8);

  return glbBuf;
}

// 1. Buat versi GLB murni (dengan dense 30fps animation)
const glbObject = JSON.parse(JSON.stringify(gltf));
const finalGlbBuffer = packageGlb(glbObject, binBuffer);

// 2. Buat versi VRM resmi (dengan ekstensi VRM 0.0)
const vrmObject = JSON.parse(JSON.stringify(gltf));
vrmObject.extensionsUsed = vrmObject.extensionsUsed || [];
if (!vrmObject.extensionsUsed.includes("VRM")) {
  vrmObject.extensionsUsed.push("VRM");
}
vrmObject.extensions = vrmObject.extensions || {};
vrmObject.extensions.VRM = vrmExtension;
const finalVrmBuffer = packageGlb(vrmObject, binBuffer);

// =========================================================================
// 5. Simpan ke Semua Direktori Target
// =========================================================================
console.log("=== [5/5] Menyimpan Berkas ke Direktori Target ===");

const targetDirs = [
  path.join(__dirname, "../dashboard-v2/public/models"),
  path.join(__dirname, "../dashboard-v2/dist/models"),
  path.join(__dirname, "../assets/3D Model Naura")
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Simpan naura.glb
  const glbPath = path.join(dir, "naura.glb");
  fs.writeFileSync(glbPath, finalGlbBuffer);
  console.log(`[OK] Disimpan: ${glbPath} (${(finalGlbBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

  // Simpan alias Naura Hoshino 3D.glb
  const aliasPath = path.join(dir, "Naura Hoshino 3D.glb");
  fs.writeFileSync(aliasPath, finalGlbBuffer);

  // Simpan naura.vrm
  const vrmPath = path.join(dir, "naura.vrm");
  fs.writeFileSync(vrmPath, finalVrmBuffer);
  console.log(`[OK] Disimpan: ${vrmPath} (${(finalVrmBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
}

console.log("\n✨ SELESAI! Model 3D Naura Hoshino berhasil diperbarui ke 30 FPS smooth dan format VRM resmi!");
