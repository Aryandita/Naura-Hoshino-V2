"use strict";

// Jalankan hanya pada checkout uji sekali pakai atau harness staging terisolasi,
// bukan memutasi data atau konfigurasi produksi.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

async function executeRemoteStagingSmokeWithDb({
  sequelize,
  DataTypes,
  runtimeEnv = process.env,
  verifyDbFn,
  log = console.log,
  errorLog = console.error,
} = {}) {
  if (!runtimeEnv || runtimeEnv.STORY_REMOTE_STAGING_TEST !== "true") {
    throw new Error(
      "Mode --staging-remote membutuhkan STORY_REMOTE_STAGING_TEST=true secara eksplisit.",
    );
  }
  if (!sequelize || typeof sequelize.authenticate !== "function") {
    throw new Error("executeRemoteStagingSmokeWithDb membutuhkan instance Sequelize.");
  }

  const {
    DEFAULT_STAGING_SUPABASE_PROJECT_ID,
    assertPrologueStagingSafety,
    verifyPrologueStagingDatabase,
  } = require("../src/config/prologueStagingIsolation");
  const {
    createStoryIsolatedStore,
  } = require("../src/survival/engines/storyIsolatedStore");
  const chapter = require("../src/survival/data/storyDrafts/prologueSliceOfLife");

  const expectedProjectId = String(
    runtimeEnv.STORY_STAGING_PROJECT_ID || DEFAULT_STAGING_SUPABASE_PROJECT_ID,
  )
    .trim()
    .toLowerCase();
  if (expectedProjectId !== DEFAULT_STAGING_SUPABASE_PROJECT_ID) {
    throw new Error(
      `Harness --staging-remote dikunci ke proyek staging ${DEFAULT_STAGING_SUPABASE_PROJECT_ID}, menolak '${expectedProjectId}'.`,
    );
  }

  const safetyEnv = {
    ...runtimeEnv,
    PROLOGUE_STAGING_MODE: "true",
    STORY_STAGING_PROJECT_ID: DEFAULT_STAGING_SUPABASE_PROJECT_ID,
  };
  const safety = assertPrologueStagingSafety(safetyEnv, {
    requireGuildId: false,
  });
  if (safety.loopback) {
    throw new Error(
      "Harness --staging-remote khusus untuk endpoint PostgreSQL staging remote, bukan host lokal.",
    );
  }

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const smokeTable = `slice_of_life_progress_v1_smoke_${suffix}`;
  const SmokeModel = sequelize.define(
    `SliceOfLifeProgressSmoke_${suffix}`,
    {
      userId: { type: DataTypes.STRING(25), primaryKey: true, allowNull: false },
      scene: { type: DataTypes.STRING(100), allowNull: false },
      completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      choices: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: smokeTable, timestamps: false },
  );

  let tableAttempted = false;
  let primaryError = null;
  let cleanupError = null;
  let cleanupVerified = false;

  try {
    const verifyDatabase = verifyDbFn || verifyPrologueStagingDatabase;
    await sequelize.authenticate();
    await verifyDatabase(sequelize, safetyEnv, {
      requireGuildId: false,
    });
    tableAttempted = true;
    await sequelize.query(
      `CREATE TABLE "${smokeTable}" ("userId" VARCHAR(25) PRIMARY KEY, "scene" VARCHAR(100) NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT FALSE, "choices" JSON NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0)`,
    );
    await sequelize.query(`ALTER TABLE "${smokeTable}" ENABLE ROW LEVEL SECURITY`);
    await sequelize.query(`REVOKE ALL ON TABLE "${smokeTable}" FROM PUBLIC`);

    const store = createStoryIsolatedStore(SmokeModel);
    const smokeUser = "staging-smoke-user";
    const initial = await store.read(smokeUser);
    assert.equal(initial.ok, true);
    assert.equal(initial.progress.scene, chapter.startScene);

    const firstStep = await store.transition(smokeUser, chapter.startScene, 0);
    assert.equal(firstStep.ok, true);
    assert.equal(firstStep.progress.revision, 1);

    const staleStep = await store.transition(smokeUser, chapter.startScene, 0);
    assert.equal(staleStep.ok, false);
    assert.equal(staleStep.reason, "stale");
  } catch (err) {
    primaryError = err;
  } finally {
    if (tableAttempted) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS "public"."${smokeTable}"`);
        const [rows] = await sequelize.query(
          "SELECT to_regclass(:qualifiedName) AS reg",
          { replacements: { qualifiedName: `public.${smokeTable}` } },
        );
        const reg = rows?.[0]?.reg ?? null;
        if (reg !== null) {
          throw new Error(
            `Tabel sintetis '${smokeTable}' masih ada menurut to_regclass (${reg}) setelah DROP TABLE.`,
          );
        }
        cleanupVerified = true;
      } catch (err) {
        cleanupError = err;
        errorLog(
          `[STAGING SMOKE CLEANUP ERROR] Gagal menghapus/memverifikasi tabel sintetis ${smokeTable}: ${cleanupError?.message || cleanupError}`,
        );
      }
    }
    try {
      if (typeof sequelize.close === "function") {
        await sequelize.close();
      }
    } catch (closeErr) {
      errorLog(
        `[STAGING SMOKE WARN] Gagal menutup koneksi database: ${closeErr?.message || closeErr}`,
      );
    }
  }

  if (primaryError && cleanupError) {
    throw new Error(
      `Smoke test gagal (${primaryError.message}) DAN cleanup tabel sintetis '${smokeTable}' gagal (${cleanupError.message}).`,
    );
  }
  if (primaryError) {
    throw primaryError;
  }
  if (cleanupError) {
    throw new Error(
      `Smoke test selesai tetapi pembersihan tabel sintetis '${smokeTable}' gagal: ${cleanupError.message}`,
    );
  }
  if (!cleanupVerified) {
    throw new Error(
      `Pembersihan tabel sintetis '${smokeTable}' tidak terverifikasi.`,
    );
  }

  log(
    `[STAGING SMOKE] Lulus pada proyek ${safety.projectId} (tabel uji ${smokeTable} telah dihapus dan diverifikasi bersih).`,
  );
  return {
    ok: true,
    projectId: safety.projectId,
    smokeTable,
    cleanupVerified: true,
  };
}

async function runRemoteStagingSmoke() {
  if (process.env.STORY_REMOTE_STAGING_TEST !== "true") {
    throw new Error(
      "Mode --staging-remote membutuhkan STORY_REMOTE_STAGING_TEST=true secara eksplisit.",
    );
  }
  const { DataTypes } = require("sequelize");
  const { sequelize } = require("../src/managers/dbManager");
  return executeRemoteStagingSmokeWithDb({
    sequelize,
    DataTypes,
    runtimeEnv: process.env,
  });
}

if (require.main === module) {
  if (process.argv.includes("--staging-remote")) {
    runRemoteStagingSmoke().catch((error) => {
      console.error(`[STAGING SMOKE ERROR] ${error?.message || error}`);
      process.exitCode = 1;
    });
  } else {
    const expected = process.argv[2];
    if (!/^[a-f0-9]{40}$/.test(expected || "")) throw new Error("Argumen harus berupa SHA-1 commit lengkap");
    const markerPath = path.join(root, ".naura-story-test-checkout.json");
    if (!fs.existsSync(markerPath)) throw new Error("Penanda checkout uji tidak ditemukan");
    const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
    if (marker.purpose !== "disposable-story-test" || marker.commit !== expected) throw new Error("Penanda checkout tidak cocok");
    for (const name of [".env", ".env ALPHA", ".env.local", ".env.production"]) {
      if (fs.existsSync(path.join(root, name))) throw new Error("Konfigurasi environment tidak boleh ada pada checkout uji");
    }
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    if (head !== expected) throw new Error("HEAD checkout uji berbeda dari commit yang diminta");
    const changed = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root, encoding: "utf8" });
    if (changed.trim()) throw new Error("Checkout uji memiliki perubahan tracked");
    const files = [
      "src/survival/helpers/storyDisplayName.test.js",
      "src/survival/engines/prologueDraft.test.js",
      "src/survival/engines/visualNovelAssets.test.js",
      "src/survival/engines/sliceOfLifeSession.test.js",
      "src/survival/engines/sliceOfLifeProgress.test.js",
      "src/survival/engines/storyIsolatedStore.test.js",
      "src/survival/engines/storyProgressCompatibility.test.js",
      "src/utils/interactionPipeline.test.js",
    ];
    for (const file of files) {
      execFileSync("git", ["cat-file", "-e", `HEAD:${file}`], { cwd: root, stdio: "ignore" });
    }
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "naura-story-test-"));
    const env = { PATH: process.env.PATH || "", NODE_ENV: "test", USE_SQLITE: "true", TZ: "UTC" };
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    if (process.env.TEMP) env.TEMP = process.env.TEMP;
    if (process.env.TMP) env.TMP = process.env.TMP;
    console.log(`Prolog test commit=${head}; temporary directory=${tempDir}`);
    const result = spawnSync(process.execPath, ["--test", "--test-timeout=30000", "--test-concurrency=1", ...files.map((file) => path.join(root, file))], { cwd: tempDir, env, stdio: "inherit" });
    if (result.error) throw result.error;
    process.exitCode = result.status === null ? 1 : result.status;
  }
}

module.exports = {
  executeRemoteStagingSmokeWithDb,
  runRemoteStagingSmoke,
};