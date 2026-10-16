/**
 * core/nauraRuntimeFix.js - Menambal model Naura di RUNTIME, tepat setelah dimuat oleh loader.js.
 *
 * Perbaikan yang diterapkan:
 *   1. Bobot skinning rok/pinggul/paha/blazer/rambut yang bocor ke tulang lengan atau tangan
 *      dikembalikan ke bobot badan (Hips/Spine/Chest) serta menyatukan vertex kembar UV-seam.
 *   2. Segitiga jahitan tangan-ke-rok serta serpihan poligon kulit pinggul internal (efek kertas
 *      di selipan kedua tangan) dibuang secara presisi tanpa melubangi rok maupun manset lengan.
 *   3. Pembagian bobot Arm/ForeArm/Hand dihitung ulang mulus berdasar tinggi.
 *   4. Sendi bahu/siku/pergelangan dipindah ke tengah mesh lengan dan seluruh Inverse Bind Matrix
 *      (IBM) seluruh 20 tulang dihitung ulang secara sinkron agar manset dan pergelangan tangan
 *      tetap presisi di semua sudut rotasi animasi.
 */

import { NAURA_FIX } from "./nauraFixData.js";

function b64ToUint8(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function b64ToArray(b64, Ctor) {
    const bytes = b64ToUint8(b64);
    return new Ctor(bytes.buffer, bytes.byteOffset, bytes.byteLength / Ctor.BYTES_PER_ELEMENT);
}

/** Checksum cepat atas posisi vertex untuk memastikan mesh yang dimuat memang cocok. */
function positionChecksum(positionAttr) {
    let sum = 0;
    const arr = positionAttr.array;
    for (let i = 0; i < arr.length; i += 3) sum += arr[i] * 7 + arr[i + 1] * 13 + arr[i + 2] * 29;
    return sum;
}

function findSkinnedMesh(root) {
    let found = null;
    root.traverse((obj) => {
        if (obj.isSkinnedMesh && !found) found = obj;
    });
    return found;
}

function findBoneByName(root, name) {
    let found = null;
    root.traverse((obj) => {
        if (!found && obj.name === name && (obj.isBone || obj.isObject3D)) found = obj;
    });
    return found;
}

/**
 * Terapkan perbaikan pada scene GLTF/VRM yang sudah dimuat three.js.
 * @param {import("three").Object3D} sceneRoot - gltf.scene
 * @returns {{applied: boolean, reason?: string, details?: object}}
 */
export function applyNauraRuntimeFix(sceneRoot) {
    if (!sceneRoot) return { applied: false, reason: "sceneRoot kosong" };
    if (sceneRoot.userData && sceneRoot.userData.__nauraFixApplied === NAURA_FIX.version) {
        return { applied: false, reason: "sudah diterapkan sebelumnya (idempoten)" };
    }

    const mesh = findSkinnedMesh(sceneRoot);
    if (!mesh) return { applied: false, reason: "SkinnedMesh tidak ditemukan pada scene ini" };

    const geo = mesh.geometry;
    const posAttr = geo.getAttribute("position");
    if (!posAttr || posAttr.count !== NAURA_FIX.nVertices) {
        return {
            applied: false,
            reason: `jumlah vertex tidak cocok (${posAttr ? posAttr.count : "?"} vs ${NAURA_FIX.nVertices})`,
        };
    }
    const checksum = positionChecksum(posAttr);
    if (Math.abs(checksum - NAURA_FIX.posCheck) > Math.abs(NAURA_FIX.posCheck) * 1e-4 + 1e-3) {
        return { applied: false, reason: "checksum posisi vertex tidak cocok" };
    }

    // ---- 1+3. Bobot skinning: baris hasil perbaikan (kulit/rambut/rok/tangan) ----
    const rows = b64ToArray(NAURA_FIX.rows, Uint32Array);
    const rowJoints = b64ToArray(NAURA_FIX.rowJoints, Uint8Array);
    const rowWeights16 = b64ToArray(NAURA_FIX.rowWeights, Uint16Array);

    const skinIndexAttr = geo.getAttribute("skinIndex");
    const skinWeightAttr = geo.getAttribute("skinWeight");
    const skeleton = mesh.skeleton;
    const boneIndexByName = new Map(skeleton.bones.map((b, i) => [b.name, i]));
    const remap = NAURA_FIX.jointNames.map((nm) => {
        const i = boneIndexByName.get(nm);
        return i === undefined ? -1 : i;
    });
    let missingBone = false;
    for (let r = 0; r < rows.length; r++) {
        const vi = rows[r];
        for (let k = 0; k < 4; k++) {
            const patchJoint = rowJoints[r * 4 + k];
            const boneIdx = remap[patchJoint];
            if (boneIdx === -1) {
                missingBone = true;
                continue;
            }
            skinIndexAttr.setComponent(vi, k, boneIdx);
            skinWeightAttr.setComponent(vi, k, rowWeights16[r * 4 + k] / 65535);
        }
    }
    skinIndexAttr.needsUpdate = true;
    skinWeightAttr.needsUpdate = true;

    // ---- 2. Segitiga: buang jahitan tangan-ke-rok & serpihan poligon di selipan tangan ----
    const removed = b64ToArray(NAURA_FIX.removedTriangles, Uint32Array);
    const restore = NAURA_FIX.restoreTriangles
        ? b64ToArray(NAURA_FIX.restoreTriangles, Uint32Array)
        : new Uint32Array(0);
    const key3 = (a, b, c) => {
        const s = [a, b, c].sort((x, y) => x - y);
        return s[0] * 1e12 + s[1] * 1e6 + s[2];
    };
    const removedKeys = new Set();
    for (let i = 0; i < removed.length; i += 3) {
        removedKeys.add(key3(removed[i], removed[i + 1], removed[i + 2]));
    }

    const indexAttr = geo.getIndex();
    const srcIndex = indexAttr ? indexAttr.array : null;
    let triCount = 0;
    let dropped = 0;
    const kept = [];
    const existingKeys = new Set();
    let triReport;
    if (srcIndex) {
        for (let i = 0; i < srcIndex.length; i += 3) {
            const a = srcIndex[i];
            const b = srcIndex[i + 1];
            const c = srcIndex[i + 2];
            triCount++;
            const k = key3(a, b, c);
            if (removedKeys.has(k)) {
                dropped++;
                continue;
            }
            existingKeys.add(k);
            kept.push(a, b, c);
        }
        let restored = 0;
        for (let i = 0; i < restore.length; i += 3) {
            const a = restore[i];
            const b = restore[i + 1];
            const c = restore[i + 2];
            const k = key3(a, b, c);
            if (!existingKeys.has(k)) {
                kept.push(a, b, c);
                existingKeys.add(k);
                restored++;
            }
        }
        const IndexCtor = posAttr.count > 65535 ? Uint32Array : Uint16Array;
        const newIndexAttr = new (geo.getIndex().constructor)(new IndexCtor(kept), 1);
        newIndexAttr.needsUpdate = true;
        geo.setIndex(newIndexAttr);
        triReport = { before: triCount, dropped, restored, after: kept.length / 3 };
    } else {
        triReport = { skipped: true };
    }

    // ---- 4. Penyelarasan sendi bahu & lengan beserta sinkronisasi penuh Inverse Bind Matrices ----
    const TARGET_LOCAL_JOINTS = {
        LeftShoulder: [0.032, 0.02, 0.05],
        LeftArm: [0.045, -0.04, 0.048],
        LeftForeArm: [0.005, -0.09, 0.01],
        LeftHand: [0.005, -0.085, 0.014],
        RightShoulder: [0.032, 0.02, -0.05],
        RightArm: [0.045, -0.04, -0.048],
        RightForeArm: [0.005, -0.09, -0.01],
        RightHand: [0.005, -0.085, -0.014],
    };

    let moved = 0;
    for (const [nm, targetLocal] of Object.entries(TARGET_LOCAL_JOINTS)) {
        const bone = findBoneByName(sceneRoot, nm);
        if (!bone) continue;
        const dx = Math.abs(bone.position.x - targetLocal[0]);
        const dy = Math.abs(bone.position.y - targetLocal[1]);
        const dz = Math.abs(bone.position.z - targetLocal[2]);
        if (dx > 1e-4 || dy > 1e-4 || dz > 1e-4) {
            bone.position.set(targetLocal[0], targetLocal[1], targetLocal[2]);
            moved++;
        }
        bone.scale.set(1, 1, 1);
    }

    // PENTING: Perbarui matrixWorld seluruh scene, lalu hitung ulang boneInverses (IBM) untuk
    // SELURUH tulang pada skeleton. Sebelumnya, hanya IBM Shoulder dan Hand yang dihitung ulang
    // saat Shoulder digeser +0.022m, sehingga Arm dan ForeArm bergeser paksa +2.2cm dari pergelangan tangan.
    sceneRoot.updateMatrixWorld(true);
    skeleton.bones.forEach((b, i) => {
        b.updateWorldMatrix(true, false);
        skeleton.boneInverses[i] = b.matrixWorld.clone().invert();
    });
    skeleton.update();

    sceneRoot.userData = sceneRoot.userData || {};
    sceneRoot.userData.__nauraFixApplied = NAURA_FIX.version;

    return {
        applied: true,
        details: {
            vertexRowsFixed: rows.length,
            triangles: triReport,
            armJointsMoved: moved,
            missingBoneDuringSkinRemap: missingBone,
        },
    };
}
