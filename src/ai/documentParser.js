"use strict";

/**
 * @file documentParser.js
 * @description Engine parser dokumen dan konversi ke Markdown terstruktur (100% native Node.js).
 * Mendukung PDF, DOCX, PPTX, XLSX, CSV, ODT, TXT, dan Markdown siap RAG.
 */

const path = require("path");
const axios = require("axios");
const officeParser = require("officeparser");
const { logger } = require("../managers/logger");

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 Megabytes limit

const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "xls",
  "odt",
  "odp",
  "ods",
  "csv",
  "tsv",
  "txt",
  "md",
  "html",
]);

/**
 * Unduh lampiran URL secara aman ke buffer memori dengan batas kuota ukuran.
 * @param {string} url - URL berkas lampiran
 * @param {number} [maxBytes=MAX_ATTACHMENT_SIZE]
 * @returns {Promise<Buffer>}
 */
async function fetchAttachmentBuffer(url, maxBytes = MAX_ATTACHMENT_SIZE) {
  if (!url || typeof url !== "string") {
    throw new Error("URL berkas tidak valid");
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    maxContentLength: maxBytes,
    timeout: 15000,
  });

  const buffer = Buffer.from(response.data);
  if (buffer.length > maxBytes) {
    throw new Error(
      `Ukuran berkas (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimum 10 MB.`,
    );
  }

  return buffer;
}

/**
 * Memecah teks dokumen menjadi potongan-potongan semantik (semantic chunks) untuk RAG/Embedding.
 * @param {string} text - Teks lengkap dokumen
 * @param {object} [options]
 * @param {number} [options.maxChunkSize=800] - Ukuran karakter maksimal per potongan
 * @param {number} [options.chunkOverlap=100] - Jumlah karakter tumpang tindih antar potongan
 * @returns {string[]}
 */
function chunkText(text, options = {}) {
  if (!text || typeof text !== "string") return [];

  const maxChunkSize = options.maxChunkSize || 800;
  const chunkOverlap = options.chunkOverlap || 100;
  const clean = text.replace(/\r\n/g, "\n").trim();

  if (clean.length <= maxChunkSize) {
    return [clean];
  }

  const paragraphs = clean.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if (currentChunk.length + trimmedPara.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk.length ? "\n\n" : "") + trimmedPara;
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        // Pertahankan overlap dari akhir chunk sebelumnya
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + "\n\n" + trimmedPara;
      } else {
        // Satu paragraf melebihi maxChunkSize: pecah berdasarkan kalimat
        const sentences = trimmedPara.split(/(?<=[.?!])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= maxChunkSize) {
            currentChunk += (currentChunk.length ? " " : "") + sentence;
          } else {
            if (currentChunk.length) chunks.push(currentChunk);
            currentChunk = sentence;
          }
        }
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Ekstraksi baris spreadsheet (CSV / TSV) menjadi representasi data terstruktur.
 * @param {Buffer|string} input - Buffer file atau string CSV
 * @returns {Array<{ userId: string, amount: number, currency: string, reason: string, raw: object }>}
 */
function parseSpreadsheet(input) {
  const content = Buffer.isBuffer(input) ? input.toString("utf8") : String(input || "");
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) return [];

  // Parse header
  const header = lines[0].split(/[,;\t]/).map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

  // Petakan index kolom
  const userIdx = header.findIndex((h) => ["user_id", "userid", "discord_id", "id", "user", "target"].includes(h));
  const amountIdx = header.findIndex((h) => ["amount", "jumlah", "total", "nilai", "reward"].includes(h));
  const currencyIdx = header.findIndex((h) => ["currency", "mata_uang", "uang", "tipe"].includes(h));
  const reasonIdx = header.findIndex((h) => ["reason", "alasan", "note", "catatan", "keterangan"].includes(h));

  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map((c) => c.replace(/^["']|["']$/g, "").trim());
    if (cols.length === 0 || !cols.some(Boolean)) continue;

    const raw = {};
    header.forEach((h, idx) => {
      raw[h] = cols[idx] || "";
    });

    const userId = userIdx !== -1 ? cols[userIdx] : cols[0];
    const amountNum = amountIdx !== -1 ? parseInt(cols[amountIdx].replace(/[^0-9-]/g, ""), 10) : parseInt(cols[1], 10);
    const currency = currencyIdx !== -1 ? cols[currencyIdx].toLowerCase() : "starfragments";
    const reason = reasonIdx !== -1 ? cols[reasonIdx] : (cols[3] || "Hadiah Event");

    if (userId && !isNaN(amountNum) && amountNum > 0) {
      results.push({
        userId: userId.replace(/[^0-9]/g, ""), // Bersihkan karakter mention <@123>
        amount: amountNum,
        currency,
        reason,
        raw,
      });
    }
  }

  return results;
}

/**
 * Parser utama: mengonversi berkas dokumen menjadi teks dan Markdown terstruktur.
 * @param {Buffer|string} fileInput - Buffer berkas atau path string
 * @param {object} [options]
 * @param {string} [options.fileName="document"] - Nama berkas
 * @param {string} [options.fileType] - Ekstensi / tipe berkas (misal: "pdf", "docx")
 * @returns {Promise<{ success: boolean, fileName: string, fileType: string, text: string, markdown: string, chunks: string[], metadata: object }>}
 */
async function parseDocument(fileInput, options = {}) {
  let buffer;
  const fileName = options.fileName || "document";
  let fileType = options.fileType ? options.fileType.toLowerCase().replace(/^\./, "") : "";

  if (!fileType && fileName) {
    const ext = path.extname(fileName).toLowerCase().replace(/^\./, "");
    if (ext) fileType = ext;
  }

  if (Buffer.isBuffer(fileInput)) {
    buffer = fileInput;
  } else if (typeof fileInput === "string") {
    if (fileInput.startsWith("http://") || fileInput.startsWith("https://")) {
      buffer = await fetchAttachmentBuffer(fileInput);
    } else {
      const fs = require("fs");
      buffer = fs.readFileSync(fileInput);
      if (!fileType) {
        fileType = path.extname(fileInput).toLowerCase().replace(/^\./, "");
      }
    }
  } else {
    throw new Error("Format input tidak valid. Berikan Buffer, URL, atau path berkas.");
  }

  if (!fileType) {
    fileType = "txt";
  }

  if (!SUPPORTED_EXTENSIONS.has(fileType)) {
    throw new Error(
      `Tipe berkas '.${fileType}' tidak didukung. Tipe yang didukung: ${Array.from(SUPPORTED_EXTENSIONS).join(", ")}.`,
    );
  }

  try {
    let markdown = "";
    let text = "";
    let metadata = {};

    // Penanganan teks murni & Markdown sederhana
    if (fileType === "txt" || fileType === "md") {
      text = buffer.toString("utf8").trim();
      markdown = text;
    } else {
      // Penanganan dokumen terstruktur via officeparser
      const parsed = await officeParser.parseOffice(buffer, {
        fileType,
        ocr: false, // Matikan OCR berat saat parsing berkas dokumen teks
      });

      text = parsed.toText ? parsed.toText() : "";
      if (parsed.to) {
        const mdRes = await parsed.to("markdown");
        markdown = (mdRes && mdRes.value) ? mdRes.value : text;
      } else {
        markdown = text;
      }
      metadata = parsed.metadata || {};
    }

    const chunks = chunkText(markdown);

    return {
      success: true,
      fileName,
      fileType,
      text,
      markdown,
      chunks,
      metadata,
    };
  } catch (err) {
    logger.error(`[DocumentParser] Gagal memproses berkas ${fileName}: ${err.message}`, err);
    throw new Error(`Gagal membaca berkas ${fileName}: ${err.message}`);
  }
}

module.exports = {
  fetchAttachmentBuffer,
  parseDocument,
  chunkText,
  parseSpreadsheet,
  SUPPORTED_EXTENSIONS,
};
