"use strict";

/**
 * Konversi vital pemain (HP, haus, lapar, energi) menjadi persentase aman
 * yang dipagari 0 sampai batas atas.
 *
 * Fungsi murni tanpa efek samping, sesuai RULES.md bagian Law 5, sehingga
 * bisa diuji tanpa mock database.
 *
 * Catatan penting soal operator `??`:
 * Nilai vital berasal dari kolom INTEGER yang TIDAK memakai `allowNull: false`
 * di model UserSurvival, sehingga `null` adalah nilai yang sah di database.
 * Penulis yang salah memakai `Number(value) ?? 100` akan mengira operator itu
 * memberi nilai cadangan, padahal `Number()` sudah mengubah `null` menjadi `0`
 * lebih dulu, dan `0 ?? 100` tetap bernilai `0`. Untuk `undefined`, `Number()`
 * menghasilkan `NaN`, dan `NaN` bukan nilai nullish sehingga `??` tidak pernah
 * menyala. Hasilnya bar menampilkan 0% (merah kritis) untuk pemain yang sehat,
 * atau teks "NaN%" yang membuat `style.width` ditolak diam-diam oleh browser.
 * Karena itu yang diperiksa di sini adalah finiteness, bukan nullishness.
 *
 * @param {unknown} value - Nilai vital mentah dari API atau database.
 * @param {object} [options] - Konfigurasi rentang dan nilai cadangan.
 * @param {number} [options.min=0] - Batas bawah hasil.
 * @param {number} [options.max=100] - Batas atas hasil.
 * @param {number} [options.fallback] - Nilai bila `value` bukan angka.
 *   Bawaannya mengikuti `max` supaya default 100 tetap berlaku.
 * @returns {number} Persentase bulat dalam rentang [min, max], selalu finite.
 */
function clampVitalPercent(value, options = {}) {
  const { min = 0, max = 100 } = options;
  const fallback = Number.isFinite(options.fallback) ? options.fallback : max;

  // Hanya number dan string angka yang diterima sebagai vital. Menolak tipe
  // lain secara eksplisit menutup jebakan konversi diam-diam: `Number(null)`
  // dan `Number([])` sama-sama menghasilkan 0, sehingga kolom NULL di database
  // akan terbaca sebagai pemain yang benar-benar pingsan.
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  const safe = Number.isFinite(num) ? num : fallback;

  // Math.min/max akan ikut menghasilkan NaN bila masukannya NaN, jadi `safe`
  // harus finite sebelum dijepit. Pembulatan dilakukan paling akhir.
  return Math.max(min, Math.min(max, Math.round(safe)));
}

/**
 * Terjemahkan persentase vital menjadi status tampilan.
 *
 * @param {unknown} percent - Persentase dari {@link clampVitalPercent}.
 * @param {object} [options] - Ambang status.
 * @param {number} [options.warning=60] - Di bawah ambang ini berstatus "warning".
 * @param {number} [options.critical=30] - Di bawah ambang ini berstatus "critical".
 * @returns {"critical"|"warning"|"healthy"} Status vital.
 */
function vitalTone(percent, options = {}) {
  const { warning = 60, critical = 30 } = options;
  const num = Number(percent);

  // Persentase yang tidak terbaca dianggap sehat, bukan kritis, supaya data
  // rusak tidak memicu alarm palsu pada dasbor.
  if (!Number.isFinite(num)) return "healthy";
  if (num < critical) return "critical";
  if (num < warning) return "warning";
  return "healthy";
}

// Berkas ini dipakai dua pihak sekaligus:
//   1. sisi Node (test dan bot) lewat `require`.
//   2. sisi browser lewat tag <script>, karena dasbor tidak dapat melakukan
//      `require` ke folder src/ (Express hanya memetakan /src ke dashboard/src
//      dan Vite tidak membundel berkas di luar root dashboard).
// Karena itu ekspor memakai pola UMD agar hanya ada SATU salinan logika yang
// teruji, bukan duplikat yang bisa berbeda diam-diam.
const vitalPercentApi = { clampVitalPercent, vitalTone };

if (typeof module === "object" && module.exports) {
  module.exports = vitalPercentApi;
} else if (typeof globalThis !== "undefined") {
  globalThis.NauraVitalPercent = vitalPercentApi;
}
