"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  chunkText,
  parseSpreadsheet,
  parseDocument,
  SUPPORTED_EXTENSIONS,
} = require("./documentParser");

test("documentParser: exports supported extensions set", () => {
  assert.ok(SUPPORTED_EXTENSIONS.has("pdf"));
  assert.ok(SUPPORTED_EXTENSIONS.has("docx"));
  assert.ok(SUPPORTED_EXTENSIONS.has("xlsx"));
});

test("documentParser: chunkText handles small texts and large texts with overlap", () => {
  const shortText = "Ini adalah dokumen pendek untuk pengujian.";
  const shortChunks = chunkText(shortText, { maxChunkSize: 500 });
  assert.equal(shortChunks.length, 1);
  assert.equal(shortChunks[0], shortText);

  // Buat teks panjang 3 paragraf
  const para1 = "Paragraf pertama memuat penjelasan mengenai tata tertib server. ".repeat(10);
  const para2 = "Paragraf kedua menjelaskan sanksi bagi pelanggar aturan komunitas. ".repeat(10);
  const para3 = "Paragraf ketiga menjelaskan prosedur pengajuan banding ke AI Tribunal. ".repeat(10);
  const longText = `${para1}\n\n${para2}\n\n${para3}`;

  const longChunks = chunkText(longText, { maxChunkSize: 400, chunkOverlap: 50 });
  assert.ok(longChunks.length > 1, "Teks panjang harus dipecah menjadi beberapa chunk");
  for (const chunk of longChunks) {
    assert.ok(chunk.length > 0, "Setiap chunk tidak boleh kosong");
  }
});

test("documentParser: parseSpreadsheet correctly extracts tabular rewards data", () => {
  const csvData =
    "Discord_ID,Jumlah,Mata_Uang,Catatan\n" +
    "1122334455,1000,starFragments,Hadiah Juara 1 Turnamen\n" +
    "<@9988776655>,500,coins,Hadiah Juara 2 Turnamen\n";

  const rows = parseSpreadsheet(csvData);
  assert.equal(rows.length, 2);

  assert.equal(rows[0].userId, "1122334455");
  assert.equal(rows[0].amount, 1000);
  assert.equal(rows[0].currency, "starfragments");
  assert.equal(rows[0].reason, "Hadiah Juara 1 Turnamen");

  assert.equal(rows[1].userId, "9988776655");
  assert.equal(rows[1].amount, 500);
  assert.equal(rows[1].currency, "coins");
  assert.equal(rows[1].reason, "Hadiah Juara 2 Turnamen");
});

test("documentParser: parseDocument processes markdown and text buffers", async () => {
  const mdBuffer = Buffer.from(
    "# Panduan Komunitas\n\nSelamat datang di server Naura Hoshino V2.\n\n## Aturan Utama\n1. Hormati sesama anggota.\n2. Dilarang spam.",
  );

  const res = await parseDocument(mdBuffer, {
    fileName: "aturan.md",
    fileType: "md",
  });

  assert.equal(res.success, true);
  assert.equal(res.fileName, "aturan.md");
  assert.equal(res.fileType, "md");
  assert.ok(res.text.includes("Panduan Komunitas"));
  assert.ok(res.markdown.includes("Panduan Komunitas"));
  assert.ok(Array.isArray(res.chunks));
  assert.ok(res.chunks.length >= 1);
});

test("documentParser: parseDocument processes CSV buffer via officeparser", async () => {
  const csvBuffer = Buffer.from("Nama,Role,Level\nNaura,Mascot,100\nBagas,Pandai Besi,50");

  const res = await parseDocument(csvBuffer, {
    fileName: "roster.csv",
    fileType: "csv",
  });

  assert.equal(res.success, true);
  assert.equal(res.fileType, "csv");
  assert.ok(res.markdown.includes("Naura"));
  assert.ok(res.markdown.includes("Bagas"));
});

test("documentParser: rejects unsupported extensions gracefully", async () => {
  await assert.rejects(
    async () => {
      await parseDocument(Buffer.from("dummy"), {
        fileName: "malicious.exe",
        fileType: "exe",
      });
    },
    /tidak didukung/i,
  );
});
