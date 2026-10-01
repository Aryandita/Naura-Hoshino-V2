"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { analyze } = require("../../tools/inspect-3d-models");

// Latar belakang:
// dashboard/public/models/ dulu berisi 8 berkas GLB/VRM (134 MB). Analisis
// biner menunjukkan hanya 4 yang benar-benar layak ditampilkan, sisanya
// either duplikat persis atau model rusak tanpa rig.
//
// Berkas yang TIDAK layak tampil:
//   Naura Hoshino 3D.glb / naura_pbr.glb
//     hash 85a752421d98, identik satu sama lain. skin=0 bone=0 clip=0
//     morph=0. Hanya geometri diam, tidak ada rig, tidak ada animasi.
//     Inilah penyebab "animasi yang buruk": model ini tidak punya apa pun
//     untuk dianimasikan.
//   naura_animated.glb
//     Punya rig dan 8 clip, TAPI morph=0 sehingga ekspresi/mulut mati.
//
// Berkas yang layak tampil (skin=1 bone=20 clip=8 morph=6):
//   naura.vrm, naura NEW.vrm (VRM) dan naura.glb, naura NEW.glb (GLB)

const MODELS_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "public",
  "models",
);

function existingModels() {
  return fs
    .readdirSync(MODELS_DIR)
    .filter((f) => /\.(glb|vrm)$/i.test(f));
}

test("setiap model yang tersisa punya rig, animasi, dan morph target", () => {
  const files = existingModels();
  assert.ok(files.length > 0, "folder model tidak boleh kosong");

  for (const f of files) {
    const a = analyze(path.join(MODELS_DIR, f));
    assert.ok(a.skinCount > 0, `${f} tidak punya skin (rig)`);
    assert.ok(a.boneCount > 0, `${f} tidak punya bone`);
    assert.ok(a.skinnedMeshCount > 0, `${f} tidak punya skinned mesh`);
    assert.ok(a.animationCount > 0, `${f} tidak punya animasi`);
    assert.ok(
      a.morphTargetCount > 0,
      `${f} tidak punya morph target sehingga ekspresi tidak bergerak`,
    );
  }
});

test("model rusak tanpa rig tidak lagi dibundel", () => {
  // naura_pbr.glb pernah dipakai sebagai fallback di loader.js, padahal
  // isinya model diam tanpa rig. Menghapus berkas ini mencegah viewer
  // memilih model yang tidak bisa dianimasikan.
  for (const gone of ["naura_pbr.glb", "Naura Hoshino 3D.glb", "naura_animated.glb"]) {
    assert.ok(
      !fs.existsSync(path.join(MODELS_DIR, gone)),
      `${gone} seharusnya sudah dihapus karena tidak layak tampil`,
    );
  }
});

test("tidak ada duplikat bit-per-bit di folder model", () => {
  const crypto = require("node:crypto");
  const seen = new Map();

  for (const f of existingModels()) {
    const buf = fs.readFileSync(path.join(MODELS_DIR, f));
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    assert.ok(
      !seen.has(hash),
      `${f} identik dengan ${seen.get(hash)}, salah satunya bisa dihapus`,
    );
    seen.set(hash, f);
  }
});

test("loader.js tidak lagi menunjuk model yang tidak layak tampil", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "dashboard",
      "src",
      "components",
      "NauraViewer",
      "loader.js",
    ),
    "utf8",
  );
  assert.ok(
    !source.includes("naura_pbr.glb"),
    "loader.js tidak boleh memakai naura_pbr.glb karena model itu tanpa rig",
  );
});
