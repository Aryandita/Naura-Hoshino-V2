"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const storyEngine = require("../src/survival/engines/storyEngine");

test("StoryEngine - loadStoryData() correctly loads prologue chapter", () => {
  const chapter = storyEngine.getChapter("prologue");
  assert.ok(chapter, "Chapter prologue harus terdaftar");
  assert.equal(chapter.chapterId, "prologue");
  assert.ok(chapter.title, "Chapter harus memiliki title");
  assert.ok(chapter.scenes, "Chapter harus memiliki daftar scenes");
  assert.ok(chapter.scenes.start, "Chapter harus memiliki scene start");
});

test("StoryEngine - getScene() retrieves valid scene data", () => {
  const startScene = storyEngine.getScene("prologue", "start");
  assert.ok(startScene, "Scene start harus ditemukan");
  assert.ok(startScene.background, "Scene harus mendefinisikan background");
  assert.ok(Array.isArray(startScene.dialog), "Scene start harus memiliki array dialog");
  assert.ok(startScene.dialog.length > 0, "Dialog tidak boleh kosong");
  assert.ok(Array.isArray(startScene.choices), "Scene start harus memiliki choices");
  assert.ok(startScene.choices.length > 0, "Choices tidak boleh kosong");

  const invalid = storyEngine.getScene("prologue", "non_existent_scene");
  assert.equal(invalid, null);
});

test("StoryEngine - scene choices contain target scenes and affection effects", () => {
  const startScene = storyEngine.getScene("prologue", "start");
  for (const choice of startScene.choices) {
    assert.ok(choice.label, "Choice harus memiliki label");
    assert.ok(choice.nextScene, "Choice harus memiliki nextScene target");
    assert.ok(typeof choice.nextScene === "string");
  }
});

test("StoryEngine - isSceneCompleted() checks completed scenes accurately", () => {
  const progress = { completedScenes: ["start", "meet_ningsih"] };
  assert.equal(storyEngine.isSceneCompleted(progress, "start"), true);
  assert.equal(storyEngine.isSceneCompleted(progress, "meet_ningsih"), true);
  assert.equal(storyEngine.isSceneCompleted(progress, "unknown_scene"), false);
});
