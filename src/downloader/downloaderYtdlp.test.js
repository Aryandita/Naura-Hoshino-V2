"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const env = require("../config/env");
const {
  resolveCookiePath,
  buildYtdlpArgs,
  tryYtdlp,
  _setYtDlpInstanceForTesting,
} = require("./downloaderYtdlp");
const { lavalinkClusterManager } = require("../managers/lavalinkClusterManager");
const { MusicManager } = require("../managers/musicManager");

test("Environment Configuration - YOUTUBE_COOKIE_PATH is configured", () => {
  assert.ok(env.YOUTUBE_COOKIE_PATH, "env.YOUTUBE_COOKIE_PATH harus terdefinisi");
  assert.equal(
    env.YOUTUBE_COOKIE_PATH,
    "cookies.txt",
    "Default YOUTUBE_COOKIE_PATH harus berupa cookies.txt",
  );
});

test("Cookie Resolution - resolveCookiePath resolves existing cookie file", () => {
  const resolved = resolveCookiePath();
  assert.ok(resolved, "resolveCookiePath harus menemukan berkas cookies");
  assert.ok(typeof resolved === "string", "Hasil harus berupa path string");
  assert.ok(fs.existsSync(resolved), "Berkas yang di-resolve harus ada di filesystem");
  assert.ok(fs.statSync(resolved).isFile(), "Berkas yang di-resolve harus berupa berkas reguler");

  const basename = path.basename(resolved);
  assert.ok(
    basename === "cookies.txt" || basename === "message.txt",
    `Nama berkas harus cookies.txt atau message.txt (ditemukan: ${basename})`,
  );
});

test("Downloader CLI Arguments - buildYtdlpArgs attaches --cookies when path provided", () => {
  const dummyUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const dummyOutput = path.join(process.cwd(), "temp_test.mp4");
  const dummyCookie = path.join(process.cwd(), "cookies.txt");

  const argsWithCookies = buildYtdlpArgs(dummyUrl, dummyOutput, dummyCookie);
  assert.ok(argsWithCookies.includes("--cookies"), "Argumen harus menyertakan flag --cookies");
  const cookieIndex = argsWithCookies.indexOf("--cookies");
  assert.equal(
    argsWithCookies[cookieIndex + 1],
    dummyCookie,
    "Flag --cookies harus diikuti oleh path berkas cookie",
  );
  assert.ok(argsWithCookies.includes(dummyUrl), "Argumen harus menyertakan URL target");
  assert.ok(argsWithCookies.includes("-f"), "Argumen harus menyertakan pemilih format");
});

test("Downloader CLI Arguments - buildYtdlpArgs excludes --cookies when cookiePath is null", () => {
  const dummyUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const dummyOutput = path.join(process.cwd(), "temp_test.mp4");

  const argsWithoutCookies = buildYtdlpArgs(dummyUrl, dummyOutput, null);
  assert.equal(
    argsWithoutCookies.includes("--cookies"),
    false,
    "Argumen tidak boleh menyertakan --cookies bila path null",
  );
  assert.ok(argsWithoutCookies.includes(dummyUrl), "Argumen tetap menyertakan URL target");
});

test("Downloader Pipeline - tryYtdlp executes with --cookies flag when cookie file exists", async () => {
  let capturedArgs = null;
  const mockYtdlpInstance = {
    execPromise: (args) => {
      capturedArgs = args;
      // Kembalikan promise yang tidak menghasilkan error tapi juga tidak menghasilkan berkas riil
      return Promise.resolve();
    },
  };

  _setYtDlpInstanceForTesting(mockYtdlpInstance);

  try {
    const testUrl = "https://www.youtube.com/watch?v=mock_video_test";
    await tryYtdlp(testUrl);

    assert.ok(capturedArgs, "execPromise harus dipanggil oleh tryYtdlp");
    assert.ok(
      capturedArgs.includes("--cookies"),
      "execPromise harus menerima argumen yang memiliki --cookies",
    );
    const cookieFlagIdx = capturedArgs.indexOf("--cookies");
    assert.ok(
      capturedArgs[cookieFlagIdx + 1],
      "Nilai flag --cookies harus berupa path yang valid",
    );
  } finally {
    _setYtDlpInstanceForTesting(null);
  }
});

test("Audio Pipeline - lavalinkClusterManager.getYoutubeCookieConfig returns valid active cookie status", () => {
  const config = lavalinkClusterManager.getYoutubeCookieConfig();

  assert.ok(config, "Config harus berupa objek");
  assert.equal(config.exists, true, "Config exists harus bernilai true");
  assert.ok(typeof config.path === "string", "Config path harus berupa path string");
  assert.ok(fs.existsSync(config.path), "Path di config harus benar-benar ada di filesystem");
  assert.equal(config.filename, "cookies.txt", "Filename harus cookies.txt");
});

test("Audio Pipeline - musicManager.youtubeCookieConfig exposes cluster manager config", () => {
  const musicManager = new MusicManager({});
  const config = musicManager.youtubeCookieConfig;

  assert.ok(config, "Config harus terdefinisi pada musicManager");
  assert.equal(config.exists, true, "Config exists harus bernilai true");
  assert.equal(config.filename, "cookies.txt", "Filename harus cookies.txt");
});

test("Audio Pipeline - musicManager.buildNodes attaches cookieConfig to all generated nodes", () => {
  const musicManager = new MusicManager({});
  const nodes = musicManager.buildNodes();

  assert.ok(Array.isArray(nodes), "buildNodes harus mengembalikan array");
  assert.ok(nodes.length > 0, "Daftar node tidak boleh kosong");

  for (const node of nodes) {
    assert.ok(node.cookieConfig, `Node ${node.name} harus memiliki cookieConfig`);
    assert.equal(node.cookieConfig.exists, true, `Node ${node.name} cookieConfig.exists harus true`);
    assert.equal(node.cookieConfig.filename, "cookies.txt", `Node ${node.name} cookieConfig.filename harus cookies.txt`);
  }
});
