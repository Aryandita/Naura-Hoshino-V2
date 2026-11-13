"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const draft = require("../data/storyDrafts/prologueSliceOfLife");
const renderer = require("./visualNovelRenderer");

test("semua adegan dan pilihan saling terhubung dan dapat mencapai akhir", () => {
  const seen = new Set();
  const todo = [draft.startScene];
  while (todo.length) {
    const id = todo.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const scene = draft.scenes[id];
    assert.ok(scene, `Adegan ${id} tidak ditemukan`);
    assert.ok(scene.text && scene.speaker);
    assert.ok((scene.choices || []).length <= 4);
    if (scene.nextScene) todo.push(scene.nextScene);
    for (const choice of scene.choices || []) { assert.ok(choice.label.length <= 80); todo.push(choice.nextScene); }
    assert.ok(scene.nextScene || scene.choices?.length || scene.end, `Adegan ${id} terhenti`);
  }
  assert.deepEqual([...seen].sort(), Object.keys(draft.scenes).sort());
  assert.ok(seen.has("finish"));
});

test("setiap adegan menghasilkan payload Components V2 yang dapat diserialisasi", async () => {
  for (const [id, scene] of Object.entries(draft.scenes)) {
    const choices = scene.choices || (scene.nextScene ? [{ label: "Lanjut" }] : [{ label: "Selesai" }]);
    const payload = await renderer.renderScene({ title: "Prolog · Hari Pertama", speakerName: scene.speaker, dialogText: scene.text, characterId: scene.character, characterEmotion: scene.emotion, backgroundId: scene.background, choices });
    assert.ok(payload.components?.length, id);
    assert.ok(JSON.stringify(payload.components).includes(scene.text), id);
  }
});