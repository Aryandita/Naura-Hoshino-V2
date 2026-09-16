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
 * SLERP rotasi sendi tulang menggunakan Quaternion untuk mencegah gimbal lock.
 * @param {THREE.Object3D} boneNode
 * @param {[number, number, number]} fromEuler
 * @param {[number, number, number]} toEuler
 * @param {number} factor
 */
export function slerpBone(boneNode, fromEuler, toEuler, factor) {
    if (!boneNode) return;
    _eulerA.set(fromEuler[0], fromEuler[1], fromEuler[2], "YXZ");
    _eulerB.set(toEuler[0], toEuler[1], toEuler[2], "YXZ");
    _quatA.setFromEuler(_eulerA);
    _quatB.setFromEuler(_eulerB);
    _quatA.slerp(_quatB, factor);
    boneNode.quaternion.copy(_quatA);
}

/**
 * Evaluasi track keyframe berdasarkan waktu ternormalisasi (0.0 s/d 1.0).
 * @param {Array<{ t: number, val: any }>} keyframes
 * @param {number} timeNorm - Waktu dalam 0.0 s/d 1.0
 * @param {'euler' | 'scalar'} type
 * @returns {any}
 */
export function evaluateTrack(keyframes, timeNorm, type = "euler") {
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
            const u = range > 0.0001 ? (timeNorm - k0.t) / range : 0;
            const easedU = smootherStep(u);
            if (type === "euler") {
                return lerpEuler(k0.val, k1.val, easedU);
            }
            return lerpScalar(k0.val, k1.val, easedU);
        }
    }

    return keyframes[keyframes.length - 1].val;
}
