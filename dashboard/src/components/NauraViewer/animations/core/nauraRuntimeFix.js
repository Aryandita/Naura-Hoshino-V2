/**
 * core/nauraRuntimeFix.js - Menambal model Naura di RUNTIME, tepat setelah dimuat oleh loader.js.
 *
 * KENAPA INI ADA:
 * Perbaikan sebelumnya mengharuskan menjalankan tools/apply_skin_fix.py lalu mengganti file .glb/.vrm
 * di /models/. Cara ini rapuh: gampang lupa dijalankan ulang, gampang tertimpa oleh pipeline build model
 * (mis. scripts/build_naura_model_new.js yang mengambil dari naura_master.glb), dan gampang tersaji dari
 * cache browser yang lama. Modul ini memindahkan perbaikan yang SAMA ke dalam kode aplikasi: setiap kali
 * model dimuat -- file apa pun yang dimuat -- perbaikan langsung diterapkan pada data three.js yang sudah
 * ada di memori. Tidak ada file .glb/.vrm yang perlu diganti lagi.
 *
 * Perbaikan yang diterapkan (identik dengan tools/apply_skin_fix.py):
 *   1. Bobot skinning rok/paha/blazer/rambut yang bocor ke tulang lengan -> dikembalikan ke bobot badan.
 *   2. Segitiga "jahitan" tangan-ke-rok dibuang; segitiga ketiak yang sempat ikut terbuang di versi lama
 *      dipulihkan (mencegah robekan blazer).
 *   3. Pembagian bobot Arm/ForeArm/Hand dihitung ulang mulus berdasar tinggi (mencegah tangan mengecil &
 *      lapisan baju saling menembus).
 *   4. Sendi bahu/siku/pergelangan dipindah ke tengah mesh lengan (pose diam tidak berubah).
 *   5. Tulang tangan diskalakan 1.25x agar proporsional dengan kepala.
 *
 * PEMAKAIAN (di hero3d.js / loader.js, SEKALI setelah gltf dimuat, SEBELUM createAnimationController):
 *   import { applyNauraRuntimeFix } from "../../../core/nauraRuntimeFix.js"; // sesuaikan path
 *   const report = applyNauraRuntimeFix(gltf.scene);
 *   console.log("[NauraFix]", report.applied ? "diterapkan" : "dilewati", report.reason || "");
 *
 * Modul ini TIDAK menyentuh file di disk dan TIDAK butuh Python. Aman dipanggil berkali-kali (idempoten):
 * panggilan kedua pada scene yang sama akan langsung dilewati (report.applied === false).
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

/** Checksum sederhana & cepat atas posisi vertex, dipakai untuk memastikan mesh yang dimuat memang cocok. */
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
        return { applied: false, reason: `jumlah vertex tidak cocok (${posAttr ? posAttr.count : "?"} vs ${NAURA_FIX.nVertices}); model ini berbeda dari yang dipakai untuk membuat patch` };
    }
    const checksum = positionChecksum(posAttr);
    if (Math.abs(checksum - NAURA_FIX.posCheck) > Math.abs(NAURA_FIX.posCheck) * 1e-4 + 1e-3) {
        return { applied: false, reason: "checksum posisi vertex tidak cocok; mesh berbeda dari yang dipakai untuk membuat patch" };
    }

    // ---- 1+3. Bobot skinning: baris hasil perbaikan (kulit/rambut/rok) + pembagian mulus lengan ----
    const rows = b64ToArray(NAURA_FIX.rows, Uint32Array);
    const rowJoints = b64ToArray(NAURA_FIX.rowJoints, Uint8Array);   // indeks joint dalam skeleton.bones, 4 per baris
    const rowWeights16 = b64ToArray(NAURA_FIX.rowWeights, Uint16Array); // 4 per baris, skala 0..65535

    const skinIndexAttr = geo.getAttribute("skinIndex");
    const skinWeightAttr = geo.getAttribute("skinWeight");
    // Peta: indeks joint pada data patch (urutan skin.joints saat dibuat) -> indeks bone pada skeleton three.js saat ini.
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
            if (boneIdx === -1) { missingBone = true; continue; }
            skinIndexAttr.setComponent(vi, k, boneIdx);
            skinWeightAttr.setComponent(vi, k, rowWeights16[r * 4 + k] / 65535);
        }
    }
    skinIndexAttr.needsUpdate = true;
    skinWeightAttr.needsUpdate = true;

    // ---- 2. Segitiga: buang jahitan, pulihkan ketiak (aman dipanggil pada mesh versi lama maupun baru) ----
    const removed = b64ToArray(NAURA_FIX.removedTriangles, Uint32Array); // triple vertex, flat
    const restore = b64ToArray(NAURA_FIX.restoreTriangles, Uint32Array); // triple vertex, flat
    const key3 = (a, b, c) => {
        const s = [a, b, c].sort((x, y) => x - y);
        return s[0] * 1e12 + s[1] * 1e6 + s[2];
    };
    const removedKeys = new Set();
    for (let i = 0; i < removed.length; i += 3) removedKeys.add(key3(removed[i], removed[i + 1], removed[i + 2]));

    const indexAttr = geo.getIndex();
    const srcIndex = indexAttr ? indexAttr.array : null;
    let triCount = 0, dropped = 0;
    const kept = [];
    const existingKeys = new Set();
    let triReport;
    if (srcIndex) {
        for (let i = 0; i < srcIndex.length; i += 3) {
            const a = srcIndex[i], b = srcIndex[i + 1], c = srcIndex[i + 2];
            triCount++;
            const k = key3(a, b, c);
            if (removedKeys.has(k)) { dropped++; continue; }
            existingKeys.add(k);
            kept.push(a, b, c);
        }
        let restored = 0;
        for (let i = 0; i < restore.length; i += 3) {
            const a = restore[i], b = restore[i + 1], c = restore[i + 2];
            const k = key3(a, b, c);
            if (!existingKeys.has(k)) { kept.push(a, b, c); existingKeys.add(k); restored++; }
        }
        const IndexCtor = posAttr.count > 65535 ? Uint32Array : Uint16Array;
        const newIndexAttr = new (geo.getIndex().constructor)(new IndexCtor(kept), 1);
        newIndexAttr.needsUpdate = true;
        geo.setIndex(newIndexAttr);
        triReport = { before: triCount, dropped, restored, after: kept.length / 3 };
    } else {
        triReport = { skipped: true };
    }

    // ---- 4. Re-rig sendi lengan (posisi dunia baru = tengah mesh lengan) ----
    const NEW_JOINTS = {
        RightArm: [0.045, 0.180, -0.098], RightForeArm: [0.050, 0.090, -0.108], RightHand: [0.055, 0.005, -0.122],
        LeftArm: [0.045, 0.180, 0.098], LeftForeArm: [0.050, 0.090, 0.108], LeftHand: [0.055, 0.005, 0.122],
    };
    const OLD_JOINTS = { RightArm: [0, .18, -.09], RightForeArm: [0, .08, -.11], RightHand: [0, -.04, -.12],
                          LeftArm: [0, .18, .09], LeftForeArm: [0, .08, .11], LeftHand: [0, -.04, .12] };
    let moved = 0, rerigSkipped = null;
    const worldPos = (bone) => { if (bone.getWorldPosition) bone.updateWorldMatrix(true, false); const p = new (Object.getPrototypeOf(bone.position).constructor)(); bone.getWorldPosition(p); return p; };
    const bones = {};
    let boneErr = false;
    for (const nm of Object.keys(NEW_JOINTS)) {
        const b = findBoneByName(sceneRoot, nm);
        if (!b) { boneErr = true; break; }
        bones[nm] = b;
    }
    if (boneErr) {
        rerigSkipped = "bone lengan tidak lengkap";
    } else {
        sceneRoot.updateWorldMatrix(true, true);
        const already = Object.entries(NEW_JOINTS).every(([nm, pos]) => {
            const wp = worldPos(bones[nm]);
            return Math.abs(wp.x - pos[0]) < 1e-4 && Math.abs(wp.y - pos[1]) < 1e-4 && Math.abs(wp.z - pos[2]) < 1e-4;
        });
        const isOld = Object.entries(OLD_JOINTS).every(([nm, pos]) => {
            const wp = worldPos(bones[nm]);
            return Math.abs(wp.x - pos[0]) < 1e-4 && Math.abs(wp.y - pos[1]) < 1e-4 && Math.abs(wp.z - pos[2]) < 1e-4;
        });
        if (already) {
            moved = 0;
        } else if (!isOld) {
            rerigSkipped = "posisi sendi lengan tidak dikenali (bukan posisi lama maupun baru)";
        } else {
            for (const nm of Object.keys(NEW_JOINTS)) {
                const bone = bones[nm];
                const parent = bone.parent;
                sceneRoot.updateWorldMatrix(true, true);
                const parentWorld = new (Object.getPrototypeOf(bone.position).constructor)();
                parent.getWorldPosition(parentWorld);
                const target = NEW_JOINTS[nm];
                const local = { x: target[0] - parentWorld.x, y: target[1] - parentWorld.y, z: target[2] - parentWorld.z };
                bone.position.set(local.x, local.y, local.z);
                bone.updateMatrixWorld(true);
                moved++;
            }
            // Inverse bind matrices harus ikut disesuaikan agar bind pose (T-pose skinning) tidak berubah.
            sceneRoot.updateMatrixWorld(true);
            skeleton.bones.forEach((b, i) => {
                if (Object.prototype.hasOwnProperty.call(NEW_JOINTS, b.name)) {
                    const ibm = skeleton.boneInverses[i];
                    const wp = new (Object.getPrototypeOf(b.position).constructor)(); b.getWorldPosition(wp);
                    ibm.elements[12] = -wp.x; ibm.elements[13] = -wp.y; ibm.elements[14] = -wp.z;
                }
            });
            skeleton.update();
        }
    }

    // ---- 4b. Dorong shoulder bones ke depan (+X) agar rantai lengan lebih jauh dari dada ----
    // Ini mengurangi mesh clipping di area chest/bahu pada semua animasi yang membawa
    // lengan ke posisi dada (Thinking, Shy, BlowKiss). Offset kecil (~2 cm) tidak
    // mengubah tampilan pose diam secara kasat mata, namun memberi clearance tambahan
    // antara forearm/hand dan mesh baju blazer saat siku ditekuk ke arah torso.
    const SHOULDER_FORWARD_OFFSET = 0.022; // meter, ke arah depan model (+X world)
    const SHOULDER_NAMES = ["RightShoulder", "LeftShoulder"];
    let shoulderNudged = 0;
    for (const nm of SHOULDER_NAMES) {
        const sb = findBoneByName(sceneRoot, nm);
        if (!sb) continue;
        sceneRoot.updateWorldMatrix(true, true);
        const wp = new (Object.getPrototypeOf(sb.position).constructor)();
        sb.getWorldPosition(wp);
        // Hanya nudge jika posisi X masih mendekati nol (belum pernah di-nudge)
        if (Math.abs(wp.x - SHOULDER_FORWARD_OFFSET) > 1e-4) {
            const parent = sb.parent;
            const parentWp = new (Object.getPrototypeOf(sb.position).constructor)();
            parent.getWorldPosition(parentWp);
            sb.position.x += SHOULDER_FORWARD_OFFSET;
            sb.updateMatrixWorld(true);
            // Perbarui IBM shoulder agar bind pose tidak berubah
            const bIdx = skeleton.bones.indexOf(sb);
            if (bIdx !== -1) {
                skeleton.boneInverses[bIdx] = sb.matrixWorld.clone().invert();
            }
            shoulderNudged++;
        }
    }
    if (shoulderNudged > 0) {
        sceneRoot.updateMatrixWorld(true);
        skeleton.update();
    }

    // ---- 5. Skala tangan ----
    // PENTING: mengubah scale sebuah tulang mengubah matrixWorld-nya, sehingga inverse bind matrix (IBM)
    // milik tulang itu WAJIB ikut dihitung ulang (snapshot pose "diam yang baru" lalu dibalik). Jika lupa,
    // setiap vertex yang bobotnya tercampur antara Hand dan ForeArm akan meregang tak wajar begitu lengan
    // diputar dari pose diam -- semakin besar putaran, semakin parah regangannya (muncul sebagai duri di
    // pergelangan pada putaran kecil, atau cakar memanjang pada putaran besar).
    let scaled = 0;
    for (const nm of ["LeftHand", "RightHand"]) {
        const b = findBoneByName(sceneRoot, nm);
        if (!b) continue;
        b.scale.set(1.25, 1.25, 1.25);
        b.updateMatrixWorld(true);
        const boneIdx = skeleton.bones.indexOf(b);
        if (boneIdx !== -1) skeleton.boneInverses[boneIdx] = b.matrixWorld.clone().invert();
        scaled++;
    }
    skeleton.update();

    sceneRoot.userData = sceneRoot.userData || {};
    sceneRoot.userData.__nauraFixApplied = NAURA_FIX.version;

    return {
        applied: true,
        details: {
            vertexRowsFixed: rows.length,
            triangles: triReport,
            armJointsMoved: moved,
            armRerigNote: rerigSkipped,
            shoulderNudged,
            handsScaled: scaled,
            missingBoneDuringSkinRemap: missingBone,
        },
    };
}
