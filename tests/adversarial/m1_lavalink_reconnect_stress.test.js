"use strict";

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("events");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const env = require("../../src/config/env");
const { LavalinkClusterManager } = require("../../src/managers/lavalinkClusterManager");
const nodeError = require("../../src/music/poru_events/nodeError");
const nodeDisconnect = require("../../src/music/poru_events/nodeDisconnect");
const nodeConnect = require("../../src/music/poru_events/nodeConnect");

let PoruClass;
try {
  const p = require("poru");
  PoruClass = p.Poru || p;
} catch (e) {
  PoruClass = null;
}

describe("Milestone M1 Empirical Challenge: Lavalink Cluster & Reconnection Spam Suite", () => {
  // ==========================================================================
  // SECTION 1: Sequential Node Parsing Edge Cases
  // ==========================================================================
  describe("1. Sequential Node Parsing in src/config/env.js", () => {
    it("ADV-NODE-01: Correctly parses contiguous indices 1, 2, 3, 4 without early termination", () => {
      const nodes = env.getLavalinkNumberedNodes();
      assert.equal(nodes.length, 4, "Must parse exactly 4 contiguous nodes from .env");

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

    it("ADV-NODE-02: Gap termination verification (indices 1, 2, 4 terminates loop at index 3)", () => {
      const origEnv = { ...process.env };
      try {
        delete process.env.LAVALINK_NAME;
        delete process.env.LAVA_NAME;
        for (let i = 2; i <= 10; i++) {
          delete process.env[`LAVALINK_NAME_${i}`];
          delete process.env[`LAVA_NAME_${i}`];
          delete process.env[`LAVALINK_HOST_${i}`];
          delete process.env[`LAVA_HOST_${i}`];
        }

        // Set index 2 and index 4, omitting index 3
        process.env.LAVALINK_HOST_2 = "node2.domain.test";
        process.env.LAVALINK_HOST_4 = "node4.domain.test";

        const parsed = env.getLavalinkNumberedNodes();
        // Since index 3 is missing, while loop must break immediately at index 3
        assert.equal(parsed.length, 2, "Loop must terminate upon encountering missing index 3");
        assert.equal(parsed[1].host, "node2.domain.test");
      } finally {
        process.env = origEnv;
      }
    });

    it("ADV-NODE-03: Alternate prefix parsing and auto-secure on port 443", () => {
      const origEnv = { ...process.env };
      try {
        for (let i = 2; i <= 10; i++) {
          delete process.env[`LAVALINK_NAME_${i}`];
          delete process.env[`LAVA_NAME_${i}`];
          delete process.env[`LAVALINK_HOST_${i}`];
          delete process.env[`LAVA_HOST_${i}`];
          delete process.env[`LAVALINK_PORT_${i}`];
          delete process.env[`LAVA_PORT_${i}`];
          delete process.env[`LAVALINK_PASSWORD_${i}`];
          delete process.env[`LAVA_PASS_${i}`];
          delete process.env[`LAVALINK_SECURE_${i}`];
          delete process.env[`LAVA_SECURE_${i}`];
        }

        process.env.LAVA_NAME_2 = "Alt-Prefix-Node";
        process.env.LAVA_HOST_2 = "alt.domain.test";
        process.env.LAVA_PORT_2 = "443";
        process.env.LAVA_PASS_2 = "secret-pass";

        const parsed = env.getLavalinkNumberedNodes();
        assert.equal(parsed.length, 2);
        assert.equal(parsed[1].name, "Alt-Prefix-Node");
        assert.equal(parsed[1].host, "alt.domain.test");
        assert.equal(parsed[1].port, 443);
        assert.equal(parsed[1].password, "secret-pass");
        assert.equal(parsed[1].secure, true, "Port 443 must automatically set secure to true");
      } finally {
        process.env = origEnv;
      }
    });
  });

  // ==========================================================================
  // SECTION 2: Fallback Pruning & Cluster Deduplication
  // ==========================================================================
  describe("2. Fallback Pruning & NodeSelector Deduplication", () => {
    it("ADV-PRUNE-01: Pruned lavalink-fallbacks.json contains NO dead or unreachable nodes", () => {
      const fallbackPath = path.join(__dirname, "../../src/config/lavalink-fallbacks.json");
      assert.ok(fs.existsSync(fallbackPath), "lavalink-fallbacks.json must exist");

      const fallbacks = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
      assert.ok(Array.isArray(fallbacks), "Fallbacks must be an array");
      assert.equal(fallbacks.length, 2, "Must contain exactly 2 verified alive fallbacks");

      const deadHosts = [
        "v4.lavalink.rocks",
        "lavalink.jompo.cloud",
        "37.27.114.136",
        "lavalinkv4-id.serenetia.com",
        "lavalinkv4-eu.serenetia.com",
      ];

      for (const fb of fallbacks) {
        assert.ok(!deadHosts.includes(fb.host), `Dead host ${fb.host} must not be present in fallbacks`);
        assert.ok(fb.name, "Fallback must have a name");
        assert.ok(fb.host, "Fallback must have a host");
        assert.ok(Number.isInteger(fb.port), "Fallback must have a numeric port");
        assert.ok(fb.password, "Fallback must have a password");
        assert.equal(typeof fb.secure, "boolean", "Fallback secure flag must be boolean");
      }
    });

    it("ADV-PRUNE-02: NodeSelector deduplicates overlapping nodes across private and public lists", () => {
      const clusterManager = new LavalinkClusterManager();
      const privateNodes = env.getLavalinkNumberedNodes();
      assert.equal(privateNodes.length, 4);

      const tieredList = clusterManager.buildTieredNodeList(privateNodes);

      // Millohost exists in both .env (Node 3) and lavalink-fallbacks.json.
      // NodeSelector must deduplicate it so it appears only once.
      // Total nodes = 4 Private + 1 Public Fallback (Serenetia) = 5 nodes.
      assert.equal(tieredList.length, 5, "Total tiered list must contain exactly 5 nodes after deduplication");

      const millohostInstances = tieredList.filter((n) => n.host === "lava-v4.millohost.my.id");
      assert.equal(millohostInstances.length, 1, "Millohost must appear exactly once");
      assert.equal(millohostInstances[0].isFallback, false, "Overlapping node in .env remains Private");

      const serenetiaInstances = tieredList.filter((n) => n.host === "lavalinkv4.serenetia.com");
      assert.equal(serenetiaInstances.length, 1, "Serenetia must be loaded as Public Fallback");
      assert.equal(serenetiaInstances[0].isFallback, true, "Serenetia must be marked isFallback: true");
    });
  });

  // ==========================================================================
  // SECTION 3: Live Simulated Cluster Init & Zero Reconnect Spam
  // ==========================================================================
  describe("3. Simulated Cluster Init & Reconnection Spam Elimination", () => {
    it("ADV-SPAM-01: Poru cluster initialization produces zero reconnection error spam", async () => {
      assert.ok(PoruClass, "Poru class must be available");

      const clusterManager = new LavalinkClusterManager();
      const nodes = clusterManager.buildTieredNodeList(env.getLavalinkNumberedNodes());

      const mockClient = new EventEmitter();
      mockClient.user = { id: "123456789012345678" };
      mockClient.guilds = { cache: new Map() };
      mockClient.isReady = () => true;

      const capturedLogs = [];
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;

      console.log = (...args) => {
        capturedLogs.push({ level: "log", text: args.join(" ") });
        origLog(...args);
      };
      console.warn = (...args) => {
        capturedLogs.push({ level: "warn", text: args.join(" ") });
        origWarn(...args);
      };
      console.error = (...args) => {
        capturedLogs.push({ level: "error", text: args.join(" ") });
        origError(...args);
      };

      const poru = new PoruClass(mockClient, nodes, {
        library: "discord.js",
        defaultPlatform: "scsearch",
        clientName: "Naura-Hoshino-Music-System/3.1",
      });

      const connectedNodes = new Set();
      poru.on("nodeConnect", (node) => {
        connectedNodes.add(node?.options?.name || node?.name);
        clusterManager.recordNodeSuccess(node?.options?.name || node?.name);
      });

      const mockManager = { poru, client: mockClient };
      poru.on("nodeError", (...args) => nodeError.execute(mockManager, ...args));
      poru.on("nodeDisconnect", (...args) => nodeDisconnect.execute(mockManager, ...args));

      try {
        await poru.init();
        // Wait 8 seconds for node handshakes to settle
        await new Promise((r) => setTimeout(r, 8000));
      } finally {
        console.log = origLog;
        console.warn = origWarn;
        console.error = origError;

        poru.removeAllListeners();
        mockClient.removeAllListeners();

        for (const node of poru.nodes.values()) {
          try {
            node.reconnectTries = 0;
            if (node.reconnectAttempt) {
              clearTimeout(node.reconnectAttempt);
              node.reconnectAttempt = null;
            }
            if (node.ws) {
              node.ws.on("error", () => {});
              node.ws.terminate();
              node.ws = null;
            }
            node.isConnected = false;
          } catch (_) {}
        }
        poru.nodes.clear();
      }

      // Assert that multiple nodes successfully connected
      assert.ok(connectedNodes.size >= 3, `Expected at least 3 nodes connected, got ${connectedNodes.size}`);

      // Filter captured logs for reconnection error spam
      const spamErrors = capturedLogs.filter(
        (l) =>
          l.text.includes("ECONNREFUSED") ||
          l.text.includes("ENOTFOUND") ||
          l.text.includes("ETIMEDOUT") ||
          l.text.includes("⚠️ NODE ERROR"),
      );

      assert.equal(
        spamErrors.length,
        0,
        `Reconnection spam detected! Encountered: ${JSON.stringify(spamErrors)}`,
      );
    });

    it("ADV-SPAM-02: Adversarial oracle test verifies that dead node error triggers detection", async () => {
      assert.ok(PoruClass, "Poru class must be available");

      const deadNode = {
        name: "Adversarial-Dead-Node",
        host: "127.0.0.1",
        port: 59998,
        password: "fake_password",
        secure: false,
      };

      const mockClient = new EventEmitter();
      mockClient.user = { id: "123456789012345678" };
      mockClient.guilds = { cache: new Map() };
      mockClient.isReady = () => true;

      const capturedErrors = [];
      const poru = new PoruClass(mockClient, [deadNode], {
        library: "discord.js",
        defaultPlatform: "scsearch",
      });

      poru.on("nodeError", (node, err) => {
        capturedErrors.push({
          name: node?.options?.name,
          message: err?.message || String(err),
        });
      });

      try {
        await poru.init();
        await new Promise((r) => setTimeout(r, 2000));
      } finally {
        poru.removeAllListeners();
        mockClient.removeAllListeners();

        for (const node of poru.nodes.values()) {
          try {
            node.reconnectTries = 0;
            if (node.reconnectAttempt) {
              clearTimeout(node.reconnectAttempt);
              node.reconnectAttempt = null;
            }
            if (node.ws) {
              node.ws.on("error", () => {});
              node.ws.terminate();
              node.ws = null;
            }
            node.isConnected = false;
          } catch (_) {}
        }
        poru.nodes.clear();
      }

      assert.ok(
        capturedErrors.length > 0,
        "Adversarial oracle must detect connection failure for unreachable node",
      );
      assert.ok(
        capturedErrors.some((e) => e.message.includes("ECONNREFUSED")),
        "Dead node must trigger ECONNREFUSED error",
      );
    });
  });

  after(() => {
    http.globalAgent.destroy();
    https.globalAgent.destroy();
    for (const handle of process._getActiveHandles()) {
      if (
        handle &&
        typeof handle.destroy === "function" &&
        handle !== process.stdout &&
        handle !== process.stderr
      ) {
        try {
          handle.destroy();
        } catch (_) {}
      }
    }
  });
});
