"use strict";

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");

const env = require("../../src/config/env");
const {
  resolveCookiePath,
  buildYtdlpArgs,
  tryYtdlp,
  _setYtDlpInstanceForTesting,
} = require("../../src/downloader/downloaderYtdlp");
const { lavalinkClusterManager } = require("../../src/managers/lavalinkClusterManager");
const { MusicManager } = require("../../src/managers/musicManager");

describe("Milestone M2 Empirical Adversarial Stress Suite: YouTube Cookies & Downloader", () => {
  const rootDir = process.cwd();
  const cookiesPath = path.resolve(rootDir, "cookies.txt");
  const messagePath = path.resolve(rootDir, "message.txt");
  const assetsCookieDir = path.resolve(rootDir, "assets", "cookies");
  const assetsCookieFile = path.resolve(assetsCookieDir, "youtube_cookies.txt");

  let originalEnvCookiePath;
  let tempSandboxDir;

  before(() => {
    originalEnvCookiePath = env.YOUTUBE_COOKIE_PATH;
    tempSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "naura_m2_cookie_test_"));
  });

  after(() => {
    env.YOUTUBE_COOKIE_PATH = originalEnvCookiePath;
    _setYtDlpInstanceForTesting(null);
    try {
      if (fs.existsSync(tempSandboxDir)) {
        fs.rmSync(tempSandboxDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore sandbox cleanup errors
    }
  });

  beforeEach(() => {
    env.YOUTUBE_COOKIE_PATH = originalEnvCookiePath;
    _setYtDlpInstanceForTesting(null);
  });

  // ==========================================================================
  // SECTION 1: resolveCookiePath() Stress & Edge Cases
  // ==========================================================================
  describe("1. resolveCookiePath() Stress & Fallback Behavior", () => {
    it("ADV-COOKIE-01: Default resolution finds existing cookies.txt at root", () => {
      const resolved = resolveCookiePath();
      assert.ok(resolved, "Must resolve a valid cookie path");
      assert.equal(resolved, cookiesPath, "Must resolve to cookies.txt at repository root");
      assert.ok(fs.existsSync(resolved), "Resolved path must exist");
      assert.ok(fs.statSync(resolved).isFile(), "Resolved path must be a regular file");
    });

    it("ADV-COOKIE-02: Fallback to message.txt when cookies.txt is temporarily missing", () => {
      const cookiesBak = path.resolve(rootDir, "cookies.txt.advbak");
      assert.ok(fs.existsSync(cookiesPath), "cookies.txt must exist before test");
      assert.ok(fs.existsSync(messagePath), "message.txt must exist before test");

      try {
        fs.renameSync(cookiesPath, cookiesBak);
        // Ensure env does not force non-existent cookies.txt
        env.YOUTUBE_COOKIE_PATH = "";

        const resolved = resolveCookiePath();
        assert.ok(resolved, "Must still resolve a fallback cookie file");
        assert.equal(resolved, messagePath, "Must fall back to message.txt when cookies.txt is missing");
      } finally {
        if (fs.existsSync(cookiesBak)) {
          fs.renameSync(cookiesBak, cookiesPath);
        }
      }
    });

    it("ADV-COOKIE-03: Fallback to assets/cookies/youtube_cookies.txt when root cookies are missing", () => {
      const cookiesBak = path.resolve(rootDir, "cookies.txt.advbak");
      const messageBak = path.resolve(rootDir, "message.txt.advbak");
      const assetsBak = path.resolve(rootDir, "assets_cookies.advbak");
      const hadAssetsCookie = fs.existsSync(assetsCookieFile);

      if (hadAssetsCookie) {
        fs.renameSync(assetsCookieFile, assetsBak);
      }
      if (!fs.existsSync(assetsCookieDir)) {
        fs.mkdirSync(assetsCookieDir, { recursive: true });
      }
      fs.writeFileSync(assetsCookieFile, "# Netscape HTTP Cookie File - Dummy", "utf-8");

      try {
        if (fs.existsSync(cookiesPath)) fs.renameSync(cookiesPath, cookiesBak);
        if (fs.existsSync(messagePath)) fs.renameSync(messagePath, messageBak);
        env.YOUTUBE_COOKIE_PATH = "";

        const resolved = resolveCookiePath();
        assert.ok(resolved, "Must resolve assets fallback cookie file");
        assert.equal(
          path.normalize(resolved),
          path.normalize(assetsCookieFile),
          "Must fall back to assets/cookies/youtube_cookies.txt",
        );
      } finally {
        if (fs.existsSync(assetsCookieFile)) fs.unlinkSync(assetsCookieFile);
        if (hadAssetsCookie && fs.existsSync(assetsBak)) {
          fs.renameSync(assetsBak, assetsCookieFile);
        }
        if (fs.existsSync(cookiesBak)) fs.renameSync(cookiesBak, cookiesPath);
        if (fs.existsSync(messageBak)) fs.renameSync(messageBak, messagePath);
      }
    });

    it("ADV-COOKIE-04: Gracefully returns null without throwing when ALL candidate files are missing", () => {
      const cookiesBak = path.resolve(rootDir, "cookies.txt.advbak");
      const messageBak = path.resolve(rootDir, "message.txt.advbak");

      try {
        fs.renameSync(cookiesPath, cookiesBak);
        fs.renameSync(messagePath, messageBak);
        env.YOUTUBE_COOKIE_PATH = "non_existent_custom_cookie_file.txt";

        const resolved = resolveCookiePath();
        assert.equal(resolved, null, "Must return null when all cookie candidate paths are missing");
      } finally {
        if (fs.existsSync(cookiesBak)) fs.renameSync(cookiesBak, cookiesPath);
        if (fs.existsSync(messageBak)) fs.renameSync(messageBak, messagePath);
      }
    });

    it("ADV-COOKIE-05: Resolves custom relative path specified in env.YOUTUBE_COOKIE_PATH", () => {
      const customRelPath = path.join("test", "dummy_custom_cookie.txt");
      const customAbsPath = path.resolve(rootDir, customRelPath);
      fs.writeFileSync(customAbsPath, "# Dummy custom cookie", "utf-8");

      try {
        env.YOUTUBE_COOKIE_PATH = customRelPath;
        const resolved = resolveCookiePath();
        assert.equal(
          path.normalize(resolved),
          path.normalize(customAbsPath),
          "Must resolve custom relative path to absolute file path",
        );
      } finally {
        if (fs.existsSync(customAbsPath)) fs.unlinkSync(customAbsPath);
      }
    });

    it("ADV-COOKIE-06: Resolves custom absolute path specified in env.YOUTUBE_COOKIE_PATH", () => {
      const customAbsPath = path.join(tempSandboxDir, "isolated_youtube_cookies.txt");
      fs.writeFileSync(customAbsPath, "# Isolated custom cookie", "utf-8");

      env.YOUTUBE_COOKIE_PATH = customAbsPath;
      const resolved = resolveCookiePath();
      assert.equal(
        path.normalize(resolved),
        path.normalize(customAbsPath),
        "Must resolve custom absolute path directly",
      );
    });

    it("ADV-COOKIE-07: When custom YOUTUBE_COOKIE_PATH does not exist, falls back to cookies.txt", () => {
      env.YOUTUBE_COOKIE_PATH = path.join(tempSandboxDir, "non_existent_cookie_9999.txt");
      assert.ok(!fs.existsSync(env.YOUTUBE_COOKIE_PATH), "Path must not exist");

      const resolved = resolveCookiePath();
      assert.equal(
        resolved,
        cookiesPath,
        "Must fall back to root cookies.txt when custom path is not found",
      );
    });

    it("ADV-COOKIE-08: Rejects directory paths even if path exists", () => {
      const dirAsCookiePath = path.join(tempSandboxDir, "directory_named_as_cookie.txt");
      fs.mkdirSync(dirAsCookiePath, { recursive: true });

      env.YOUTUBE_COOKIE_PATH = dirAsCookiePath;
      const resolved = resolveCookiePath();
      // Since candidate 1 is a directory, it must be rejected by isFile() and fall back to cookies.txt
      assert.equal(
        resolved,
        cookiesPath,
        "Must not accept a directory path and must fall back to cookies.txt",
      );
    });

    it("ADV-COOKIE-09: Handles empty string YOUTUBE_COOKIE_PATH gracefully", () => {
      env.YOUTUBE_COOKIE_PATH = "";
      const resolved = resolveCookiePath();
      assert.equal(resolved, cookiesPath, "Empty cookie path env must fall back to cookies.txt");
    });
  });

  // ==========================================================================
  // SECTION 2: buildYtdlpArgs() Argument Construction Stress & Injection Defense
  // ==========================================================================
  describe("2. buildYtdlpArgs() Parameter Construction & Injection Resilience", () => {
    it("ADV-ARGS-01: Correctly omits --cookies flag when cookiePath is null", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const tempOutput = "C:\\temp\\output.mp4";
      const args = buildYtdlpArgs(url, tempOutput, null);

      assert.equal(args.includes("--cookies"), false, "--cookies flag must NOT be present");
      assert.equal(args[0], url, "URL must be the first element");
      assert.equal(args[args.indexOf("-o") + 1], tempOutput, "Output path must follow -o flag");
    });

    it("ADV-ARGS-02: Correctly includes --cookies and exact path when cookiePath is provided", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const tempOutput = "C:\\temp\\output.mp4";
      const cookieFile = "C:\\secrets\\my_cookie.txt";
      const args = buildYtdlpArgs(url, tempOutput, cookieFile);

      assert.ok(args.includes("--cookies"), "--cookies flag must be present");
      const idx = args.indexOf("--cookies");
      assert.equal(args[idx + 1], cookieFile, "Path must immediately follow --cookies");
    });

    it("ADV-ARGS-03: Preserves cookie paths containing whitespace without quote corruption", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const tempOutput = "C:\\temp\\output.mp4";
      const spacedCookiePath = "C:\\Program Files\\My Bot\\cookies file.txt";
      const args = buildYtdlpArgs(url, tempOutput, spacedCookiePath);

      const idx = args.indexOf("--cookies");
      assert.equal(
        args[idx + 1],
        spacedCookiePath,
        "Argument array must preserve exact spaced string without extra escaping",
      );
    });

    it("ADV-ARGS-04: Preserves cookie paths containing Unicode and emoji characters", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const tempOutput = "C:\\temp\\output.mp4";
      const unicodeCookiePath = path.join(tempSandboxDir, "🍪_クッキー_cookies.txt");
      const args = buildYtdlpArgs(url, tempOutput, unicodeCookiePath);

      const idx = args.indexOf("--cookies");
      assert.equal(
        args[idx + 1],
        unicodeCookiePath,
        "Unicode and emoji in cookie path must remain intact in argv array",
      );
    });

    it("ADV-ARGS-05: Hostile URL containing shell injection characters is passed safely as a discrete element", () => {
      const maliciousUrl = 'https://www.youtube.com/watch?v=xyz&foo=1; rm -rf /; " && calc.exe';
      const tempOutput = "C:\\temp\\output.mp4";
      const args = buildYtdlpArgs(maliciousUrl, tempOutput, null);

      assert.equal(args[0], maliciousUrl, "Raw malicious URL must remain untouched as argv[0]");
      assert.ok(args.length >= 10, "Argument array must not split malicious URL into shell tokens");
    });

    it("ADV-ARGS-06: Automatically invokes resolveCookiePath() when 3rd argument is omitted", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const tempOutput = "C:\\temp\\output.mp4";
      const args = buildYtdlpArgs(url, tempOutput);

      assert.ok(args.includes("--cookies"), "Default call must include --cookies when cookies.txt exists");
      const idx = args.indexOf("--cookies");
      assert.equal(args[idx + 1], cookiesPath, "Default call must resolve to cookies.txt");
    });

    it("ADV-ARGS-07: Invariant verification of mandatory yt-dlp flags", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const tempOutput = "C:\\temp\\output.mp4";
      const args = buildYtdlpArgs(url, tempOutput, null);

      const expectedFlags = [
        "-f",
        "b[ext=mp4]/best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
        "--merge-output-format",
        "mp4",
        "-o",
        tempOutput,
        "--no-playlist",
        "--no-warnings",
        "--max-filesize",
        "500M",
        "--socket-timeout",
        "15",
      ];

      for (let i = 0; i < expectedFlags.length; i++) {
        assert.ok(args.includes(expectedFlags[i]), `Missing expected flag or argument: ${expectedFlags[i]}`);
      }
    });
  });

  // ==========================================================================
  // SECTION 3: tryYtdlp() Pipeline Execution Stress & Resilience
  // ==========================================================================
  describe("3. tryYtdlp() Execution Flow & Mocked Driver Scenarios", () => {
    it("ADV-EXEC-01: Dispatches --cookies to ytdlp instance when cookies are present", async () => {
      let dispatchedArgs = null;
      _setYtDlpInstanceForTesting({
        execPromise: (args) => {
          dispatchedArgs = args;
          return Promise.resolve();
        },
      });

      const testUrl = "https://www.youtube.com/watch?v=adv_test_with_cookies";
      await tryYtdlp(testUrl);

      assert.ok(dispatchedArgs, "execPromise must be called");
      assert.ok(dispatchedArgs.includes("--cookies"), "dispatched args must contain --cookies");
      const idx = dispatchedArgs.indexOf("--cookies");
      assert.equal(dispatchedArgs[idx + 1], cookiesPath, "cookies path must be cookies.txt");
    });

    it("ADV-EXEC-02: Omits --cookies in dispatched args when cookie resolution is forced to null", async () => {
      let dispatchedArgs = null;
      _setYtDlpInstanceForTesting({
        execPromise: (args) => {
          dispatchedArgs = args;
          return Promise.resolve();
        },
      });

      const cookiesBak = path.resolve(rootDir, "cookies.txt.advbak");
      const messageBak = path.resolve(rootDir, "message.txt.advbak");

      try {
        fs.renameSync(cookiesPath, cookiesBak);
        fs.renameSync(messagePath, messageBak);
        env.YOUTUBE_COOKIE_PATH = "none.txt";

        const testUrl = "https://www.youtube.com/watch?v=adv_test_no_cookies";
        await tryYtdlp(testUrl);

        assert.ok(dispatchedArgs, "execPromise must be called");
        assert.equal(
          dispatchedArgs.includes("--cookies"),
          false,
          "dispatched args must NOT contain --cookies when files are absent",
        );
      } finally {
        if (fs.existsSync(cookiesBak)) fs.renameSync(cookiesBak, cookiesPath);
        if (fs.existsSync(messageBak)) fs.renameSync(messageBak, messagePath);
      }
    });

    it("ADV-EXEC-03: Gracefully handles yt-dlp CLI crash or rejection without uncaught exception", async () => {
      _setYtDlpInstanceForTesting({
        execPromise: () => Promise.reject(new Error("yt-dlp: Signature extraction failed (403 Forbidden)")),
      });

      const testUrl = "https://www.youtube.com/watch?v=failing_url";
      const result = await tryYtdlp(testUrl);

      assert.equal(result, null, "tryYtdlp must return null when yt-dlp rejects");
    });

    it("ADV-EXEC-04: Returns stream descriptor and registers cleanup when file is produced", async () => {
      _setYtDlpInstanceForTesting({
        execPromise: (args) => {
          // Extract the expected file pattern from -o flag
          const oIdx = args.indexOf("-o");
          const templatePath = args[oIdx + 1];
          const actualPath = templatePath.replace("%(ext)s", "mp4");
          fs.writeFileSync(actualPath, "mock mp4 media binary data", "utf-8");
          return Promise.resolve();
        },
      });

      const trackedFiles = [];
      const mockCleanupManager = {
        trackAll: (files) => {
          trackedFiles.push(...files);
        },
      };

      const testUrl = "https://www.youtube.com/watch?v=success_video";
      const result = await tryYtdlp(testUrl, mockCleanupManager);

      try {
        assert.ok(result, "Result must not be null on successful file generation");
        assert.equal(result.status, "stream", "Status must be stream");
        assert.equal(result.isLocalFile, true, "isLocalFile must be true");
        assert.ok(fs.existsSync(result.url), "Output file must exist on disk");
        assert.ok(trackedFiles.includes(result.url), "Output file must be registered with cleanupManager");
      } finally {
        if (result && fs.existsSync(result.url)) {
          fs.unlinkSync(result.url);
        }
      }
    });
  });

  // ==========================================================================
  // SECTION 4: Audio Cluster & Music Manager Cookie Config Exposure
  // ==========================================================================
  describe("4. Audio Cluster & Music Manager Cookie Telemetry", () => {
    it("ADV-AUDIO-01: lavalinkClusterManager.getYoutubeCookieConfig() returns accurate state with cookies.txt", () => {
      const config = lavalinkClusterManager.getYoutubeCookieConfig();
      assert.ok(config, "Config must be returned");
      assert.equal(config.exists, true, "exists must be true when cookies.txt is present");
      assert.equal(config.path, cookiesPath, "path must match cookies.txt root path");
      assert.equal(config.filename, "cookies.txt", "filename must be cookies.txt");
    });

    it("ADV-AUDIO-02: Returns exists: false and null path when cookie path is pointed to non-existent file", () => {
      env.YOUTUBE_COOKIE_PATH = "non_existent_cookie_cluster_test.txt";
      const config = lavalinkClusterManager.getYoutubeCookieConfig();

      assert.equal(config.exists, false, "exists must be false");
      assert.equal(config.path, null, "path must be null");
      assert.equal(config.filename, null, "filename must be null");
    });

    it("ADV-AUDIO-03: Returns exists: false when cookie path points to a directory", () => {
      const dummyDir = path.join(tempSandboxDir, "audio_cluster_dir");
      fs.mkdirSync(dummyDir, { recursive: true });

      env.YOUTUBE_COOKIE_PATH = dummyDir;
      const config = lavalinkClusterManager.getYoutubeCookieConfig();

      assert.equal(config.exists, false, "exists must be false for directories");
      assert.equal(config.path, null, "path must be null for directories");
      assert.equal(config.filename, null, "filename must be null for directories");
    });

    it("ADV-AUDIO-04: musicManager.youtubeCookieConfig reflects cluster manager configuration", () => {
      const musicManager = new MusicManager({});
      const config = musicManager.youtubeCookieConfig;

      assert.ok(config, "musicManager.youtubeCookieConfig must be defined");
      assert.equal(config.exists, true);
      assert.equal(config.filename, "cookies.txt");
    });

    it("ADV-AUDIO-05: musicManager.buildNodes() propagates cookieConfig to all nodes", () => {
      const musicManager = new MusicManager({});
      const nodes = musicManager.buildNodes();

      assert.ok(Array.isArray(nodes) && nodes.length > 0, "Must return non-empty node array");
      for (const node of nodes) {
        assert.ok(node.cookieConfig, `Node ${node.name} must have cookieConfig attached`);
        assert.equal(node.cookieConfig.exists, true, `Node ${node.name} cookieConfig.exists must be true`);
        assert.equal(node.cookieConfig.filename, "cookies.txt");
      }
    });
  });

  // ==========================================================================
  // SECTION 5: Security, Gitignore & Zero Em-Dash Enforcement
  // ==========================================================================
  describe("5. Security, Git Status & Zero Em-Dash Compliance", () => {
    it("ADV-SEC-01: cookies.txt and message.txt are strictly ignored by git", () => {
      const statusOutput = execSync("git status --ignored --short cookies.txt message.txt", {
        encoding: "utf-8",
      });
      const lines = statusOutput.trim().split(/\r?\n/).map((l) => l.trim());

      assert.ok(
        lines.some((l) => l === "!! cookies.txt"),
        "cookies.txt must have !! ignored status in git",
      );
      assert.ok(
        lines.some((l) => l === "!! message.txt"),
        "message.txt must have !! ignored status in git",
      );
    });

    it("ADV-SEC-02: Zero em-dash enforcement passes across entire repository", () => {
      const checkScript = path.resolve(rootDir, "scripts", "check-em-dash.js");
      const output = execSync(`node "${checkScript}"`, { encoding: "utf-8" });
      assert.ok(
        output.includes("Bersih") || output.includes("Tidak ada em dash"),
        `check-em-dash.js must pass cleanly: ${output}`,
      );
    });
  });
});
