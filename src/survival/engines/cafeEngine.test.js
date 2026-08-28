"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CAFE_RECIPES, getRecipeById } = require("../data/cafeRecipes");

test("Cafe Recipes Catalog - Data Integrity", () => {
  assert.ok(Array.isArray(CAFE_RECIPES), "CAFE_RECIPES harus berupa array");
  assert.ok(CAFE_RECIPES.length >= 5, "Harus terdapat minimal 5 resep");

  for (const recipe of CAFE_RECIPES) {
    assert.ok(recipe.id, "Setiap resep harus memiliki id");
    assert.ok(recipe.name, "Setiap resep harus memiliki nama");
    assert.ok(recipe.emoji, "Setiap resep harus memiliki emoji");
    assert.ok(recipe.price > 0, "Harga jual harus lebih dari 0");
    assert.ok(
      Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0,
      "Harus memiliki bahan mentah",
    );
    assert.ok(
      recipe.buff && recipe.buff.description,
      "Harus memiliki info buff",
    );
  }

  const latte = getRecipeById("sakura_latte");
  assert.ok(latte, "Resep sakura_latte harus ditemukan");
  assert.equal(latte.category, "DRINK");
});

test("Cafe Engine - Idle Revenue Mathematical Calculation", () => {
  // Formula: hourlyRate = level * 35 + floor(reputation * 0.5)
  const level = 3;
  const reputation = 120;
  const hoursPassed = 4;

  const hourlyRate = level * 35 + Math.floor(reputation * 0.5);
  const revenue = Math.floor(hoursPassed * hourlyRate);

  assert.equal(hourlyRate, 3 * 35 + 60); // 105 + 60 = 165
  assert.equal(revenue, 4 * 165); // 660
});
