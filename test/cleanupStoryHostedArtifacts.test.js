"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  isProtectedName,
  auditLoaderHooks,
  scanStoryHostedArtifacts,
  applyStoryHostedCleanup,
} = require("../scripts/cleanup-story-hosted-artifacts");

function makeSandbox() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "naura-cleanup-unit-"));
  const rootDir = path.join(base, "root");
  const tmpDir = path.join(base, "tmp");
  fs.mkdirSync(rootDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  return { base, rootDir, tmpDir };
}

test("isProtectedName melindungi file sensitif dan direktori inti", () => {
  assert.equal(isProtectedName(".env"), true);
  assert.equal(isProtectedName(".env.production"), true);
  assert.equal(isProtectedName(".env ALPHA"), true);
  assert.equal(isProtectedName(".loader_backup"), true);
  assert.equal(isProtectedName("supabase-ca.pem"), true);
  assert.equal(isProtectedName("naura_fallback.sqlite"), true);
  assert.equal(isProtectedName("story-tls-check-2b9055bf.cjs"), false);
});

test("cleanup default dry-run tidak menghapus dan apply menghapus artefak whitelist sambil menjaga .env", () => {
  const { base, rootDir, tmpDir } = makeSandbox();
  try {
    // File produksi yang wajib bertahan
    fs.writeFileSync(path.join(rootDir, ".env"), "SECRET=1\n");
    fs.writeFileSync(path.join(rootDir, ".env ALPHA"), "SECRET=2\n");
    fs.mkdirSync(path.join(rootDir, ".loader_backup"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, "loader.js"),
      [
        "// pemicu story-tls-check-2b9055bf sekali jalan",
        "const branch = 'codex/gemini-staging-checks';",
        "const markerFile = '.story-gemini-attempt-731f723';",
        "const logName = 'story-gemini-result-731f723.log';",
        "console.log(branch, markerFile, logName);",
      ].join("\n") + "\n",
    );

    // Artefak uji sekali pakai (termasuk snapshot gemini 731f723)
    const runner = path.join(rootDir, "story-tls-check-2b9055bf.cjs");
    const logFile = path.join(rootDir, "story-tls-result-2b9055bf-a.log");
    const geminiLogFile = path.join(rootDir, "story-gemini-result-731f723.log");
    const marker = path.join(rootDir, ".story-tls-attempt-2b9055bf-1");
    const markerOld = path.join(rootDir, ".story-test-attempt-ac584238-v3");
    const geminiMarker = path.join(rootDir, ".story-gemini-attempt-731f723");
    fs.writeFileSync(runner, "console.log('test');");
    fs.writeFileSync(logFile, "PASS");
    fs.writeFileSync(geminiLogFile, "PASS");
    fs.writeFileSync(marker, "done");
    fs.writeFileSync(markerOld, "done");
    fs.writeFileSync(geminiMarker, "done");

    // Temp checkout bersih & temp checkout yang punya .env (harus dilewati!)
    const disposableTmp = path.join(tmpDir, "naura-story-test-abc123");
    fs.mkdirSync(disposableTmp, { recursive: true });
    fs.writeFileSync(path.join(disposableTmp, "README.md"), "tmp");

    const protectedTmp = path.join(tmpDir, "naura-story-test-keep");
    fs.mkdirSync(protectedTmp, { recursive: true });
    fs.writeFileSync(path.join(protectedTmp, ".env"), "DO_NOT_DELETE=1");

    const audit = auditLoaderHooks(rootDir);
    assert.equal(audit.clean, false);
    assert.ok(audit.findings.some((f) => f.signature === "tls_runner_ref"));
    assert.ok(audit.findings.some((f) => f.signature === "gemini_attempt_marker"));
    assert.ok(audit.findings.some((f) => f.signature === "gemini_result_log"));
    assert.ok(audit.findings.some((f) => f.signature === "hosted_test_branch"));

    const dry = applyStoryHostedCleanup({ apply: false, rootDir, tmpDir });
    assert.equal(dry.mode, "dry-run");
    assert.equal(dry.candidateCount, 7);
    assert.equal(dry.deleted.length, 0);
    assert.equal(fs.existsSync(runner), true);
    assert.equal(fs.existsSync(geminiMarker), true);
    assert.equal(fs.existsSync(geminiLogFile), true);
    assert.equal(fs.existsSync(disposableTmp), true);

    const applied = applyStoryHostedCleanup({ apply: true, rootDir, tmpDir });
    assert.equal(applied.mode, "apply");
    assert.equal(applied.deleted.length, 7);
    assert.equal(applied.errors.length, 0);

    // Artefak sementara bersih
    assert.equal(fs.existsSync(runner), false);
    assert.equal(fs.existsSync(logFile), false);
    assert.equal(fs.existsSync(geminiLogFile), false);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.existsSync(markerOld), false);
    assert.equal(fs.existsSync(geminiMarker), false);
    assert.equal(fs.existsSync(disposableTmp), false);

    // Data/config terlindungi tetap utuh
    assert.equal(fs.existsSync(path.join(rootDir, ".env")), true);
    assert.equal(fs.existsSync(path.join(rootDir, ".env ALPHA")), true);
    assert.equal(fs.existsSync(path.join(rootDir, ".loader_backup")), true);
    assert.equal(fs.existsSync(path.join(rootDir, "loader.js")), true);
    assert.equal(fs.existsSync(protectedTmp), true);

    const after = scanStoryHostedArtifacts({ rootDir, tmpDir });
    assert.equal(after.runners.length, 0);
    assert.equal(after.logs.length, 0);
    assert.equal(after.markers.length, 0);
    assert.equal(after.tempCheckouts.length, 0);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
