"use strict";

const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");
const { logger } = require("./logger");

let supabaseClient = null;
let isInitialized = false;

/**
 * Inisialisasi koneksi Supabase JS client
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
function initSupabase() {
  if (isInitialized) return supabaseClient;

  const url = env.SUPABASE_URL || "https://ceqkjzvrxyifxzgxtkig.supabase.co";
  const key =
    env.SUPABASE_KEY ||
    env.SUPABASE_ANON_KEY ||
    "sb_publishable_9gd0-5FflbVgYPCd7WGAwQ_dJLMxyRX";

  if (!url || !key) {
    logger.warn(
      "[SUPABASE] URL atau Key Supabase tidak ditemukan. SDK client berjalan dalam mode pasif.",
    );
    isInitialized = true;
    return null;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
    });

    isInitialized = true;
    logger.success(
      `[SUPABASE] Supabase JS Client aktif (${env.SUPABASE_PROJECT_ID || "ceqkjzvrxyifxzgxtkig"}).`,
    );
    return supabaseClient;
  } catch (error) {
    isInitialized = true;
    logger.error(
      "[SUPABASE] Gagal inisialisasi Supabase Client:",
      error.message,
    );
    return null;
  }
}

/**
 * Ambil instance Supabase client yang aktif
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
function getSupabaseClient() {
  if (!isInitialized) {
    initSupabase();
  }
  return supabaseClient;
}

/**
 * Cek apakah Supabase client aktif dan siap digunakan
 * @returns {boolean}
 */
function isSupabaseAvailable() {
  const client = getSupabaseClient();
  return Boolean(client);
}

module.exports = {
  initSupabase,
  getSupabaseClient,
  isSupabaseAvailable,
};
