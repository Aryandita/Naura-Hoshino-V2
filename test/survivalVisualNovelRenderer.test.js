"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const visualNovelRenderer = require("../src/survival/engines/visualNovelRenderer");

test("VisualNovelRenderer - renderScene() builds valid Components V2 payload with array dialog", async () => {
  const sceneData = {
    title: "Chapter 1: Awal Mula",
    speakerName: "Ningsih",
    dialog: [
      { speaker: "Ningsih", text: "Selamat pagi! Cuaca hari ini cerah sekali ya." },
      { speaker: "Player", text: "Iya, cocok untuk bertani." },
    ],
    choices: [
      { label: "Bantu Ningsih menyiram tanaman", customId: "vn_choice_0" },
      { label: "Pamit pergi ke pasar", customId: "vn_choice_1" },
    ],
  };

  const payload = await visualNovelRenderer.renderScene(sceneData);
  assert.ok(payload, "Payload renderScene tidak boleh null");
  assert.ok(payload.components, "Payload harus memiliki komponen UI Discord");
  assert.ok(Array.isArray(payload.components), "Komponen harus berupa array");
  assert.ok(payload.components.length > 0, "Harus ada minimal 1 row komponen");
});

test("VisualNovelRenderer - renderScene() supports single text string dialog", async () => {
  const sceneData = {
    title: "Pemberitahuan",
    speakerName: "Narrator",
    dialogText: "Suara kicau burung terdengar di kejauhan menyambut fajar.",
    choices: [],
  };

  const payload = await visualNovelRenderer.renderScene(sceneData);
  assert.ok(payload);
  assert.ok(Array.isArray(payload.components));
});
