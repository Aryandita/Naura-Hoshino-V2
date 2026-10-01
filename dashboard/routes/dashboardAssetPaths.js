"use strict";

// =============================================================
// Sumber kebenaran path aset yang dirujuk dashboard.
//
// Filesystem-driven: nama file di sini divalidasi oleh
// src/utils/dashboardAssets.test.js terhadap isi disk sungguhan.
// Test itu yang menangkap bug "Surprised.png" dan "Salute.png" yang
// dirujuk padahal tidak pernah ada di assets/Naura_Expression/.
// =============================================================

/**
 * Avatar ekspresi Naura untuk fallback leaderboard.
 * Hanya memuat file yang benar-benar ada di disk.
 * @type {readonly string[]}
 */
const EXPRESSION_AVATARS = Object.freeze([
  "/assets/Naura_Expression/Thinking.png",
  "/assets/Naura_Expression/Cheers.png",
  "/assets/Naura_Expression/Read.png",
  "/assets/Naura_Expression/Shocked.png",
  "/assets/Naura_Expression/Sleepy.png",
]);

/**
 * Model 3D yang sudah lolos uji struktur biner (skin, bone, animasi, morph).
 * Hanya model dengan rig sungguhan yang dipertahankan. Berkas seperti
 * naura_pbr.glb pernah ada di sini, tetapi isinya geometri diam tanpa rig
 * sehingga animasi dan ekspresi tidak pernah bisa bergerak.
 * Nama file aslinya memuat SPASI ("naura NEW.vrm"), jadi URL harus memakai
 * %20 agar tidak ditafsirkan salah oleh browser.
 * @type {readonly string[]}
 */
const MODEL_3D = Object.freeze([
  "/models/naura%20NEW.vrm",
  "/models/naura.vrm",
  "/models/naura%20NEW.glb",
  "/models/naura.glb",
]);

module.exports = {
  EXPRESSION_AVATARS,
  MODEL_3D,
};
