"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const supabaseManager = require("./supabaseManager");

test("SupabaseManager - Instance & Functions", () => {
  assert.ok(supabaseManager, "supabaseManager harus terdefinisi");
  assert.equal(typeof supabaseManager.initSupabase, "function");
  assert.equal(typeof supabaseManager.getSupabaseClient, "function");
  assert.equal(typeof supabaseManager.isSupabaseAvailable, "function");
});

test("SupabaseManager - Client Initialization & Availability", () => {
  const client = supabaseManager.getSupabaseClient();
  const available = supabaseManager.isSupabaseAvailable();
  assert.ok(available, "Supabase client harus siap/tersedia dengan default config");
  assert.ok(client, "Instance Supabase client harus terbentuk");
  assert.ok(client.from, "Supabase client harus memiliki method from()");
  assert.ok(client.auth, "Supabase client harus memiliki namespace auth");
});
