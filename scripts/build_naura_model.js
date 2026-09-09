/**
 * scripts/build_naura_model.js
 *
 * Membangun model 3D Naura Hoshino berkualitas tinggi untuk Web Dashboard & VTuber Ecosystem:
 * 1. naura.glb - Model GLB PBR HD 2K murni dengan orientasi native menghadap kamera,
 *    DoubleSided Material PBR (diffuse, normal map, packed metallic-roughness), tanpa cacat skinning.
 * 2. naura.vrm - Standar resmi VRM 0.0 dengan:
 *    - Metadata lengkap & lisensi
 *    - Embedded 2D Avatar Thumbnail Texture (meta.texture)
 *    - Humanoid Bones Hierarchy
 *    - Secondary Animation (Spring Bone Physics untuk Ponytail & Hair)
 *    - Comprehensive BlendShape Presets (Joy, Angry, Sorrow, Fun, Blink, Vowels A/I/U/E/O, Neutral)
 *    - FirstPerson Camera Head Offset
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_GLB = path.join(
  __dirname,
  "../assets/3D Model Naura/extracted/test_pbr.glb",
);
const THUMB_PNG = path.join(
  __dirname,
  "../dashboard/public/models/naura-2d.png",
);

if (!fs.existsSync(SOURCE_GLB)) {
  console.error("Berkas sumber tidak ditemukan:", SOURCE_GLB);
  process.exit(1);
}

console.log("=== [1/4] Membaca Master Geometry PBR ===");
const srcBuffer = fs.readFileSync(SOURCE_GLB);
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
  `Master model dibaca: ${gltf.meshes[0].primitives.length} primitive, ${binBuffer.length} bytes binary.`,
);

// 1. Konfigurasi material PBR optimal
if (gltf.materials && gltf.materials[0]) {
  const mat = gltf.materials[0];
  mat.name = "Naura_Anime_PBR";
  mat.doubleSided = true;
  if (mat.pbrMetallicRoughness) {
    mat.pbrMetallicRoughness.roughnessFactor = 0.65;
    mat.pbrMetallicRoughness.metallicFactor = 0.1;
  }
}

// 2. Set orientasi native Node 0: Rotasi -90° pada sumbu Y (Euler 0, -pi/2, 0)
// Quaternion: [0, -sqrt(2)/2, 0, sqrt(2)/2]
gltf.nodes[0].name = "Naura_Body";
gltf.nodes[0].rotation = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];

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
  glbBuf.writeUInt32LE(0x46546c67, 0); // magic: 'glTF'
  glbBuf.writeUInt32LE(2, 4); // version: 2
  glbBuf.writeUInt32LE(totalLength, 8); // total length

  // Chunk 0: JSON
  glbBuf.writeUInt32LE(jsonBuf.length, 12);
  glbBuf.writeUInt32LE(0x4e4f534a, 16); // type: 'JSON'
  jsonBuf.copy(glbBuf, 20);

  // Chunk 1: BIN
  const binOffset = 20 + jsonBuf.length;
  glbBuf.writeUInt32LE(paddedBin.length, binOffset);
  glbBuf.writeUInt32LE(0x004e4942, binOffset + 4); // type: 'BIN\0'
  paddedBin.copy(glbBuf, binOffset + 8);

  return glbBuf;
}

console.log("=== [2/4] Mengemas naura.glb (PBR High-Fidelity) ===");
const glbObject = JSON.parse(JSON.stringify(gltf));
const finalGlbBuffer = packageGlb(glbObject, binBuffer);

console.log(
  "=== [3/4] Mengemas naura.vrm (VRM 0.0 Standard dengan Thumbnail & SpringBones) ===",
);
const vrmObject = JSON.parse(JSON.stringify(gltf));
let vrmBinBuffer = Buffer.from(binBuffer);

// 3a. Sisipkan thumbnail avatar 2D ke dalam binary chunk VRM jika file ada
let thumbTexIdx = null;
if (fs.existsSync(THUMB_PNG)) {
  const thumbBytes = fs.readFileSync(THUMB_PNG);
  // Pad 4 bytes
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
    name: "Naura_Avatar_Thumbnail",
  });

  thumbTexIdx = vrmObject.textures.length;
  vrmObject.textures.push({
    source: thumbImgIdx,
  });
  console.log(`Thumbnail avatar disematkan pada Texture ID: ${thumbTexIdx}`);
}

// 3b. Node-node Humanoid standar VRM 0.0
// Node 0: Naura_Body (mesh 0)
// Node 1: Hips (root)
// Node 2: Spine
// Node 3: Chest
// Node 4: Neck
// Node 5: Head
// Node 6..19: Limbs & Ponytail
const humanoidNodes = [
  { name: "Hips", translation: [0, 0, 0], children: [2, 14, 17] },
  { name: "Spine", translation: [0, 0.12, 0], children: [3] },
  { name: "Chest", translation: [0, 0.08, 0], children: [4, 6, 10] },
  { name: "Neck", translation: [0, 0.06, 0], children: [5] },
  { name: "Head", translation: [0, 0.09, 0], children: [20] }, // child 20 = Ponytail
  { name: "LeftShoulder", translation: [0.05, 0.02, 0], children: [7] },
  { name: "LeftUpperArm", translation: [0.04, -0.04, 0], children: [8] },
  { name: "LeftLowerArm", translation: [0.02, -0.06, 0], children: [9] },
  { name: "LeftHand", translation: [0.01, -0.06, 0] },
  { name: "RightShoulder", translation: [-0.05, 0.02, 0], children: [11] },
  { name: "RightUpperArm", translation: [-0.04, -0.04, 0], children: [12] },
  { name: "RightLowerArm", translation: [-0.02, -0.06, 0], children: [13] },
  { name: "RightHand", translation: [-0.01, -0.06, 0] },
  { name: "LeftUpperLeg", translation: [0.04, -0.05, 0], children: [15] },
  { name: "LeftLowerLeg", translation: [0, -0.2, 0], children: [16] },
  { name: "LeftFoot", translation: [0, -0.2, 0] },
  { name: "RightUpperLeg", translation: [-0.04, -0.05, 0], children: [18] },
  { name: "RightLowerLeg", translation: [0, -0.2, 0], children: [19] },
  { name: "RightFoot", translation: [0, -0.2, 0] },
  { name: "Ponytail", translation: [0, 0.08, -0.08] }, // Node 20
];

humanoidNodes.forEach((n) => {
  vrmObject.nodes.push(n);
});

// Scene nodes mencakup Node 0 (Mesh) dan Node 1 (Hips)
vrmObject.scenes[0].nodes = [0, 1];

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
      { bone: "leftShoulder", node: 6, useDefaultValues: true },
      { bone: "leftUpperArm", node: 7, useDefaultValues: true },
      { bone: "leftLowerArm", node: 8, useDefaultValues: true },
      { bone: "leftHand", node: 9, useDefaultValues: true },
      { bone: "rightShoulder", node: 10, useDefaultValues: true },
      { bone: "rightUpperArm", node: 11, useDefaultValues: true },
      { bone: "rightLowerArm", node: 12, useDefaultValues: true },
      { bone: "rightHand", node: 13, useDefaultValues: true },
      { bone: "leftUpperLeg", node: 14, useDefaultValues: true },
      { bone: "leftLowerLeg", node: 15, useDefaultValues: true },
      { bone: "leftFoot", node: 16, useDefaultValues: true },
      { bone: "rightUpperLeg", node: 17, useDefaultValues: true },
      { bone: "rightLowerLeg", node: 18, useDefaultValues: true },
      { bone: "rightFoot", node: 19, useDefaultValues: true },
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
      { name: "LookUp", presetName: "lookup", binds: [] },
      { name: "LookDown", presetName: "lookdown", binds: [] },
      { name: "LookLeft", presetName: "lookleft", binds: [] },
      { name: "LookRight", presetName: "lookright", binds: [] },
      { name: "Neutral", presetName: "neutral", binds: [] },
    ],
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
        bones: [20],
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
      name: "Naura_Anime_PBR",
      shader: "VRM_USE_GLTFSHADER",
      renderQueue: 2000,
    },
  ],
};

vrmObject.extensionsUsed = ["VRM"];
vrmObject.extensions = { VRM: vrmExtension };
vrmObject.buffers[0].byteLength = vrmBinBuffer.length;
const finalVrmBuffer = packageGlb(vrmObject, vrmBinBuffer);

console.log("=== [4/4] Menyimpan Model ke Semua Lokasi Target ===");
const targetDirs = [
  path.join(__dirname, "../dashboard/public/models"),
  path.join(__dirname, "../dashboard/dist/models"),
  path.join(__dirname, "../assets/3D Model Naura"),
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // naura.glb
  const glbPath = path.join(dir, "naura.glb");
  fs.writeFileSync(glbPath, finalGlbBuffer);
  console.log(
    `[OK] Disimpan: ${glbPath} (${(finalGlbBuffer.length / (1024 * 1024)).toFixed(2)} MB)`,
  );

  // Naura Hoshino 3D.glb (alias)
  const aliasPath = path.join(dir, "Naura Hoshino 3D.glb");
  fs.writeFileSync(aliasPath, finalGlbBuffer);

  // naura_pbr.glb (alias)
  const pbrAlias = path.join(dir, "naura_pbr.glb");
  fs.writeFileSync(pbrAlias, finalGlbBuffer);

  // naura.vrm
  const vrmPath = path.join(dir, "naura.vrm");
  fs.writeFileSync(vrmPath, finalVrmBuffer);
  console.log(
    `[OK] Disimpan: ${vrmPath} (${(finalVrmBuffer.length / (1024 * 1024)).toFixed(2)} MB)`,
  );
}

console.log(
  "\n✨ Sukses! Model 3D Naura Hoshino (GLB & VRM) berhasil dipaketkan dengan Thumbnail Avatar dan Spring Physics!",
);
