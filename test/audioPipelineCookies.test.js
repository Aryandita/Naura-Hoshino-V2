"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const env = require("../src/config/env");
const { lavalinkClusterManager } = require("../src/managers/lavalinkClusterManager");
const { MusicManager } = require("../src/managers/musicManager");
const {
  resolveCookiePath,
  buildYtdlpArgs,
  tryYtdlp,
  _setYtDlpInstanceForTesting,
} = require("../src/downloader/downloaderYtdlp");

test("CHALLENGE 1: getYoutubeCookieConfig with valid default cookies.txt", () => {
  const orig = env.YOUTUBE_COOKIE_PATH;
  try {
    env.YOUTUBE_COOKIE_PATH = "cookies.txt";
    const config = lavalinkClusterManager.getYoutubeCookieConfig();

    assert.ok(config, "Config harus berupa objek valid");
    assert.equal(config.exists, true, "cookies.txt harus terdeteksi ada");
    assert.ok(typeof config.path === "string", "Path harus berupa string");
    assert.ok(path.isAbsolute(config.path), "Path harus berupa path absolut");
    assert.equal(config.filename, "cookies.txt", "Filename harus cookies.txt");
    assert.ok(fs.existsSync(config.path), "Path berkas harus benar-benar ada di disk");
    assert.ok(fs.statSync(config.path).isFile(), "Path berkas harus berupa berkas reguler");
  } finally {
    env.YOUTUBE_COOKIE_PATH = orig;
  }
});

test("CHALLENGE 2: getYoutubeCookieConfig with non-existent cookie file path", () => {
  const orig = env.YOUTUBE_COOKIE_PATH;
  try {
    env.YOUTUBE_COOKIE_PATH = "non_existent_cookies_adversarial_99999.txt";
    const config = lavalinkClusterManager.getYoutubeCookieConfig();

    assert.ok(config, "Config harus berupa objek");
    assert.equal(config.exists, false, "exists harus false untuk berkas fiktif");
    assert.equal(config.path, null, "path harus null saat berkas tidak ditemukan");
    assert.equal(config.filename, null, "filename harus null saat berkas tidak ditemukan");
  } finally {
    env.YOUTUBE_COOKIE_PATH = orig;
  }
});

test("CHALLENGE 3: getYoutubeCookieConfig with custom YOUTUBE_COOKIE_PATH (relative and absolute)", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "naura_cookie_test_"));
  const tempCookieFile = path.join(tempDir, "custom_secret_cookies.txt");
  fs.writeFileSync(tempCookieFile, "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t2147483647\tTEST_KEY\tTEST_VAL\n");

  const orig = env.YOUTUBE_COOKIE_PATH;
  try {
    // 3A: Absolute path
    env.YOUTUBE_COOKIE_PATH = tempCookieFile;
    const configAbs = lavalinkClusterManager.getYoutubeCookieConfig();

    assert.equal(configAbs.exists, true, "Harus mendeteksi berkas kustom via path absolut");
    assert.equal(configAbs.path, tempCookieFile, "Path harus sesuai dengan berkas kustom");
    assert.equal(configAbs.filename, "custom_secret_cookies.txt", "Filename harus sesuai nama berkas kustom");

    // 3B: Relative path within workspace
    const workspaceRelPath = "test_custom_workspace_cookie.txt";
    const absWorkspacePath = path.resolve(process.cwd(), workspaceRelPath);
    fs.writeFileSync(absWorkspacePath, "# Netscape Cookie\n");

    try {
      env.YOUTUBE_COOKIE_PATH = workspaceRelPath;
      const configRel = lavalinkClusterManager.getYoutubeCookieConfig();

      assert.equal(configRel.exists, true, "Harus mendeteksi berkas kustom via path relatif");
      assert.equal(configRel.path, absWorkspacePath, "Path harus ter-resolve ke root workspace");
      assert.equal(configRel.filename, workspaceRelPath, "Filename harus sesuai nama berkas relatif");
    } finally {
      if (fs.existsSync(absWorkspacePath)) {
        fs.unlinkSync(absWorkspacePath);
      }
    }
  } finally {
    env.YOUTUBE_COOKIE_PATH = orig;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
});

test("CHALLENGE 4: getYoutubeCookieConfig with directory path instead of file", () => {
  const orig = env.YOUTUBE_COOKIE_PATH;
  try {
    // Point to an existing directory
    env.YOUTUBE_COOKIE_PATH = "src/managers";
    const config = lavalinkClusterManager.getYoutubeCookieConfig();

    assert.ok(config, "Config harus dikembalikan");
    assert.equal(config.exists, false, "Direktori tidak boleh dianggap sebagai berkas cookie valid");
    assert.equal(config.path, null, "path harus null bila target adalah direktori");
    assert.equal(config.filename, null, "filename harus null bila target adalah direktori");
  } finally {
    env.YOUTUBE_COOKIE_PATH = orig;
  }
});

test("CHALLENGE 5: getYoutubeCookieConfig with invalid/corrupt path (exception handling)", () => {
  const orig = env.YOUTUBE_COOKIE_PATH;
  try {
    // Null-byte causes path/fs calls to throw on some platforms
    env.YOUTUBE_COOKIE_PATH = "\0illegal_byte_path.txt";
    const config = lavalinkClusterManager.getYoutubeCookieConfig();

    assert.ok(config, "getYoutubeCookieConfig tidak boleh crash jika filesystem throw");
    assert.equal(config.exists, false);
    assert.equal(config.path, null);
    assert.equal(config.filename, null);
  } finally {
    env.YOUTUBE_COOKIE_PATH = orig;
  }
});

test("CHALLENGE 6: getYoutubeCookieConfig with empty string falls back to default cookies.txt", () => {
  const orig = env.YOUTUBE_COOKIE_PATH;
  try {
    env.YOUTUBE_COOKIE_PATH = "";
    const config = lavalinkClusterManager.getYoutubeCookieConfig();

    assert.ok(config);
    assert.equal(config.exists, true, "Fallback harus mengarah ke cookies.txt yang ada");
    assert.equal(config.filename, "cookies.txt");
  } finally {
    env.YOUTUBE_COOKIE_PATH = orig;
  }
});

test("CHALLENGE 7: musicManager.youtubeCookieConfig getter reacts dynamically to cluster state", () => {
  const musicManager = new MusicManager({});
  const orig = env.YOUTUBE_COOKIE_PATH;

  try {
    // 1. Default
    env.YOUTUBE_COOKIE_PATH = "cookies.txt";
    assert.equal(musicManager.youtubeCookieConfig.exists, true);
    assert.equal(musicManager.youtubeCookieConfig.filename, "cookies.txt");

    // 2. Change to invalid
    env.YOUTUBE_COOKIE_PATH = "missing_path_dynamic_test.txt";
    assert.equal(musicManager.youtubeCookieConfig.exists, false);
    assert.equal(musicManager.youtubeCookieConfig.path, null);
  } finally {
    env.YOUTUBE_COOKIE_PATH = orig;
  }
});

test("CHALLENGE 8: musicManager.buildNodes attaches .cookieConfig to 100% of nodes", () => {
  const musicManager = new MusicManager({});
  const origCookie = env.YOUTUBE_COOKIE_PATH;

  try {
    env.YOUTUBE_COOKIE_PATH = "cookies.txt";
    const nodes = musicManager.buildNodes();

    assert.ok(Array.isArray(nodes), "Nodes harus berupa array");
    assert.ok(nodes.length >= 1, "Harus menghasilkan minimal 1 node");

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      assert.ok(node.cookieConfig, `Node ke-${i} (${node.name}) wajib memiliki properti cookieConfig`);
      assert.equal(
        node.cookieConfig.exists,
        true,
        `Node ke-${i} cookieConfig.exists harus true saat cookies.txt aktif`,
      );
      assert.equal(
        node.cookieConfig.filename,
        "cookies.txt",
        `Node ke-${i} cookieConfig.filename harus cookies.txt`,
      );
      assert.ok(
        typeof node.cookieConfig.path === "string" && path.isAbsolute(node.cookieConfig.path),
        `Node ke-${i} cookieConfig.path harus berupa path absolut`,
      );
    }
  } finally {
    env.YOUTUBE_COOKIE_PATH = origCookie;
  }
});

test("CHALLENGE 9: musicManager.buildNodes propagates missing cookie status to all nodes", () => {
  const musicManager = new MusicManager({});
  const origCookie = env.YOUTUBE_COOKIE_PATH;

  try {
    env.YOUTUBE_COOKIE_PATH = "completely_missing_cookie.txt";
    const nodes = musicManager.buildNodes();

    assert.ok(Array.isArray(nodes) && nodes.length > 0);
    for (const node of nodes) {
      assert.ok(node.cookieConfig, `Node ${node.name} harus tetap memiliki objek cookieConfig`);
      assert.equal(node.cookieConfig.exists, false, `Node ${node.name} exists harus false`);
      assert.equal(node.cookieConfig.path, null, `Node ${node.name} path harus null`);
      assert.equal(node.cookieConfig.filename, null, `Node ${node.name} filename harus null`);
    }
  } finally {
    env.YOUTUBE_COOKIE_PATH = origCookie;
  }
});

test("CHALLENGE 10: musicManager.buildNodes attaches cookieConfig across all node parsing strategies", () => {
  const musicManager = new MusicManager({});
  const origLavaNodes = env.LAVA_NODES;

  try {
    // Strategy A: JSON Array
    env.LAVA_NODES = JSON.stringify([
      { name: "JsonNode1", host: "10.0.0.1", port: 2333, password: "p1", secure: false },
      { name: "JsonNode2", host: "10.0.0.2", port: 2333, password: "p2", secure: true },
    ]);
    const jsonNodes = musicManager.buildNodes();
    assert.ok(jsonNodes.some((n) => n.name === "JsonNode1"));
    for (const n of jsonNodes) {
      assert.ok(n.cookieConfig, `Strategy JSON: Node ${n.name} harus memiliki cookieConfig`);
    }

    // Strategy B: Comma-Separated
    env.LAVA_NODES = "CsvNode1@10.0.0.3:2333:p3:false,CsvNode2@10.0.0.4:2333:p4:true";
    const csvNodes = musicManager.buildNodes();
    assert.ok(csvNodes.some((n) => n.name === "CsvNode1"));
    for (const n of csvNodes) {
      assert.ok(n.cookieConfig, `Strategy CSV: Node ${n.name} harus memiliki cookieConfig`);
    }

    // Strategy C: Empty / Fallback pool
    env.LAVA_NODES = "";
    const fallbackNodes = musicManager.buildNodes();
    assert.ok(fallbackNodes.length > 0);
    for (const n of fallbackNodes) {
      assert.ok(n.cookieConfig, `Strategy Fallback: Node ${n.name} harus memiliki cookieConfig`);
    }
  } finally {
    env.LAVA_NODES = origLavaNodes;
  }
});

test("CHALLENGE 11: Security Audit - Zero credential or cookie token leakage in logs and stdout/stderr", async () => {
  const secretKey = "HSID_SECRET_AUTH_TOKEN_9988776655";
  const secretVal = "SAPISID_SECRET_VAL_ABCDEFGHIJKLMNO";

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "naura_leak_test_"));
  const tempCookieFile = path.join(tempDir, "audit_cookies.txt");
  fs.writeFileSync(
    tempCookieFile,
    `# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t2147483647\t${secretKey}\t${secretVal}\n`,
  );

  const capturedOutput = [];
  const capture = (str) => {
    if (typeof str === "string") capturedOutput.push(str);
  };

  // Intercept console and stdout/stderr
  const origLog = console.log;
  const origInfo = console.info;
  const origWarn = console.warn;
  const origError = console.error;
  const origStdout = process.stdout.write;
  const origStderr = process.stderr.write;

  process.stdout.write = (chunk, ...rest) => {
    capture(String(chunk));
    return origStdout.call(process.stdout, chunk, ...rest);
  };
  process.stderr.write = (chunk, ...rest) => {
    capture(String(chunk));
    return origStderr.call(process.stderr, chunk, ...rest);
  };

  console.log = (...args) => {
    capture(args.map(String).join(" "));
    origLog.apply(console, args);
  };
  console.info = (...args) => {
    capture(args.map(String).join(" "));
    origInfo.apply(console, args);
  };
  console.warn = (...args) => {
    capture(args.map(String).join(" "));
    origWarn.apply(console, args);
  };
  console.error = (...args) => {
    capture(args.map(String).join(" "));
    origError.apply(console, args);
  };

  const origEnvCookie = env.YOUTUBE_COOKIE_PATH;

  try {
    env.YOUTUBE_COOKIE_PATH = tempCookieFile;

    // 1. Audio cluster cookie retrieval
    const cookieConfig = lavalinkClusterManager.getYoutubeCookieConfig();
    assert.equal(cookieConfig.exists, true);

    // 2. Music manager build nodes
    const musicManager = new MusicManager({});
    const nodes = musicManager.buildNodes();
    assert.ok(nodes.length > 0);

    // 3. Downloader resolve and args
    const resolved = resolveCookiePath();
    assert.equal(resolved, tempCookieFile);

    const args = buildYtdlpArgs("https://www.youtube.com/watch?v=leak_test", "out.mp4", resolved);
    assert.ok(args.includes("--cookies"));

    // 4. TryYtdlp with mock execution
    let executedArgs = null;
    _setYtDlpInstanceForTesting({
      execPromise: (passedArgs) => {
        executedArgs = passedArgs;
        return Promise.resolve();
      },
    });

    await tryYtdlp("https://www.youtube.com/watch?v=leak_test");
    assert.ok(executedArgs);

    // Inspect all captured log output
    const combinedLogs = capturedOutput.join("\n");
    assert.equal(
      combinedLogs.includes(secretKey),
      false,
      "CRITICAL SECURITY: Secret cookie key must never appear in console/logs!",
    );
    assert.equal(
      combinedLogs.includes(secretVal),
      false,
      "CRITICAL SECURITY: Secret cookie value must never appear in console/logs!",
    );
  } finally {
    console.log = origLog;
    console.info = origInfo;
    console.warn = origWarn;
    console.error = origError;
    process.stdout.write = origStdout;
    process.stderr.write = origStderr;
    _setYtDlpInstanceForTesting(null);
    env.YOUTUBE_COOKIE_PATH = origEnvCookie;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
});
