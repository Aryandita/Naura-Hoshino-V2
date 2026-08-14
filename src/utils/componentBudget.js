"use strict";

/**
 * Pengaman batas Components V2.
 *
 * Discord menolak seluruh pesan bila jumlah komponen melewati 40 (termasuk yang
 * bersarang) atau total teks melewati 4000 karakter. Kegagalannya muncul sebagai
 * `Invalid Form Body` di produksi, jauh dari tempat payload dirakit, dan pesan
 * errornya tidak menyebut komponen mana yang bersalah.
 *
 * AGENTS.md mewajibkan struktur 5 lapisan di setiap respons, jadi container kita
 * memang cenderung padat. Lebih baik dipotong di builder dengan catatan yang
 * jelas daripada seluruh balasan hilang.
 *
 * Modul ini murni fungsi, tanpa dependensi discord.js, supaya bisa dites tanpa
 * koneksi apa pun.
 */

const MAX_COMPONENTS = 40;
const MAX_TEXT_LENGTH = 4000;

// Ambang aman untuk satu blok teks. Deskripsi sepanjang ini sudah tidak nyaman
// dibaca di Discord, dan menyisakan ruang untuk header, field, serta footer.
const MAX_DESCRIPTION_LENGTH = 3000;
const MAX_FIELD_LENGTH = 1000;

const TEXT_DISPLAY = 10;

/**
 * Hitung jumlah komponen termasuk yang bersarang.
 *
 * Discord menghitung komponen di dalam section, gallery, action row, dan
 * accessory. Menghitung hanya level teratas adalah cara paling mudah untuk
 * merasa aman padahal tidak.
 */
function countComponents(list) {
  if (!Array.isArray(list)) return 0;

  let total = 0;
  for (const component of list) {
    if (!component || typeof component !== "object") continue;
    total += 1;
    total += countComponents(component.components);
    total += countComponents(component.items);
    if (component.accessory) total += countComponents([component.accessory]);
  }
  return total;
}

/** Total panjang teks yang tampil, dihitung rekursif. */
function measureTextLength(list) {
  if (!Array.isArray(list)) return 0;

  let total = 0;
  for (const component of list) {
    if (!component || typeof component !== "object") continue;
    if (
      component.type === TEXT_DISPLAY &&
      typeof component.content === "string"
    ) {
      total += component.content.length;
    }
    total += measureTextLength(component.components);
    total += measureTextLength(component.items);
    if (component.accessory) total += measureTextLength([component.accessory]);
  }
  return total;
}

/** Pangkas teks dengan penanda, tanpa memotong di tengah spasi. */
function truncateText(text, maxLength) {
  if (typeof text !== "string") return text;
  if (!Number.isInteger(maxLength) || maxLength <= 0) return text;
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

/**
 * Pastikan daftar komponen masih di dalam batas Discord.
 *
 * Hanya indeks yang ditandai `droppableIndices` yang boleh dibuang, biasanya
 * field opsional. Header, tombol, dan footer tidak pernah dikorbankan karena
 * membuang tombol berarti membuang satu-satunya jalan pengguna melanjutkan alur.
 *
 * Komponen pertama yang dibuang diganti catatan, bukan dihapus, supaya pengguna
 * tahu ada isi yang dipotong dan posisi catatannya tetap benar.
 *
 * @param {Array<object>} components
 * @param {{ maxComponents?: number, maxTextLength?: number, droppableIndices?: number[], notice?: string }} [options]
 */
function enforceComponentBudget(components, options = {}) {
  const source = Array.isArray(components) ? components.slice() : [];
  const maxComponents = Number.isInteger(options.maxComponents)
    ? options.maxComponents
    : MAX_COMPONENTS;
  const maxTextLength = Number.isInteger(options.maxTextLength)
    ? options.maxTextLength
    : MAX_TEXT_LENGTH;
  const notice = typeof options.notice === "string" ? options.notice : null;

  const droppable = (
    Array.isArray(options.droppableIndices) ? options.droppableIndices : []
  )
    .filter(
      (index) => Number.isInteger(index) && index >= 0 && index < source.length,
    )
    .sort((a, b) => a - b);

  const removed = new Set();
  const visible = () => source.filter((_, index) => !removed.has(index));
  // Jika notice akan disisipkan, ia butuh satu slot komponen
  let noticeWillConsumeSlot = false;
  if (notice && droppable.length > 0) {
    // Asumsi notice akan mengganti satu elemen
    noticeWillConsumeSlot = true;
  }

  const overBudget = () => {
    const list = visible();
    let currentCount = countComponents(list);
    let currentText = measureTextLength(list);
    if (noticeWillConsumeSlot && removed.size > 0) {
      // Notice akan mengambil 1 slot teks dan 1 komponen
      currentCount += 1;
      currentText += notice.length;
    }
    return currentCount > maxComponents || currentText > maxTextLength;
  };

  // Dibuang dari belakang: field terakhir biasanya paling tidak penting.
  for (let i = droppable.length - 1; i >= 0 && overBudget(); i -= 1) {
    removed.add(droppable[i]);
  }

  const dropped = removed.size;
  if (dropped > 0 && notice) {
    const noticeIndex = Math.min(...removed);
    removed.delete(noticeIndex);
    source[noticeIndex] = { type: TEXT_DISPLAY, content: notice };
  }

  const result = visible();
  const componentCount = countComponents(result);
  const textLength = measureTextLength(result);

  return {
    components: result,
    dropped,
    componentCount,
    textLength,
    // false berarti pemanggil memang terlalu berat dan perlu dipecah ke halaman.
    withinBudget:
      componentCount <= maxComponents && textLength <= maxTextLength,
  };
}

module.exports = {
  MAX_COMPONENTS,
  MAX_TEXT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_FIELD_LENGTH,
  countComponents,
  measureTextLength,
  truncateText,
  enforceComponentBudget,
};
