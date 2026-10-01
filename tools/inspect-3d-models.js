"use strict";

/**
 * inspect-3d-models.js
 *
 * Membaca struktur biner GLB/VRM dan melaporkan secara objektif apakah sebuah
 * model layak ditampilkan: punya skinned mesh, bone, animation clip, dan morph
 * target untuk ekspresi. Nama file tidak cukup jadi patokan karena repo ini
 * punya beberapa salinan dengan nama berbeda.
 *
 * Format GLB: magic 'glTF' (0..3), lalu chunk JSON mulai byte 20.
 * VRM_addon_extension menandai file sebagai VRM (humanoid + ekspresi).
 *
 * Jalankan: node tools/inspect-3d-models.js
 */

const fs = require("node:fs");
const path = require("node:path");

const MODELS_DIR = path.join(__dirname, "..", "dashboard", "public", "models");

/** Baca chunk JSON dari berkas GLB/VRM. */
function readGltfJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 20) throw new Error("berkas terlalu kecil untuk GLB");

  const magic = buf.toString("ascii", 0, 4);
  if (magic !== "glTF") throw new Error(`magic bukan 'glTF' (dapat "${magic}")`);

  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength));

  return { version: buf.readUInt32LE(4), json };
}

/** Hitung statistik sebuah scene graph glTF. */
function analyze(file) {
  const { version, json } = readGltfJson(file);
  const nodes = json.nodes || [];
  const meshes = json.meshes || [];
  const skins = json.skins || [];
  const animations = json.animations || [];

  const morphTargetNames = new Set();
  let skinnedMeshCount = 0;
  let staticMeshCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  let primitiveCount = 0;

  for (const mesh of meshes) {
    for (const prim of mesh.primitives || []) {
      primitiveCount += 1;
      const pos = prim.attributes?.POSITION;
      if (pos !== undefined) {
        const count = json.accessors?.[pos]?.count || 0;
        vertexCount += count;
        if ((prim.mode ?? 4) === 4) triangleCount += Math.floor(count / 3);
      }
    }
    const names = mesh.extras?.targetNames;
    if (Array.isArray(names)) {
      for (const n of names) morphTargetNames.add(n);
    }
  }

  for (const node of nodes) {
    if (node.mesh === undefined) continue;
    const mesh = meshes[node.mesh];
    const skinned =
      node.skin !== undefined || (mesh?.primitives || []).some((p) => p.targets);
    if (skinned) skinnedMeshCount += 1;
    else staticMeshCount += 1;
  }

  const doubleSidedMaterials = (json.materials || []).filter(
    (m) => m.doubleSided === true,
  ).length;

  let maxDuration = 0;
  const clipNames = [];
  for (const anim of animations) {
    clipNames.push(anim.name || "(tanpa nama)");
    for (const sampler of anim.samplers || []) {
      const input = json.accessors?.[sampler.input];
      const dur = Number(input?.max?.[0]);
      if (Number.isFinite(dur) && dur > maxDuration) maxDuration = dur;
    }
  }

  return {
    version,
    nodes: nodes.length,
    boneCount: skins.reduce((acc, s) => acc + (s.joints?.length || 0), 0),
    skinCount: skins.length,
    skinnedMeshCount,
    staticMeshCount,
    vertexCount,
    triangleCount,
    primitiveCount,
    morphTargetCount: morphTargetNames.size,
    morphTargetNames: [...morphTargetNames],
    animationCount: animations.length,
    clipNames,
    maxDuration,
    doubleSidedMaterials,
    isVrm: Boolean(json.extensions?.VRM),
  };
}


/** Kriteria "layak tampil" untuk avatar karakter. */
function verdict(a) {
  const problems = [];
  if (a.skinCount === 0) problems.push("tidak ada skin (rig)");
  if (a.boneCount === 0) problems.push("tidak ada bone");
  if (a.skinnedMeshCount === 0) problems.push("tidak ada skinned mesh");
  if (a.animationCount === 0) problems.push("tidak ada animasi");
  if (a.triangleCount === 0) problems.push("tidak ada geometri");
  if (a.morphTargetCount === 0) {
    problems.push("tidak ada morph target, ekspresi tidak akan bergerak");
  }
  return { ok: problems.length === 0, problems };
}

function main() {
  const files = fs
    .readdirSync(MODELS_DIR)
    .filter((f) => /\.(glb|vrm)$/i.test(f))
    .sort();

  const results = [];
  for (const f of files) {
    const full = path.join(MODELS_DIR, f);
    const size = fs.statSync(full).size;
    try {
      const a = analyze(full);
      results.push({ file: f, size, ...a, ...verdict(a) });
    } catch (err) {
      results.push({
        file: f,
        size,
        error: err.message,
        ok: false,
        problems: [err.message],
      });
    }
  }

  for (const r of results) {
    console.log("=".repeat(70));
    console.log(`${r.file}  (${(r.size / 1048576).toFixed(1)} MB)`);
    if (r.error) {
      console.log(`  GAGAL DIBACA: ${r.error}`);
      continue;
    }
    console.log(`  format    : ${r.isVrm ? "VRM" : "GLB"} (glTF v${r.version})`);
    console.log(`  nodes     : ${r.nodes}`);
    console.log(`  skin/bone : ${r.skinCount} skin, ${r.boneCount} bone`);
    console.log(`  mesh      : ${r.skinnedMeshCount} skinned, ${r.staticMeshCount} static`);
    console.log(`  geometri  : ${r.vertexCount} vertex, ${r.triangleCount} tri, ${r.primitiveCount} primitif`);
    console.log(`  morph     : ${r.morphTargetCount}${r.morphTargetCount ? " -> " + r.morphTargetNames.join(", ") : ""}`);
    console.log(`  animasi   : ${r.animationCount} clip, durasi maks ${r.maxDuration.toFixed(2)}s`);
    if (r.clipNames.length) console.log(`  clip      : ${r.clipNames.join(", ")}`);
    console.log(`  doubleSide: ${r.doubleSidedMaterials} material`);
    console.log(
      `  VERDICT   : ${r.ok ? "LAYAK TAMPIL" : "TIDAK LAYAK -> " + r.problems.join("; ")}`,
    );
  }

  const good = results.filter((r) => r.ok);
  const bad = results.filter((r) => !r.ok);
  console.log("=".repeat(70));
  console.log(`\nLAYAK TAMPIL (${good.length}):`);
  for (const g of good) console.log(`  + ${g.file}`);
  console.log(`\nTIDAK LAYAK (${bad.length}):`);
  for (const b of bad) console.log(`  - ${b.file}  [${b.problems.join("; ")}]`);

  return { results, good, bad };
}

if (require.main === module) main();
module.exports = { analyze, verdict, readGltfJson, MODELS_DIR };

