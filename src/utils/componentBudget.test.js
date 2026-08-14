"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_COMPONENTS,
  countComponents,
  measureTextLength,
  truncateText,
  enforceComponentBudget,
} = require("./componentBudget");

const textDisplay = (content) => ({ type: 10, content });

test("countComponents ikut menghitung komponen bersarang dan accessory", () => {
  const components = [
    {
      type: 9,
      components: [textDisplay("header")],
      accessory: { type: 11, media: { url: "attachment://a.png" } },
    },
    {
      type: 12,
      items: [
        { media: { url: "attachment://b.png" } },
        { media: { url: "attachment://c.png" } },
      ],
    },
    textDisplay("body"),
  ];

  // section + isi section + accessory + gallery + 2 item + text = 7
  assert.equal(countComponents(components), 7);
});

test("measureTextLength menjumlahkan teks di semua kedalaman", () => {
  const components = [
    { type: 9, components: [textDisplay("12345")] },
    textDisplay("123"),
  ];

  assert.equal(measureTextLength(components), 8);
});

test("truncateText memotong dengan penanda dan tidak menyentuh teks pendek", () => {
  assert.equal(truncateText("halo", 10), "halo");
  assert.equal(truncateText("abcdefghij", 8), "abcde...");
  assert.equal(truncateText(undefined, 8), undefined);
});

test("payload yang sudah aman dibiarkan apa adanya", () => {
  const components = [textDisplay("judul"), textDisplay("isi")];
  const result = enforceComponentBudget(components, { droppableIndices: [1] });

  assert.equal(result.dropped, 0);
  assert.equal(result.components.length, 2);
  assert.equal(result.withinBudget, true);
});

test("field berlebih dibuang dan diganti catatan, tombol tetap utuh", () => {
  const header = textDisplay("header");
  const buttons = {
    type: 1,
    components: [{ type: 2, label: "Lanjut", custom_id: "next" }],
  };
  const fields = Array.from({ length: 45 }, (_, i) =>
    textDisplay(`field ${i}`),
  );

  const components = [header, ...fields, buttons];
  const droppableIndices = fields.map((_, i) => i + 1);

  const result = enforceComponentBudget(components, {
    droppableIndices,
    notice: "-# Sebagian isi dipotong.",
  });

  assert.ok(result.dropped > 0, "seharusnya ada field yang dibuang");
  assert.equal(result.withinBudget, true);
  assert.ok(countComponents(result.components) <= MAX_COMPONENTS);

  // Header wajib tetap di depan, tombol wajib tetap di belakang.
  assert.equal(result.components[0], header);
  assert.equal(result.components[result.components.length - 1], buttons);

  const hasNotice = result.components.some(
    (c) => c.type === 10 && c.content === "-# Sebagian isi dipotong.",
  );
  assert.ok(hasNotice, "catatan pemotongan harus ikut ditampilkan");
});

test("teks yang terlalu panjang juga memicu pemotongan", () => {
  const long = textDisplay("x".repeat(2500));
  const components = [
    textDisplay("header"),
    long,
    textDisplay("y".repeat(2500)),
  ];

  const result = enforceComponentBudget(components, {
    droppableIndices: [1, 2],
    notice: "-# dipotong",
  });

  assert.ok(result.dropped > 0);
  assert.equal(result.withinBudget, true);
});

test("tanpa indeks yang boleh dibuang, hasilnya dilaporkan melewati batas", () => {
  const components = Array.from({ length: 50 }, (_, i) => textDisplay(`c${i}`));
  const result = enforceComponentBudget(components);

  assert.equal(result.dropped, 0);
  assert.equal(result.withinBudget, false);
  assert.ok(result.componentCount > MAX_COMPONENTS);
});
