/**
 * scripts/verify-baked-glb.js
 *
 * Verifikasi Mendalam Format & Integritas Animasi pada naura_animated.glb
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const targetFile = path.join(__dirname, "../dashboard/public/models/naura_animated.glb");
if (!fs.existsSync(targetFile)) {
    console.error("❌ File tidak ditemukan:", targetFile);
    process.exit(1);
}

const buf = fs.readFileSync(targetFile);
console.log("=== [1/4] Memeriksa Header Biner GLB ===");
const magic = buf.readUInt32LE(0);
const version = buf.readUInt32LE(4);
const totalLength = buf.readUInt32LE(8);
console.log(`Magic: 0x${magic.toString(16)} (ekspektasi: 0x46546c67 'glTF')`);
console.log(`Version: ${version} (ekspektasi: 2)`);
console.log(`Length: ${totalLength} bytes (ukuran file: ${buf.length} bytes)`);

if (magic !== 0x46546c67 || version !== 2 || totalLength !== buf.length) {
    console.error("❌ Header GLB tidak valid!");
    process.exit(1);
}

const jsonChunkLen = buf.readUInt32LE(12);
const jsonChunkType = buf.readUInt32LE(16);
console.log(`JSON Chunk: length=${jsonChunkLen}, type=0x${jsonChunkType.toString(16)} ('JSON')`);

const binHeaderOffset = 20 + jsonChunkLen;
const binChunkLen = buf.readUInt32LE(binHeaderOffset);
const binChunkType = buf.readUInt32LE(binHeaderOffset + 4);
console.log(`BIN Chunk: length=${binChunkLen}, type=0x${binChunkType.toString(16)} ('BIN\\0')`);

if (20 + jsonChunkLen + 8 + binChunkLen !== totalLength) {
    console.error("❌ Ukuran chunk tidak sesuai total file length!");
    process.exit(1);
}

console.log("\n=== [2/4] Memeriksa Struktur GLTF JSON & Animasi ===");
const jsonStr = buf.toString("utf8", 20, 20 + jsonChunkLen);
const gltf = JSON.parse(jsonStr);

console.log(`Nodes: ${gltf.nodes.length}`);
console.log(`BufferViews: ${gltf.bufferViews.length}`);
console.log(`Accessors: ${gltf.accessors.length}`);
console.log(`Animations: ${gltf.animations.length} (ekspektasi: 31)`);

if (!gltf.animations || gltf.animations.length !== 31) {
    console.error(`❌ Jumlah animasi tidak 31 (didapat: ${gltf.animations?.length})`);
    process.exit(1);
}

console.log("\n=== [3/4] Validasi Detail Per Animasi ===");
const binData = buf.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binChunkLen);

let allValid = true;
gltf.animations.forEach((anim, idx) => {
    const channelCount = anim.channels.length;
    const samplerCount = anim.samplers.length;

    // Check time accessor
    const s0 = anim.samplers[0];
    const timeAcc = gltf.accessors[s0.input];
    const durMax = timeAcc.max[0];
    const frames = timeAcc.count;

    // Verify quaternion normalization on first rotation channel
    const rotChan = anim.channels.find(c => c.target.path === "rotation");
    if (rotChan) {
        const sRot = anim.samplers[rotChan.sampler];
        const rotAcc = gltf.accessors[sRot.output];
        const rotBv = gltf.bufferViews[rotAcc.bufferView];
        const byteOffset = (rotBv.byteOffset || 0) + (rotAcc.byteOffset || 0);

        // Read first quaternion
        const qx = binData.readFloatLE(byteOffset);
        const qy = binData.readFloatLE(byteOffset + 4);
        const qz = binData.readFloatLE(byteOffset + 8);
        const qw = binData.readFloatLE(byteOffset + 12);
        const lenSq = qx * qx + qy * qy + qz * qz + qw * qw;
        if (Math.abs(lenSq - 1.0) > 0.01) {
            console.error(`❌ Animasi ${anim.name} rotasi quaternion tidak ternormalisasi! lenSq=${lenSq}`);
            allValid = false;
        }
    }

    console.log(` [${String(idx + 1).padStart(2)}] "${anim.name.padEnd(14)}" | frames: ${String(frames).padStart(3)} | dur: ${durMax.toFixed(2)}s | channels: ${String(channelCount).padStart(2)} | samplers: ${String(samplerCount).padStart(2)}`);
});

console.log("\n=== [4/4] Verifikasi Paritas Target Spesifikasi (A01 - A31) ===");
const EXPECTED_31 = [
    "Idle", "Wave", "Thinking", "NodYes", "ShakeNo", "WalkForward", "WalkBackward", "Sit",
    "Type", "DanceLoop1", "DanceLoop2", "Cheers", "Shy", "Sleepy", "BlowKiss",
    "AstralCast", "StarPose", "Dizzy", "Read", "HoldItem", "Salute", "Bow",
    "Yawn", "Stretch", "CombatStance", "Craft", "Drink", "Eat", "Point",
    "TurnLeft", "TurnRight"
];

const missing = EXPECTED_31.filter(name => !gltf.animations.some(a => a.name === name));
if (missing.length > 0) {
    console.error("❌ Animasi yang hilang dari spesifikasi:", missing);
    process.exit(1);
} else {
    console.log("✅ 31 / 31 animasi spesifikasi terverifikasi 100% lengkap!");
}

if (allValid) {
    console.log("\n🎉 VERIFIKASI BERHASIL! naura_animated.glb siap digunakan untuk produksi!");
} else {
    console.error("\n❌ Verifikasi menemukan masalah!");
    process.exit(1);
}
