"use strict";

const { DataTypes } = require("sequelize");
const chapter = require("../data/storyDrafts/prologueSliceOfLife");

// Model prototipe terpisah; tidak didaftarkan ke runtime atau dimigrasikan otomatis.
function defineStoryIsolatedModel(sequelize) {
  return sequelize.define("SliceOfLifeProgressV1", {
    userId: { type: DataTypes.STRING(25), primaryKey: true, allowNull: false },
    scene: { type: DataTypes.STRING(100), allowNull: false },
    completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    choices: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { tableName: "slice_of_life_progress_v1", timestamps: false });
}

function createStoryIsolatedStore(Model) {
  async function read(userId) {
    if (typeof userId !== "string" || !userId || userId.length > 25) return { ok: false, reason: "invalid" };
    try {
      const row = await Model.findByPk(userId);
      if (!row) return { ok: true, progress: { scene: chapter.startScene, completed: false, choices: {}, revision: 0 } };
      const value = row.get({ plain: true });
      if (!Object.hasOwn(chapter.scenes, value.scene) || typeof value.completed !== "boolean" || !value.choices || typeof value.choices !== "object" || Array.isArray(value.choices) || !Number.isSafeInteger(value.revision) || value.revision < 0) return { ok: false, reason: "invalid_state" };
      return { ok: true, progress: { scene: value.scene, completed: value.completed, choices: value.choices, revision: value.revision } };
    } catch (_error) {
      return { ok: false, reason: "unconfirmed" };
    }
  }
  async function transition(userId, expectedScene, selection) {
    if (typeof userId !== "string" || !userId || userId.length > 25 || !Object.hasOwn(chapter.scenes, expectedScene)) return { ok: false, reason: "invalid" };
    const scene = chapter.scenes[expectedScene];
    const hasChoices = Array.isArray(scene.choices) && scene.choices.length > 0;
    if (!Number.isSafeInteger(selection) || selection < 0 || (hasChoices ? !scene.choices[selection] : selection !== 0)) return { ok: false, reason: "invalid_choice" };
    const next = hasChoices ? scene.choices[selection].nextScene : scene.nextScene;
    if (!scene.end && (!next || !Object.hasOwn(chapter.scenes, next))) return { ok: false, reason: "invalid_destination" };
    try {
      let row = await Model.findByPk(userId);
      if (!row) {
        [row] = await Model.findOrCreate({ where: { userId }, defaults: { scene: chapter.startScene, completed: false, choices: {}, revision: 0 } });
      }
      const current = row.get({ plain: true });
      if (current.completed || current.scene !== expectedScene) return { ok: false, reason: "stale" };
      if (!current.choices || typeof current.choices !== "object" || Array.isArray(current.choices) || !Number.isSafeInteger(current.revision) || current.revision < 0) return { ok: false, reason: "invalid_state" };
      const choices = { ...current.choices };
      if (hasChoices) choices[expectedScene] = selection;
      const values = { scene: scene.end ? expectedScene : next, completed: Boolean(scene.end), choices, revision: current.revision + 1 };
      const [affected] = await Model.update(values, { where: { userId, scene: expectedScene, completed: false, revision: current.revision } });
      if (affected !== 1) return { ok: false, reason: "stale" };
      return { ok: true, progress: values };
    } catch (_error) {
      // Laporan gagal tidak membuktikan commit dibatalkan; baca kembali sebelum retry.
      return { ok: false, reason: "unconfirmed" };
    }
  }
  return { read, transition };
}

module.exports = { defineStoryIsolatedModel, createStoryIsolatedStore };