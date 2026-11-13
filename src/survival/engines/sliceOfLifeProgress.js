"use strict";

const chapter = require("../data/storyDrafts/prologueSliceOfLife");
const KEY = "sliceOfLifePrologueV1";

/** Jalur terpisah agar data chapter dan pilihan lama tetap utuh. */
function createSliceOfLifeProgress(cache) {
  if (!cache || typeof cache.mutateUserSurvivalJson !== "function") throw new Error("Cache mutator tidak tersedia");

  async function transition(userId, expectedScene, choiceIndex) {
    if (typeof userId !== "string" || !userId || typeof expectedScene !== "string" || !Object.hasOwn(chapter.scenes, expectedScene)) {
      return { ok: false, reason: "invalid" };
    }
    const current = chapter.scenes[expectedScene];
    let destination;
    if (current.choices?.length) {
      if (!Number.isSafeInteger(choiceIndex) || !current.choices[choiceIndex]) return { ok: false, reason: "invalid_choice" };
      destination = current.choices[choiceIndex].nextScene;
    } else {
      if (choiceIndex !== 0) return { ok: false, reason: "invalid_choice" };
      destination = current.nextScene;
    }
    if (!current.end && (!destination || !Object.hasOwn(chapter.scenes, destination))) return { ok: false, reason: "invalid_destination" };
    let stale = false;
    const outcome = await cache.mutateUserSurvivalJson(userId, "storyProgress", (raw) => {
      let progress = raw;
      if (typeof progress === "string") {
        try { progress = JSON.parse(progress); } catch { return null; }
      }
      if (!progress || typeof progress !== "object" || Array.isArray(progress)) return null;
      const old = progress[KEY];
      if (old != null && (typeof old !== "object" || Array.isArray(old) || typeof old.scene !== "string" || typeof old.completed !== "boolean")) return null;
      const previous = old || { scene: chapter.startScene, completed: false, choices: {} };
      if (previous.completed || previous.scene !== expectedScene) { stale = true; return null; }
      if (!previous.choices || typeof previous.choices !== "object" || Array.isArray(previous.choices)) return null;
      const choices = { ...previous.choices };
      if (current.choices?.length) choices[expectedScene] = choiceIndex;
      return { ...progress, [KEY]: { scene: current.end ? expectedScene : destination, completed: Boolean(current.end), choices } };
    });
    if (!outcome || !outcome.ok) return { ok: false, reason: stale && outcome?.reason === "aborted" ? "stale" : "unconfirmed" };
    return { ok: true, progress: outcome.value[KEY] };
  }

  return { transition };
}

module.exports = { createSliceOfLifeProgress, KEY };