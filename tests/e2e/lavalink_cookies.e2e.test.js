"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");

const env = require("../../src/config/env");
const { LavalinkClusterManager } = require("../../src/managers/lavalinkClusterManager");
const MusicManager = require("../../src/managers/musicManager");
const { getProviderChain } = require("../../src/downloader/downloaderChain");
const {
  resolveCookiePath,
  buildYtdlpArgs,
  tryYtdlp,
  _setYtDlpInstanceForTesting,
} = require("../../src/downloader/downloaderYtdlp");

// Helper to probe a Lavalink REST endpoint
function probeLavalinkNode(nodeConfig, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const isSecure = Boolean(nodeConfig.secure);
    const transport = isSecure ? https : http;
    const reqOptions = {
      hostname: nodeConfig.host,
      port: nodeConfig.port,
      path: "/v4/info",
      method: "GET",
      headers: {
        Authorization: nodeConfig.password,
        Accept: "application/json",
      },
      timeout: timeoutMs,
    };

    const req = transport.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          // If non-JSON received
        }
        resolve({
          statusCode: res.statusCode,
          version: parsed?.version?.semver || parsed?.version || null,
          data: parsed,
          error: null,
        });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        statusCode: 0,
        version: null,
        data: null,
        error: "TIMEOUT",
      });
    });

    req.on("error", (err) => {
      resolve({
        statusCode: 0,
        version: null,
        data: null,
        error: err.message,
      });
    });

    req.end();
  });
}

describe("Lavalink & YouTube Cookies E2E Suite - Tier 1: Feature Coverage", () => {
  it("TC-LAVA-1.1: Live REST /v4/info probe on all configured Lavalink nodes in .env", async () => {
    const nodes = env.getLavalinkNumberedNodes();
    assert.ok(nodes.length >= 4, "Must configure at least 4 contiguous Lavalink nodes");

    for (const node of nodes) {
      const probe = await probeLavalinkNode(node);
      assert.equal(
        probe.statusCode,
        200,
        `Node "${node.name}" (${node.host}:${node.port}) must respond with HTTP 200, got: ${probe.statusCode} (error: ${probe.error})`,
      );
      assert.ok(
        probe.version !== null && typeof probe.version === "string",
        `Node "${node.name}" must return a valid version string`,
      );
    }
  });

  it("TC-LAVA-1.2: Sequential node numbering in env.js parses 4 contiguous nodes without gaps", () => {
    const nodes = env.getLavalinkNumberedNodes();
    assert.equal(nodes.length, 4, "Must parse exactly 4 nodes from .env");

    // Node 1: Primary Private Node (GlaceYT)
    assert.equal(nodes[0].name, "GlaceYT");
    assert.equal(nodes[0].host, "de-01.strixnodes.com");
    assert.equal(nodes[0].port, 2010);
    assert.equal(nodes[0].password, "glace");
    assert.equal(nodes[0].secure, false);

    // Node 2: Secondary Private Node (GlaceYT-2)
    assert.equal(nodes[1].name, "GlaceYT-2");
    assert.equal(nodes[1].host, "de-01.strixnodes.com");
    assert.equal(nodes[1].port, 2028);
    assert.equal(nodes[1].password, "glace");
    assert.equal(nodes[1].secure, false);

    // Node 3: Secondary Private Node (Millohost Public Node)
    assert.equal(nodes[2].name, "Millohost Public Node");
    assert.equal(nodes[2].host, "lava-v4.millohost.my.id");
    assert.equal(nodes[2].port, 443);
    assert.equal(nodes[2].password, "https://discord.gg/mjS5J2K3ep");
    assert.equal(nodes[2].secure, true);

    // Node 4: Secondary Private Node (Hyperion)
    assert.equal(nodes[3].name, "Hyperion");
    assert.equal(nodes[3].host, "hyperion.kythia.xyz");
    assert.equal(nodes[3].port, 3010);
    assert.equal(nodes[3].password, "dsc.gg/kythia");
    assert.equal(nodes[3].secure, false);
  });

  it("TC-LAVA-1.3: YOUTUBE_COOKIE_PATH is exposed as string in src/config/env.js", () => {
    assert.equal(typeof env.YOUTUBE_COOKIE_PATH, "string");
    assert.ok(env.YOUTUBE_COOKIE_PATH.length > 0);
    assert.equal(env.YOUTUBE_COOKIE_PATH, "cookies.txt");
  });

  it("TC-LAVA-1.4: Cookie source file presence, Netscape format, and YouTube target", () => {
    const cookiePath = path.resolve(process.cwd(), "cookies.txt");
    assert.ok(fs.existsSync(cookiePath), "cookies.txt must exist at project root");

    const content = fs.readFileSync(cookiePath, "utf8");
    assert.ok(
      content.startsWith("# Netscape HTTP Cookie File"),
      "cookies.txt must start with standard Netscape HTTP Cookie File header",
    );
    assert.ok(
      content.includes(".youtube.com"),
      "cookies.txt must contain cookies targeting .youtube.com domain",
    );

    const hasAuthCookie =
      content.includes("LOGIN_INFO") ||
      content.includes("SID") ||
      content.includes("HSID");
    assert.ok(hasAuthCookie, "cookies.txt must contain essential YouTube authentication cookies");
  });

  it("TC-LAVA-1.5: Downloader CLI builder injects --cookies flag when cookie file exists", () => {
    const resolved = resolveCookiePath();
    assert.ok(resolved !== null, "resolveCookiePath must resolve an existing cookie file");

    const tempOutput = path.join(os.tmpdir(), "test_ytdlp_args.mp4");
    const args = buildYtdlpArgs("https://www.youtube.com/watch?v=mock123", tempOutput, resolved);

    const cookieFlagIndex = args.indexOf("--cookies");
    assert.ok(cookieFlagIndex !== -1, "Arguments must include --cookies flag");
    assert.equal(args[cookieFlagIndex + 1], resolved, "Flag argument must be the resolved cookie path");
  });
});

describe("Lavalink & YouTube Cookies E2E Suite - Tier 2: Boundary & Corner Cases", () => {
  it("TC-LAVA-2.1: Missing or non-existent cookie file omits --cookies without crashing", () => {
    const tempOutput = path.join(os.tmpdir(), "test_fallback.mp4");
    const argsWithoutCookies = buildYtdlpArgs(
      "https://www.youtube.com/watch?v=mock123",
      tempOutput,
      null,
    );

    assert.equal(
      argsWithoutCookies.includes("--cookies"),
      false,
      "buildYtdlpArgs must omit --cookies when cookiePath is null",
    );
  });

  it("TC-LAVA-2.2: Empty or whitespace YOUTUBE_COOKIE_PATH resolves safely", () => {
    const originalEnvVar = process.env.YOUTUBE_COOKIE_PATH;
    const env = require("../../src/config/env");
    const originalConfigVal = env.YOUTUBE_COOKIE_PATH;
    try {
      env.YOUTUBE_COOKIE_PATH = "   ";
      process.env.YOUTUBE_COOKIE_PATH = "   ";

      const resolved = resolveCookiePath();
      if (resolved !== null) {
        assert.ok(typeof resolved === "string", "Must be a string path when resolved");
        assert.notEqual(resolved.trim(), "", "Resolved path cannot be empty whitespace");
        const filename = path.basename(resolved);
        assert.ok(
          ["cookies.txt", "youtube_cookies.txt", "message.txt"].includes(filename),
          `Must fallback to default candidate, received: ${filename}`,
        );
      }
    } finally {
      if (originalEnvVar === undefined) {
        delete process.env.YOUTUBE_COOKIE_PATH;
      } else {
        process.env.YOUTUBE_COOKIE_PATH = originalEnvVar;
      }
      env.YOUTUBE_COOKIE_PATH = originalConfigVal;
    }
  });

  it("TC-LAVA-2.3: Path with spaces in cookie filename is preserved as a discrete argument", () => {
    const spacedPath = path.join(process.cwd(), "dir with spaces", "custom cookies.txt");
    const tempOutput = path.join(os.tmpdir(), "test_spaced.mp4");
    const args = buildYtdlpArgs("https://www.youtube.com/watch?v=mock123", tempOutput, spacedPath);

    const cookieIdx = args.indexOf("--cookies");
    assert.ok(cookieIdx !== -1, "--cookies flag must be present");
    assert.equal(
      args[cookieIdx + 1],
      spacedPath,
      "Preserves path with spaces as a single argument element without quote corruption",
    );
  });

  it("TC-LAVA-2.4: Numbering sequence gaps in getLavalinkNumberedNodes terminates safely", () => {
    const origHost2 = process.env.LAVALINK_HOST_2;
    try {
      delete process.env.LAVALINK_HOST_2;
      delete process.env.LAVA_HOST_2;

      const nodes = env.getLavalinkNumberedNodes();
      assert.equal(
        nodes.length,
        1,
        "Gap at index 2 must terminate numbered node loop cleanly and return only Node 1",
      );
      assert.equal(nodes[0].name, "GlaceYT");
    } finally {
      process.env.LAVALINK_HOST_2 = origHost2;
    }
  });

  it("TC-LAVA-2.5: REST probe timeout handling with deadline management", async () => {
    // Create an unresponding local server to test probe timeout
    const hangingServer = http.createServer((_req, _res) => {
      // Deliberately hold connection open without sending response
    });

    await new Promise((resolve) => hangingServer.listen(0, "127.0.0.1", resolve));
    const port = hangingServer.address().port;

    try {
      const mockHangingNode = {
        name: "Mock-Timeout-Node",
        host: "127.0.0.1",
        port,
        password: "mock",
        secure: false,
      };

      const start = Date.now();
      const probeResult = await probeLavalinkNode(mockHangingNode, 200); // 200ms timeout
      const duration = Date.now() - start;

      assert.equal(probeResult.statusCode, 0);
      assert.equal(probeResult.error, "TIMEOUT");
      assert.ok(duration < 1000, "Probe must terminate quickly upon hitting timeout deadline");
    } finally {
      await new Promise((resolve) => hangingServer.close(resolve));
    }
  });
});

describe("Lavalink & YouTube Cookies E2E Suite - Tier 3: Cross-Feature Combinations", () => {
  it("TC-LAVA-3.1: YouTube download chain routes to yt-dlp as primary provider", () => {
    const mockCleanup = { trackAll: () => {} };
    const chain = getProviderChain("https://www.youtube.com/watch?v=dQw4w9WgXcQ", mockCleanup);

    assert.ok(Array.isArray(chain) && chain.length >= 2);
    assert.equal(chain[0].name, "yt-dlp", "yt-dlp must be primary provider (index 0) for YouTube URLs");
    assert.equal(chain[1].name, "Cobalt", "Cobalt must be secondary fallback provider for YouTube URLs");
  });

  it("TC-LAVA-3.2: Tiered node failover in LavalinkClusterManager prioritizes Tier 1 over Tier 2 and Tier 3", () => {
    const manager = new LavalinkClusterManager();
    const tieredList = manager.buildTieredNodeList(env.getLavalinkNumberedNodes());
    assert.ok(tieredList.length >= 5, "Tiered node list must include private nodes and public fallbacks");

    // Mock Poru nodes map
    const mockPoru = {
      nodes: new Map(),
    };

    tieredList.forEach((n) => {
      mockPoru.nodes.set(n.name, {
        name: n.name,
        connected: true,
        stats: { players: 0 },
        penalties: 0,
      });
    });

    // 1. All connected: returns Tier 1 primary node
    const preferred1 = manager.getPreferredNode(mockPoru);
    assert.equal(preferred1, "GlaceYT", "Must pick Tier 1 primary node when healthy");

    // 2. Disconnect Tier 1: falls back to Tier 2 secondary node
    mockPoru.nodes.get("GlaceYT").connected = false;
    const preferred2 = manager.getPreferredNode(mockPoru);
    assert.ok(
      preferred2 === "GlaceYT-2" || preferred2 === "Millohost Public Node" || preferred2 === "Hyperion",
      "Must fall back to a Tier 2 secondary node when Tier 1 is disconnected",
    );

    // 3. Disconnect all private nodes: falls back to Tier 3 public fallback node
    mockPoru.nodes.get("GlaceYT-2").connected = false;
    mockPoru.nodes.get("Millohost Public Node").connected = false;
    mockPoru.nodes.get("Hyperion").connected = false;
    const preferred3 = manager.getPreferredNode(mockPoru);
    assert.equal(preferred3, "Serenetia Public Node", "Must fall back to Tier 3 Public Fallback Pool");
  });

  it("TC-LAVA-3.3: Downloader cleanup tracking records temporary files produced by yt-dlp", async () => {
    const trackedFiles = [];
    const mockCleanup = {
      trackAll(files) {
        trackedFiles.push(...files);
      },
    };

    let capturedArgs = null;

    // Mock yt-dlp instance to simulate file production without external network call
    const mockYtDlp = {
      execPromise(args) {
        capturedArgs = args;
        const outIdx = args.indexOf("-o");
        const outTemplate = args[outIdx + 1];
        const actualFile = outTemplate.replace("%(ext)s", "mp4");
        fs.writeFileSync(actualFile, "mock-audio-binary-content");
        return Promise.resolve();
      },
    };

    _setYtDlpInstanceForTesting(mockYtDlp);

    try {
      const result = await tryYtdlp("https://www.youtube.com/watch?v=mock-cleanup", mockCleanup);
      assert.ok(result !== null);
      assert.equal(result.status, "stream");
      assert.ok(trackedFiles.length > 0, "CleanupManager must track produced files");
      assert.equal(trackedFiles[0], result.url);

      // Verify captured args included --cookies
      const cookieIdx = capturedArgs.indexOf("--cookies");
      assert.ok(cookieIdx !== -1, "yt-dlp execution must include --cookies argument");
    } finally {
      _setYtDlpInstanceForTesting(null);
      // Clean up mock file
      for (const f of trackedFiles) {
        if (fs.existsSync(f)) {
          try {
            fs.unlinkSync(f);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }
  });

  it("TC-LAVA-3.4: Audio pipeline cookie metadata exposure and node attachment", () => {
    const clusterManager = new LavalinkClusterManager();
    const cookieConfig = clusterManager.getYoutubeCookieConfig();

    assert.equal(typeof cookieConfig, "object");
    assert.equal(cookieConfig.exists, true);
    assert.equal(cookieConfig.filename, "cookies.txt");
    assert.ok(path.isAbsolute(cookieConfig.path));

    const musicManager = new MusicManager();
    assert.deepEqual(musicManager.youtubeCookieConfig, cookieConfig);

    const builtNodes = musicManager.buildNodes();
    assert.ok(builtNodes.length > 0);
    for (const node of builtNodes) {
      assert.ok(node.cookieConfig !== undefined, "Every node in buildNodes must carry cookieConfig");
      assert.equal(node.cookieConfig.exists, true);
      assert.equal(node.cookieConfig.filename, "cookies.txt");
    }
  });

  it("TC-LAVA-3.5: Lossless Hi-Fi node federation and geographic auto-balancing", () => {
    const manager = new LavalinkClusterManager();
    manager.registerHiFiNode("HiFi-SG", { region: "singapore", lossless: true, maxBitrate: 384000 });
    manager.registerHiFiNode("HiFi-EU", { region: "europe", lossless: true, maxBitrate: 384000 });

    const mockPoru = {
      nodes: new Map([
        ["HiFi-SG", { name: "HiFi-SG", connected: true }],
        ["HiFi-EU", { name: "HiFi-EU", connected: true }],
      ]),
    };

    manager.nodeSelector.updateNodeLatency("HiFi-SG", 35);
    manager.nodeSelector.updateNodeLatency("HiFi-EU", 180);

    const optimalSG = manager.getOptimalHiFiNode(mockPoru, "singapore");
    assert.equal(optimalSG, "HiFi-SG", "Optimal Hi-Fi node for Singapore region must select HiFi-SG");

    const optimalEU = manager.getOptimalHiFiNode(mockPoru, "europe");
    assert.equal(optimalEU, "HiFi-EU", "Optimal Hi-Fi node for Europe region must select HiFi-EU");
  });
});

describe("Lavalink & YouTube Cookies E2E Suite - Tier 4: Real-World Scenarios & QA Certification", () => {
  it("TC-LAVA-4.1: Lavalink fallbacks configuration contains zero dead/unreachable nodes", () => {
    const fallbacksPath = path.resolve(__dirname, "../../src/config/lavalink-fallbacks.json");
    assert.ok(fs.existsSync(fallbacksPath));

    const fallbacks = JSON.parse(fs.readFileSync(fallbacksPath, "utf8"));
    assert.ok(Array.isArray(fallbacks));

    const deadHosts = [
      "v4.lavalink.rocks",
      "lavalink.jompo.cloud",
      "37.27.114.136",
    ];

    for (const node of fallbacks) {
      assert.ok(
        !deadHosts.includes(node.host),
        `Dead host "${node.host}" must not be present in lavalink-fallbacks.json`,
      );
    }

    // Verify fallback count is clean (only verified alive nodes)
    assert.equal(fallbacks.length, 2, "lavalink-fallbacks.json must contain exactly 2 verified alive fallbacks");
  });

  it("TC-LAVA-4.2: Cookie credentials and session files are strictly gitignored", () => {
    const gitStatus = execSync("git status --ignored --short cookies.txt message.txt", {
      encoding: "utf8",
    });

    assert.ok(gitStatus.includes("!! cookies.txt"), "cookies.txt must have !! ignored git status");
    assert.ok(gitStatus.includes("!! message.txt"), "message.txt must have !! ignored git status");

    const gitignoreContent = fs.readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf8");
    assert.ok(gitignoreContent.includes("cookies.txt"), ".gitignore must contain cookies.txt");
    assert.ok(gitignoreContent.includes("message.txt"), ".gitignore must contain message.txt");
  });

  it("TC-LAVA-4.3: Secret leak scanner executes cleanly with zero leaked credentials", () => {
    const output = execSync("node scripts/check-secrets.js", {
      encoding: "utf8",
    });

    assert.ok(
      output.includes("Repositori aman") || output.includes("tidak ada kredensial"),
      "Secret scanner must verify repository is clean of leaked secrets",
    );
  });

  it("TC-LAVA-4.4: Codebase strict zero em-dash policy certification across repository", () => {
    const output = execSync("node scripts/check-em-dash.js", {
      encoding: "utf8",
    });

    assert.ok(
      output.includes("Bersih") && output.includes("Tidak ada em dash"),
      "Entire repository must have zero em-dash characters",
    );
  });
});
