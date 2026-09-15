"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { LavalinkClusterManager } = require("../managers/lavalinkClusterManager");

test("LavalinkClusterManager - buildTieredNodeList", () => {
  const manager = new LavalinkClusterManager();

  const privateNodes = [
    { name: "My VPS Node", host: "127.0.0.1", port: 2333, password: "pass1", secure: false },
    { name: "Backup Node", host: "127.0.0.2", port: 2333, password: "pass2", secure: false },
  ];

  const list = manager.buildTieredNodeList(privateNodes);

  // Harus memuat kedua private node plus node publik
  assert.ok(list.length >= 3, "Harus memuat private nodes dan public fallback nodes");

  // Private node pertama harus Tier 1
  const node1 = list.find((n) => n.name === "My VPS Node");
  assert.equal(node1.tier, 1);
  assert.equal(node1.isFallback, false);

  // Private node kedua harus Tier 2
  const node2 = list.find((n) => n.name === "Backup Node");
  assert.equal(node2.tier, 2);
  assert.equal(node2.isFallback, false);

  // Node publik harus Tier 3
  const publicNode = list.find((n) => n.tier === 3);
  assert.ok(publicNode, "Harus ada setidaknya satu node publik Tier 3");
  assert.equal(publicNode.isFallback, true);
});

test("LavalinkClusterManager - getPreferredNode Tier Priority & Penalties", () => {
  const manager = new LavalinkClusterManager();

  // Setup mock tiers
  manager.nodeTiers.set("Private-1", 1);
  manager.nodeTiers.set("Private-2", 2);
  manager.nodeTiers.set("Public-Fallback", 3);

  const mockPoru = {
    nodes: new Map([
      ["Private-1", { name: "Private-1", connected: true, penalties: 100 }],
      ["Private-2", { name: "Private-2", connected: true, penalties: 10 }],
      ["Public-Fallback", { name: "Public-Fallback", connected: true, penalties: 0 }],
    ]),
  };

  // 1. Saat Tier 1 aktif, wajib pilih Tier 1 meskipun penalti lebih tinggi dari Tier 2/3
  const selected1 = manager.getPreferredNode(mockPoru);
  assert.equal(selected1, "Private-1", "Wajib memilih Tier 1 jika connected");

  // 2. Jika Tier 1 down, harus fallback ke Tier 2
  mockPoru.nodes.get("Private-1").connected = false;
  const selected2 = manager.getPreferredNode(mockPoru);
  assert.equal(selected2, "Private-2", "Wajib memilih Tier 2 saat Tier 1 down");

  // 3. Jika semua private down, harus fallback ke Public Tier 3
  mockPoru.nodes.get("Private-2").connected = false;
  const selected3 = manager.getPreferredNode(mockPoru);
  assert.equal(selected3, "Public-Fallback", "Wajib memilih Public Tier 3 saat private down");
});

test("LavalinkClusterManager - Circuit Breaker Quarantine", () => {
  const manager = new LavalinkClusterManager();
  const nodeName = "Flaky-Public-Node";
  manager.nodeTiers.set(nodeName, 3);

  assert.equal(manager.isNodeQuarantined(nodeName), false);

  // Picu 3 error beruntun
  manager.recordNodeError(nodeName, new Error("HTTP 429 Rate Limit"));
  assert.equal(manager.isNodeQuarantined(nodeName), false);

  manager.recordNodeError(nodeName, new Error("Connection Timeout"));
  assert.equal(manager.isNodeQuarantined(nodeName), false);

  manager.recordNodeError(nodeName, new Error("Socket Closed Unexpectedly"));
  // Sekarang harus di-karantina (OPEN)
  assert.equal(manager.isNodeQuarantined(nodeName), true, "Node wajib di-karantina setelah 3 error");

  // getPreferredNode harus mengabaikan node yang di-karantina bila ada alternatif
  manager.nodeTiers.set("Healthy-Node", 3);
  const mockPoru = {
    nodes: new Map([
      [nodeName, { name: nodeName, connected: true, penalties: 0 }],
      ["Healthy-Node", { name: "Healthy-Node", connected: true, penalties: 50 }],
    ]),
  };

  const selected = manager.getPreferredNode(mockPoru);
  assert.equal(selected, "Healthy-Node", "Harus memilih node sehat dan mengabaikan node yang di-karantina");

  // Reset keberhasilan
  manager.recordNodeSuccess(nodeName);
  assert.equal(manager.isNodeQuarantined(nodeName), false, "Harus bebas dari karantina setelah recordNodeSuccess");
});

test("LavalinkClusterManager - Seamless Player Migration", async () => {
  const manager = new LavalinkClusterManager();

  manager.nodeTiers.set("Node-A", 1);
  manager.nodeTiers.set("Node-B", 3);

  let playCalledWith = null;
  let connectionCreatedWith = null;

  const mockNewPlayer = {
    volume: 100,
    loop: false,
    queue: {
      items: [],
      add(tracks) {
        this.items.push(...tracks);
      },
      unshift(track) {
        this.items.unshift(track);
      },
    },
    async play(options) {
      playCalledWith = options;
    },
  };

  const mockPoru = {
    nodes: new Map([
      ["Node-A", { name: "Node-A", connected: false }],
      ["Node-B", { name: "Node-B", connected: true }],
    ]),
    createConnection(opts) {
      connectionCreatedWith = opts;
      return mockNewPlayer;
    },
  };

  const mockFailedPlayer = {
    guildId: "guild-123",
    voiceChannel: "vc-456",
    textChannel: "tc-789",
    position: 45200, // Detik ke 45.2
    currentTrack: {
      info: { title: "Cyber City Lo-Fi", author: "Naura" },
    },
    queue: [{ info: { title: "Track 2" } }],
    volume: 85,
    loop: "track",
    destroy() {},
  };

  const migrated = await manager.migratePlayer(
    mockPoru,
    mockFailedPlayer,
    { name: "Node-A" },
    "Crash simulated",
  );

  assert.equal(migrated, true, "Migrasi player harus berhasil");
  assert.equal(connectionCreatedWith.node, "Node-B", "Koneksi baru harus diarahkan ke Node-B");
  assert.equal(connectionCreatedWith.voiceChannel, "vc-456");
  assert.equal(playCalledWith.startTime, 45200, "Pemutaran harus dilanjutkan dari offset milidetik terakhir");
  assert.equal(mockNewPlayer.volume, 85, "Volume player harus dipertahankan");
});

test("LavalinkClusterManager - Lossless Hi-Fi Node Federation & Auto-Balancing", () => {
  const manager = new LavalinkClusterManager();

  manager.registerHiFiNode("HiFi-SG", {
    region: "singapore",
    lossless: true,
    maxBitrate: 384000,
    codec: "FLAC/OPUS_HD",
  });
  manager.registerHiFiNode("HiFi-JP", {
    region: "tokyo",
    lossless: true,
    maxBitrate: 384000,
    codec: "FLAC/OPUS_HD",
  });

  const mockPoru = {
    nodes: new Map([
      ["HiFi-SG", { name: "HiFi-SG", connected: true, penalties: 15 }],
      ["HiFi-JP", { name: "HiFi-JP", connected: true, penalties: 10 }],
      ["Normal-Node", { name: "Normal-Node", connected: true, penalties: 0 }],
    ]),
  };

  // 1. Pilih node Hi-Fi terbaik untuk region tokyo
  const optimalJp = manager.getOptimalHiFiNode(mockPoru, "tokyo");
  assert.equal(optimalJp, "HiFi-JP", "Harus memilih node HiFi-JP untuk wilayah tokyo");

  // 2. Pilih node Hi-Fi terbaik untuk region singapore
  const optimalSg = manager.getOptimalHiFiNode(mockPoru, "singapore");
  assert.equal(optimalSg, "HiFi-SG", "Harus memilih node HiFi-SG untuk wilayah singapore");

  // 3. Audio quality getter/setter per guild
  assert.equal(manager.getGuildAudioQuality("g-1"), "hd", "Default audio quality harus hd");
  manager.setGuildAudioQuality("g-1", "lossless");
  assert.equal(manager.getGuildAudioQuality("g-1"), "lossless");

  // 4. Status telemetri federation
  const status = manager.getFederationStatus(mockPoru);
  assert.equal(status.totalNodes, 3);
  assert.equal(status.connectedNodes, 3);
  assert.equal(status.hiFiNodes.length, 2);
  assert.ok(status.supportedCodecs.includes("FLAC 24-bit"));
});
