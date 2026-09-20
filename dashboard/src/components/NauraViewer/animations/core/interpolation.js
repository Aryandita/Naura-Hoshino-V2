/**
 * core/interpolation.js - Utilitas interpolasi gerak & kalkulasi rotasi.
 *
 * Menggunakan Hermite Quintic SmootherStep (C2-continuous) dan Quaternion SLERP
 * untuk menjamin zero-snapping dan bebas gimbal lock pada sudut ekstrem.
 */

import * as THREE from "three";

/**
 * Fungsi Hermite Quintic SmootherStep: C2-continuous (turunan pertama dan kedua kontinu).
 * @param {number} t - Nilai ternormalisasi 0.0 s/d 1.0
 * @returns {number}
 */
export function smootherStep(t) {
    const c = Math.max(0, Math.min(1, t));
    return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * Lerp antara dua array sudut Euler [x, y, z].
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @param {number} factor
 * @returns {[number, number, number]}
 */
export function lerpEuler(a, b, factor) {
    return [
        a[0] + (b[0] - a[0]) * factor,
        a[1] + (b[1] - a[1]) * factor,
        a[2] + (b[2] - a[2]) * factor,
    ];
}

/**
 * Lerp antara dua nilai skalar.
 * @param {number} a
 * @param {number} b
 * @param {number} factor
 * @returns {number}
 */
export function lerpScalar(a, b, factor) {
    return a + (b - a) * factor;
}

// Reusable scratch variables untuk alokasi memori nol saat render loop
const _eulerA = new THREE.Euler();
const _eulerB = new THREE.Euler();
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();

/**
 * Soft clamping rotasi sudut (mencegah clipping/kerutan mesh tanpa sentakan kaku).
 * Menggunakan kurva kompresi eksponensial di antara batas aman (softLimit) dan batas keras (hardLimit).
 * @param {number} angle - Sudut dalam radian
 * @param {number} softMin - Batas bawah zona aman
 * @param {number} softMax - Batas atas zona aman
 * @param {number} hardMin - Batas bawah mutlak
 * @param {number} hardMax - Batas atas mutlak
 * @returns {number}
 */
export function softClampAngle(angle, softMin, softMax, hardMin, hardMax) {
    if (angle > softMax) {
        const span = Math.max(0.0001, hardMax - softMax);
        const over = angle - softMax;
        return softMax + span * (1.0 - Math.exp(-over / span));
    }
    if (angle < softMin) {
        const span = Math.max(0.0001, softMin - hardMin);
        const under = softMin - angle;
        return softMin - span * (1.0 - Math.exp(-under / span));
    }
    return angle;
}

/**
 * SLERP rotasi sendi tulang menggunakan Quaternion untuk mencegah gimbal lock.
 * @param {THREE.Object3D} boneNode
 * @param {[number, number, number]} fromEuler
 * @param {[number, number, number]} toEuler
 * @param {number} factor
 */
export function slerpBone(boneNode, fromEuler, toEuler, factor = 1.0) {
    if (!boneNode) return;
    const clampedFactor = THREE.MathUtils.clamp(factor, 0, 1);
    _eulerA.set(fromEuler[0], fromEuler[1], fromEuler[2], "YXZ");
    _eulerB.set(toEuler[0], toEuler[1], toEuler[2], "YXZ");
    _quatA.setFromEuler(_eulerA);
    _quatB.setFromEuler(_eulerB);
    _quatA.slerp(_quatB, clampedFactor);
    boneNode.quaternion.copy(_quatA);
}

/**
 * SLERP langsung dari orientasi quaternion tulang saat ini menuju target Euler.
 * @param {THREE.Object3D} boneNode
 * @param {[number, number, number]} targetEuler
 * @param {number} factor
 */
export function slerpBoneDirect(boneNode, targetEuler, factor = 1.0) {
    if (!boneNode) return;
    const clampedFactor = THREE.MathUtils.clamp(factor, 0, 1);
    _eulerB.set(targetEuler[0], targetEuler[1], targetEuler[2], "YXZ");
    _quatB.setFromEuler(_eulerB);
    boneNode.quaternion.slerp(_quatB, clampedFactor);
}

/**
 * Menghitung tangen Hermite monoton (PCHIP / Fritsch-Carlson) untuk satu track keyframe.
 * Hasilnya di-cache per array keyframe (WeakMap), jadi biayanya hanya dibayar sekali.
 *
 * Mengapa bukan smootherStep per segmen (versi lama)? Easing per segmen membuat kecepatan
 * turun ke nol di SETIAP keyframe, sehingga gerak terlihat patah-patah seperti robot.
 * Spline monoton menjaga kecepatan tetap kontinu melewati keyframe, tetap diam pada bagian
 * yang memang ditahan (nilai sama) dan tidak pernah "overshoot" di luar nilai keyframe.
 *
 * @param {Array<{ t: number, val: number|number[] }>} keyframes
 * @param {boolean} loop - true bila track periodik (nilai awal == nilai akhir): tangen ujung disambung.
 */
const _tangentCache = new WeakMap();

function pchipSlope(dPrev, dNext, hPrev, hNext) {
    if (dPrev * dNext <= 0) return 0;
    const w1 = 2 * hNext + hPrev;
    const w2 = hNext + 2 * hPrev;
    return (w1 + w2) / (w1 / dPrev + w2 / dNext);
}

function getTangents(keyframes, loop) {
    const entry = _tangentCache.get(keyframes);
    if (entry && entry.loop === loop) return entry.tangents;

    const n = keyframes.length;
    const isVec = Array.isArray(keyframes[0].val);
    const dim = isVec ? keyframes[0].val.length : 1;
    const tangents = Array.from({ length: n }, () => new Float64Array(dim));

    for (let c = 0; c < dim; c++) {
        const v = (i) => (isVec ? keyframes[i].val[c] : keyframes[i].val);
        const h = new Float64Array(n - 1);
        const d = new Float64Array(n - 1);
        for (let i = 0; i < n - 1; i++) {
            h[i] = Math.max(1e-6, keyframes[i + 1].t - keyframes[i].t);
            d[i] = (v(i + 1) - v(i)) / h[i];
        }
        for (let i = 1; i < n - 1; i++) {
            tangents[i][c] = pchipSlope(d[i - 1], d[i], h[i - 1], h[i]);
        }
        if (n > 2 && loop) {
            // Ujung track disambung: kecepatan di t=0 dan t=1 sama (tanpa jeda saat loop berulang)
            const s = pchipSlope(d[n - 2], d[0], h[n - 2], h[0]);
            tangents[0][c] = s;
            tangents[n - 1][c] = s;
        }
        // loop=false: tangen ujung = 0 -> mulai & berhenti dengan lembut (ease-in / ease-out)
    }

    _tangentCache.set(keyframes, { loop, tangents });
    return tangents;
}

/**
 * Evaluasi track keyframe berdasarkan waktu ternormalisasi (0.0 s/d 1.0).
 * Interpolasi: cubic Hermite dengan tangen monoton (kecepatan kontinu antar keyframe).
 * @param {Array<{ t: number, val: any }>} keyframes
 * @param {number} timeNorm - Waktu dalam 0.0 s/d 1.0
 * @param {'euler' | 'scalar'} type
 * @param {boolean} [loop=false] - true untuk animasi yang berulang (isLoop)
 * @returns {any}
 */
export function evaluateTrack(keyframes, timeNorm, type = "euler", loop = false) {
    if (!keyframes || keyframes.length === 0) {
        return type === "euler" ? [0, 0, 0] : 0;
    }
    if (keyframes.length === 1 || timeNorm <= keyframes[0].t) {
        return keyframes[0].val;
    }
    if (timeNorm >= keyframes[keyframes.length - 1].t) {
        return keyframes[keyframes.length - 1].val;
    }

    // Cari dua keyframe yang mengapit timeNorm
    for (let i = 0; i < keyframes.length - 1; i++) {
        const k0 = keyframes[i];
        const k1 = keyframes[i + 1];
        if (timeNorm >= k0.t && timeNorm <= k1.t) {
            const range = k1.t - k0.t;
            if (range <= 0.0001) return k1.val;
            const u = (timeNorm - k0.t) / range;
            const u2 = u * u;
            const u3 = u2 * u;
            const h00 = 2 * u3 - 3 * u2 + 1;
            const h10 = u3 - 2 * u2 + u;
            const h01 = -2 * u3 + 3 * u2;
            const h11 = u3 - u2;
            const tan = getTangents(keyframes, loop);

            if (type === "euler") {
                const out = [0, 0, 0];
                for (let c = 0; c < 3; c++) {
                    out[c] = h00 * k0.val[c] + h10 * range * tan[i][c] + h01 * k1.val[c] + h11 * range * tan[i + 1][c];
                }
                return out;
            }
            return h00 * k0.val + h10 * range * tan[i][0] + h01 * k1.val + h11 * range * tan[i + 1][0];
        }
    }

    return keyframes[keyframes.length - 1].val;
}
