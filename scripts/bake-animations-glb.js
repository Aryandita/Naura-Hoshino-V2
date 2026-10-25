/**
 * scripts/bake-animations-glb.js
 *
 * Baker Animasi GLB Mandiri Naura Hoshino V2
 * Memanggang seluruh 31 animasi dari Technical Specification v1.0.0 (A01 - A31)
 * langsung ke dalam file GLB mandiri: "dashboard/public/models/naura_animated.glb".
 *
 * Fitur:
 * 1. Menggunakan base model "dashboard/public/models/naura.glb".
 * 2. Memetakan 20 tulang humanoid dan morph target wajah (Happy, Thinking, Sad, Angry, Blink, Talk).
 * 3. Normalisasi format track keyframe ({ val: [...] }, { x, y, z }, { v }).
 * 4. Mengonversi sudut Euler YXZ (Hermite spline kontinu) ke unit quaternion ternormalisasi.
 * 5. Menyertakan root translation, root scale, dan rotasi pinggul (hips).
 * 6. Sampling pada 30 FPS untuk kelancaran visual tanpa snapping.
 * 7. Format GLTF 2.0 biner (GLB) standar yang kompatibel dengan Three.js, Babylon, Blender, & Godot.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Peta nama bone di sequences/*.js ke node index rig naura.glb
const BONE_TO_NODE_INDEX = {
    // Torso & Kepala
    hips: 1, Hips: 1,
    spine: 2, Spine: 2,
    chest: 3, Chest: 3,
    neck: 4, Neck: 4,
    head: 5, Head: 5,
    ponytail: 6, Ponytail: 6,

    // Lengan Kiri
    leftShoulder: 7, LeftShoulder: 7,
    leftUpperArm: 8, leftArm: 8, LeftArm: 8,
    leftLowerArm: 9, leftForeArm: 9, LeftForeArm: 9,
    leftHand: 10, LeftHand: 10,

    // Lengan Kanan
    rightShoulder: 11, RightShoulder: 11,
    rightUpperArm: 12, rightArm: 12, RightArm: 12,
    rightLowerArm: 13, rightForeArm: 13, RightForeArm: 13,
    rightHand: 14, RightHand: 14,

    // Kaki Kiri
    leftUpperLeg: 15, leftUpLeg: 15, LeftUpLeg: 15,
    leftLowerLeg: 16, leftLeg: 16, LeftLeg: 16,
    leftFoot: 17, LeftFoot: 17,

    // Kaki Kanan
    rightUpperLeg: 18, rightUpLeg: 18, RightUpLeg: 18,
    rightLowerLeg: 19, rightLeg: 19, RightLeg: 19,
    rightFoot: 20, RightFoot: 20,
};

// Urutan morph target pada mesh Node 0
const MORPH_TARGETS = ["Happy", "Thinking", "Sad", "Angry", "Blink", "Talk"];

/**
 * Normalisasi format array keyframe agar selalu memiliki { t: 0..1, val: [...] | number }.
 * Mendukung format { val: [...] }, { x, y, z }, dan { v }.
 * Mengoreksi waktu 't' dalam detik ke normalisasi 0..1 jika diperlukan.
 * @param {Array} rawTrack
 * @param {number} duration
 * @param {'euler'|'scalar'} type
 * @returns {Array<{ t: number, val: any }>|null}
 */
function normalizeTrack(rawTrack, duration, type = "euler") {
    if (!Array.isArray(rawTrack) || rawTrack.length === 0) return null;

    let maxT = 0;
    for (const kf of rawTrack) {
        if (kf.t > maxT) maxT = kf.t;
    }
    const tDivisor = maxT > 1.0001 ? (duration || maxT) : 1.0;

    return rawTrack.map((kf) => {
        const normT = Math.max(0, Math.min(1, kf.t / tDivisor));
        let val;
        if (type === "euler") {
            if (Array.isArray(kf.val)) {
                val = [kf.val[0] || 0, kf.val[1] || 0, kf.val[2] || 0];
            } else if (kf.x !== undefined || kf.y !== undefined || kf.z !== undefined) {
                val = [kf.x || 0, kf.y || 0, kf.z || 0];
            } else {
                val = [0, 0, 0];
            }
        } else {
            if (typeof kf.val === "number") {
                val = kf.val;
            } else if (typeof kf.v === "number") {
                val = kf.v;
            } else {
                val = 0;
            }
        }
        return { t: normT, val };
    });
}

/**
 * Mengemas objek GLTF JSON dan buffer BIN menjadi file biner GLB standar (Khronos glTF 2.0).
 * @param {object} gltf
 * @param {Buffer} binBuffer
 * @returns {Buffer}
 */
function packageGlb(gltf, binBuffer) {
    let jsonString = JSON.stringify(gltf);
    while (Buffer.byteLength(jsonString, "utf8") % 4 !== 0) {
        jsonString += " ";
    }
    const jsonBuf = Buffer.from(jsonString, "utf8");

    let paddedBin = binBuffer;
    while (paddedBin.length % 4 !== 0) {
        paddedBin = Buffer.concat([paddedBin, Buffer.from([0])]);
    }

    const totalLength = 12 + 8 + jsonBuf.length + 8 + paddedBin.length;
    const glbBuf = Buffer.alloc(totalLength);

    // 1. Header GLB (12 bytes)
    glbBuf.writeUInt32LE(0x46546c67, 0); // 'glTF'
    glbBuf.writeUInt32LE(2, 4);          // version: 2
    glbBuf.writeUInt32LE(totalLength, 8);

    // 2. Chunk 0: JSON
    glbBuf.writeUInt32LE(jsonBuf.length, 12);
    glbBuf.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
    jsonBuf.copy(glbBuf, 20);

    // 3. Chunk 1: BIN
    const binOffset = 20 + jsonBuf.length;
    glbBuf.writeUInt32LE(paddedBin.length, binOffset);
    glbBuf.writeUInt32LE(0x004e4942, binOffset + 4); // 'BIN\0'
    paddedBin.copy(glbBuf, binOffset + 8);

    return glbBuf;
}

async function main() {
    console.log("================================================================================");
    console.log("🎬  NAURA HOSHINO V2 - 3D GLB ANIMATION BAKER (31 ANIMATIONS)");
    console.log("================================================================================\n");

    const inputGlbPath = path.join(__dirname, "../dashboard/public/models/naura.glb");
    if (!fs.existsSync(inputGlbPath)) {
        console.error("❌ Berkas base GLB tidak ditemukan:", inputGlbPath);
        process.exit(1);
    }

    console.log(`[1/5] Membaca berkas base GLB: ${inputGlbPath}`);
    const srcBuffer = fs.readFileSync(inputGlbPath);
    const jsonChunkLength = srcBuffer.readUInt32LE(12);
    const gltf = JSON.parse(srcBuffer.toString("utf8", 20, 20 + jsonChunkLength));

    const binHeaderOffset = 20 + jsonChunkLength;
    const binChunkLength = srcBuffer.readUInt32LE(binHeaderOffset);
    let currentBinBuffer = Buffer.from(
        srcBuffer.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binChunkLength)
    );

    console.log(`      Base GLB dimuat: ${gltf.nodes?.length || 0} nodes, BIN: ${currentBinBuffer.length} bytes.`);

    console.log("\n[2/5] Memuat definisi animasi dan utilitas interpolasi...");
    const { ANIMATION_DEFINITIONS } = await import(
        "../dashboard/src/components/NauraViewer/animations/sequences/index.js"
    );
    const { evaluateTrack } = await import(
        "../dashboard/src/components/NauraViewer/animations/core/interpolation.js"
    );
    const THREE = await import("three");

    const animKeys = Object.keys(ANIMATION_DEFINITIONS);
    console.log(`      Total ${animKeys.length} animasi siap dipanggang.`);

    // Scratch math helpers
    const _euler = new THREE.Euler(0, 0, 0, "YXZ");
    const _quat = new THREE.Quaternion();

    /**
     * Memasukkan typed array ke akhir binary buffer dan mengembalikan bufferView index.
     * @param {Float32Array} typedArray
     * @returns {number}
     */
    function appendBufferView(typedArray) {
        while (currentBinBuffer.length % 4 !== 0) {
            currentBinBuffer = Buffer.concat([currentBinBuffer, Buffer.from([0])]);
        }
        const byteOffset = currentBinBuffer.length;
        const byteLength = typedArray.byteLength;
        const dataBuffer = Buffer.from(typedArray.buffer, typedArray.byteOffset, byteLength);
        currentBinBuffer = Buffer.concat([currentBinBuffer, dataBuffer]);

        const bufferViewIndex = gltf.bufferViews.length;
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset,
            byteLength,
        });
        return bufferViewIndex;
    }

    console.log("\n[3/5] Memanggang kanal rotasi, translasi, skala, & morph target (30 FPS)...");
    const bakedAnimations = [];
    let totalChannels = 0;

    for (const [animName, seq] of Object.entries(ANIMATION_DEFINITIONS)) {
        const duration = seq.duration || 2.4;
        const isLoop = seq.isLoop ?? false;
        const fps = 30;
        const numFrames = Math.max(2, Math.round(duration * fps) + 1);

        // 1. Array Waktu (SCALAR FLOAT)
        const times = new Float32Array(numFrames);
        for (let f = 0; f < numFrames; f++) {
            times[f] = (f / (numFrames - 1)) * duration;
        }

        const timeBvIdx = appendBufferView(times);
        const timeAccIdx = gltf.accessors.length;
        gltf.accessors.push({
            bufferView: timeBvIdx,
            byteOffset: 0,
            componentType: 5126, // FLOAT
            count: numFrames,
            type: "SCALAR",
            min: [times[0]],
            max: [times[numFrames - 1]],
        });

        const channels = [];
        const samplers = [];

        // 2. Kumpulkan tulang yang dianimasikan
        const bonesToAnimate = new Map();
        if (seq.bones) {
            for (const [boneKey, track] of Object.entries(seq.bones)) {
                const nodeIdx = BONE_TO_NODE_INDEX[boneKey];
                if (nodeIdx !== undefined) {
                    bonesToAnimate.set(nodeIdx, {
                        boneKey,
                        normTrack: normalizeTrack(track, duration, "euler"),
                    });
                }
            }
        }

        // Postur default rileks alami jika hanya satu lengan yang memiliki aksi
        const leftArmActive = bonesToAnimate.has(8) || bonesToAnimate.has(9);
        const rightArmActive = bonesToAnimate.has(12) || bonesToAnimate.has(13);

        if (rightArmActive && !leftArmActive) {
            bonesToAnimate.set(8, {
                boneKey: "leftUpperArm",
                normTrack: normalizeTrack(
                    [{ t: 0, val: [-0.048, -0.008, 0.015] }, { t: 1, val: [-0.048, -0.008, 0.015] }],
                    duration,
                    "euler"
                ),
            });
            bonesToAnimate.set(9, {
                boneKey: "leftLowerArm",
                normTrack: normalizeTrack(
                    [{ t: 0, val: [-0.115, 0.015, 0.025] }, { t: 1, val: [-0.115, 0.015, 0.025] }],
                    duration,
                    "euler"
                ),
            });
        } else if (leftArmActive && !rightArmActive) {
            bonesToAnimate.set(12, {
                boneKey: "rightUpperArm",
                normTrack: normalizeTrack(
                    [{ t: 0, val: [0.048, 0.008, 0.015] }, { t: 1, val: [0.048, 0.008, 0.015] }],
                    duration,
                    "euler"
                ),
            });
            bonesToAnimate.set(13, {
                boneKey: "rightLowerArm",
                normTrack: normalizeTrack(
                    [{ t: 0, val: [0.115, -0.015, 0.025] }, { t: 1, val: [0.115, -0.015, 0.025] }],
                    duration,
                    "euler"
                ),
            });
        }

        // Pastikan rotY pada root juga menggerakkan rotasi Hips (Node 1)
        const normRotY = seq.root?.rotY ? normalizeTrack(seq.root.rotY, duration, "scalar") : null;
        if (normRotY && !bonesToAnimate.has(1)) {
            bonesToAnimate.set(1, { boneKey: "hips", normTrack: null });
        }

        // 3. Panggang setiap kanal rotasi tulang (VEC4 FLOAT Quaternion)
        for (const [nodeIdx, info] of bonesToAnimate.entries()) {
            const rotData = new Float32Array(numFrames * 4);

            for (let f = 0; f < numFrames; f++) {
                const tNorm = times[f] / duration;
                let eulerAngles = [0, 0, 0];

                if (info.normTrack) {
                    eulerAngles = evaluateTrack(info.normTrack, tNorm, "euler", isLoop) || [0, 0, 0];
                }

                // Tambahkan rotY root pada Hips jika ada
                if (nodeIdx === 1 && normRotY) {
                    const extraRotY = evaluateTrack(normRotY, tNorm, "scalar", isLoop) || 0;
                    eulerAngles = [eulerAngles[0], eulerAngles[1] + extraRotY, eulerAngles[2]];
                }

                _euler.set(eulerAngles[0], eulerAngles[1], eulerAngles[2], "YXZ");
                _quat.setFromEuler(_euler);
                _quat.normalize();

                const offset = f * 4;
                rotData[offset] = _quat.x;
                rotData[offset + 1] = _quat.y;
                rotData[offset + 2] = _quat.z;
                rotData[offset + 3] = _quat.w;
            }

            const rotBvIdx = appendBufferView(rotData);
            const rotAccIdx = gltf.accessors.length;
            gltf.accessors.push({
                bufferView: rotBvIdx,
                byteOffset: 0,
                componentType: 5126,
                count: numFrames,
                type: "VEC4",
            });

            const samplerIdx = samplers.length;
            samplers.push({
                input: timeAccIdx,
                interpolation: "LINEAR",
                output: rotAccIdx,
            });

            channels.push({
                sampler: samplerIdx,
                target: {
                    node: nodeIdx,
                    path: "rotation",
                },
            });
        }

        // 4. Panggang kanal translasi root pada Hips (Node 1, VEC3 FLOAT)
        const normPosX = seq.root?.posX ? normalizeTrack(seq.root.posX, duration, "scalar") : null;
        const normPosY = seq.root?.posY ? normalizeTrack(seq.root.posY, duration, "scalar") : null;
        const normPosZ = seq.root?.posZ ? normalizeTrack(seq.root.posZ, duration, "scalar") : null;

        if (normPosX || normPosY || normPosZ) {
            const transData = new Float32Array(numFrames * 3);

            for (let f = 0; f < numFrames; f++) {
                const tNorm = times[f] / duration;
                const px = normPosX ? evaluateTrack(normPosX, tNorm, "scalar", isLoop) || 0 : 0;
                const py = normPosY ? evaluateTrack(normPosY, tNorm, "scalar", isLoop) || 0 : 0;
                const pz = normPosZ ? evaluateTrack(normPosZ, tNorm, "scalar", isLoop) || 0 : 0;

                const offset = f * 3;
                transData[offset] = px;
                transData[offset + 1] = py;
                transData[offset + 2] = pz;
            }

            const transBvIdx = appendBufferView(transData);
            const transAccIdx = gltf.accessors.length;
            gltf.accessors.push({
                bufferView: transBvIdx,
                byteOffset: 0,
                componentType: 5126,
                count: numFrames,
                type: "VEC3",
            });

            const samplerIdx = samplers.length;
            samplers.push({
                input: timeAccIdx,
                interpolation: "LINEAR",
                output: transAccIdx,
            });

            channels.push({
                sampler: samplerIdx,
                target: {
                    node: 1,
                    path: "translation",
                },
            });
        }

        // 5. Panggang kanal skala root pada Hips (Node 1, VEC3 FLOAT)
        const normScale = seq.root?.scale ? normalizeTrack(seq.root.scale, duration, "scalar") : null;
        if (normScale) {
            const scaleData = new Float32Array(numFrames * 3);

            for (let f = 0; f < numFrames; f++) {
                const tNorm = times[f] / duration;
                const s = evaluateTrack(normScale, tNorm, "scalar", isLoop) || 1.0;

                const offset = f * 3;
                scaleData[offset] = s;
                scaleData[offset + 1] = s;
                scaleData[offset + 2] = s;
            }

            const scaleBvIdx = appendBufferView(scaleData);
            const scaleAccIdx = gltf.accessors.length;
            gltf.accessors.push({
                bufferView: scaleBvIdx,
                byteOffset: 0,
                componentType: 5126,
                count: numFrames,
                type: "VEC3",
            });

            const samplerIdx = samplers.length;
            samplers.push({
                input: timeAccIdx,
                interpolation: "LINEAR",
                output: scaleAccIdx,
            });

            channels.push({
                sampler: samplerIdx,
                target: {
                    node: 1,
                    path: "scale",
                },
            });
        }

        // 6. Panggang kanal ekspresi wajah morph target (Node 0, SCALAR FLOAT weights)
        const normMorphs = {};
        let hasMorphs = false;
        if (seq.morphs) {
            for (const mName of MORPH_TARGETS) {
                if (seq.morphs[mName]) {
                    normMorphs[mName] = normalizeTrack(seq.morphs[mName], duration, "scalar");
                    hasMorphs = true;
                }
            }
        }

        if (hasMorphs) {
            const weightData = new Float32Array(numFrames * MORPH_TARGETS.length);

            for (let f = 0; f < numFrames; f++) {
                const tNorm = times[f] / duration;
                const baseOffset = f * MORPH_TARGETS.length;

                for (let m = 0; m < MORPH_TARGETS.length; m++) {
                    const mName = MORPH_TARGETS[m];
                    const track = normMorphs[mName];
                    let weight = 0;
                    if (track) {
                        weight = evaluateTrack(track, tNorm, "scalar", isLoop) || 0;
                        weight = Math.max(0, Math.min(1, weight));
                    }
                    weightData[baseOffset + m] = weight;
                }
            }

            const weightBvIdx = appendBufferView(weightData);
            const weightAccIdx = gltf.accessors.length;
            gltf.accessors.push({
                bufferView: weightBvIdx,
                byteOffset: 0,
                componentType: 5126,
                count: numFrames * MORPH_TARGETS.length,
                type: "SCALAR",
            });

            const samplerIdx = samplers.length;
            samplers.push({
                input: timeAccIdx,
                interpolation: "LINEAR",
                output: weightAccIdx,
            });

            channels.push({
                sampler: samplerIdx,
                target: {
                    node: 0,
                    path: "weights",
                },
            });
        }

        bakedAnimations.push({
            name: animName,
            channels,
            samplers,
        });

        totalChannels += channels.length;
        console.log(`      ✓ [${animName.padEnd(14)}] dur: ${duration.toFixed(1)}s, ${numFrames} frames, ${channels.length} channels`);
    }

    console.log(`\n[4/5] Mengintegrasikan ${bakedAnimations.length} animasi ke struktur GLTF...`);
    gltf.animations = bakedAnimations;
    gltf.buffers[0].byteLength = currentBinBuffer.length;

    console.log(`      Total channel animasi: ${totalChannels}`);
    console.log(`      Ukuran BIN baru: ${(currentBinBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

    console.log("\n[5/5] Mengemas GLB biner mandiri & menyimpan ke lokasi target...");
    const finalGlbBuffer = packageGlb(gltf, currentBinBuffer);

    const outputTargets = [
        path.join(__dirname, "../dashboard/public/models/naura_animated.glb"),
        path.join(__dirname, "../assets/3D Model Naura/naura_animated.glb"),
    ];

    const distDir = path.join(__dirname, "../dashboard/dist/models");
    if (fs.existsSync(distDir)) {
        outputTargets.push(path.join(distDir, "naura_animated.glb"));
    }

    for (const targetPath of outputTargets) {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(targetPath, finalGlbBuffer);
        const mb = (finalGlbBuffer.length / (1024 * 1024)).toFixed(2);
        console.log(`      💾 Tersimpan: ${targetPath} (${mb} MB)`);
    }

    console.log("\n================================================================================");
    console.log("✨ PEMANGGANGAN SELESAI DENGAN SUKSES!");
    console.log(`   - Model Output : naura_animated.glb (${(finalGlbBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`   - Animasi      : ${bakedAnimations.length} klip mandiri (A01 - A31)`);
    console.log(`   - Kanal Total  : ${totalChannels} channels`);
    console.log("================================================================================\n");
}

main().catch((err) => {
    console.error("❌ Terjadi kesalahan fatal saat memanggang animasi GLB:", err);
    process.exit(1);
});
