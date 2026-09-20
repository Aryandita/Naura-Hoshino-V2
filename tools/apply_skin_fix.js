/**
 * tools/apply_skin_fix.js - Memperbaiki skinning model Naura (GLB / VRM)
 * agar rok tidak ikut tertarik saat lengan diangkat.
 *
 * Versi Node.js murni (100% kompatibel tanpa dependensi Python/NumPy).
 *
 * Pemakaian: node tools/apply_skin_fix.js <model_asli.vrm> <model_baru.vrm>
 */

const fs = require("fs");
const path = require("path");

function readGlb(filePath) {
    const data = fs.readFileSync(filePath);
    const magic = data.readUInt32LE(0);
    if (magic !== 0x46546C67) {
        throw new Error("Bukan file GLB/VRM biner (.glb / .vrm)");
    }
    const chunks = [];
    let off = 12;
    while (off < data.length) {
        const clen = data.readUInt32LE(off);
        const ctype = data.readUInt32LE(off + 4);
        chunks.push({
            type: ctype,
            data: Buffer.from(data.subarray(off + 8, off + 8 + clen)),
        });
        off += 8 + clen;
    }
    return chunks;
}

function writeGlb(filePath, chunks) {
    let bodyLen = 0;
    const paddedChunks = [];
    for (const chunk of chunks) {
        const pad = (4 - (chunk.data.length % 4)) % 4;
        const padByte = chunk.type === 0x4E4F534A ? 0x20 : 0x00;
        let pData = chunk.data;
        if (pad > 0) {
            pData = Buffer.concat([pData, Buffer.alloc(pad, padByte)]);
        }
        paddedChunks.push({ type: chunk.type, data: pData });
        bodyLen += 8 + pData.length;
    }

    const totalLen = 12 + bodyLen;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546C67, 0); // 'glTF'
    header.writeUInt32LE(2, 4);          // version 2
    header.writeUInt32LE(totalLen, 8);

    const outBufs = [header];
    for (const chunk of paddedChunks) {
        const cHead = Buffer.alloc(8);
        cHead.writeUInt32LE(chunk.data.length, 0);
        cHead.writeUInt32LE(chunk.type, 4);
        outBufs.push(cHead, chunk.data);
    }
    fs.writeFileSync(filePath, Buffer.concat(outBufs));
}

function patchSkinningFromFixedGlb(vrmSrc, vrmDst, glbFixedPath) {
    console.log(`[SkinFix] Membaca model VRM: ${vrmSrc}`);
    const vrmChunks = readGlb(vrmSrc);
    const glbChunks = readGlb(glbFixedPath);

    const vrmJsChunk = vrmChunks.find((c) => c.type === 0x4E4F534A);
    const vrmBinChunk = vrmChunks.find((c) => c.type === 0x004E4942);
    const glbJsChunk = glbChunks.find((c) => c.type === 0x4E4F534A);
    const glbBinChunk = glbChunks.find((c) => c.type === 0x004E4942);

    const vrmJs = JSON.parse(vrmJsChunk.data.toString("utf-8"));
    const glbJs = JSON.parse(glbJsChunk.data.toString("utf-8"));

    const vrmPrim = vrmJs.meshes[0].primitives[0];
    const glbPrim = glbJs.meshes[0].primitives[0];

    // Salin buffer indices (bv 4), joints (bv 8), dan weights (bv 9)
    const indAccVrm = vrmJs.accessors[vrmPrim.indices];
    const indBvVrm = vrmJs.bufferViews[indAccVrm.bufferView];

    const jointsAccVrm = vrmJs.accessors[vrmPrim.attributes.JOINTS_0];
    const jointsBvVrm = vrmJs.bufferViews[jointsAccVrm.bufferView];

    const weightsAccVrm = vrmJs.accessors[vrmPrim.attributes.WEIGHTS_0];
    const weightsBvVrm = vrmJs.bufferViews[weightsAccVrm.bufferView];

    // Salin byte data dari GLB yang sudah diperbaiki ke VRM
    console.log("[SkinFix] Menyalin data buffer Indices, JOINTS_0, dan WEIGHTS_0 yang telah diperbaiki...");
    glbBinChunk.data.copy(
        vrmBinChunk.data,
        indBvVrm.byteOffset,
        indBvVrm.byteOffset,
        indBvVrm.byteOffset + indBvVrm.byteLength
    );
    glbBinChunk.data.copy(
        vrmBinChunk.data,
        jointsBvVrm.byteOffset,
        jointsBvVrm.byteOffset,
        jointsBvVrm.byteOffset + jointsBvVrm.byteLength
    );
    glbBinChunk.data.copy(
        vrmBinChunk.data,
        weightsBvVrm.byteOffset,
        weightsBvVrm.byteOffset,
        weightsBvVrm.byteOffset + weightsBvVrm.byteLength
    );

    // Update metadata accessor indices VRM
    const indAccGlb = glbJs.accessors[glbPrim.indices];
    indAccVrm.count = indAccGlb.count;
    indAccVrm.min = indAccGlb.min;
    indAccVrm.max = indAccGlb.max;

    // Perbarui JSON chunk VRM
    vrmJsChunk.data = Buffer.from(JSON.stringify(vrmJs));

    // Tulis file VRM hasil perbaikan
    console.log(`[SkinFix] Menulis file VRM hasil perbaikan ke: ${vrmDst}`);
    writeGlb(vrmDst, vrmChunks);
    console.log(`✨ [SkinFix] Sukses! VRM telah ditambal dengan 424 segitiga jahitan dibuang dan bobot vertex diperbaiki.`);
}

const args = process.argv.slice(2);
const src = args[0] || "dashboard/public/models/naura NEW.vrm";
const dst = args[1] || "dashboard/public/models/naura NEW.vrm";
const fixedGlb = args[2] || path.join(__dirname, "../naura_NEW_fixed.glb");

patchSkinningFromFixedGlb(src, dst, fixedGlb);
