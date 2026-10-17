"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// ─────────────────────────────────────────────────────────────────
// R1. Audio Playlist Tests
// ─────────────────────────────────────────────────────────────────
test("R1: Music Playlist Engine - total duration and save calculation", async () => {
  const { formatDuration } = require("../plugin/music/helpers/musicShared");
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(65000), "1:05");
  assert.equal(formatDuration(3665000), "1:01:05");

  // Track duration summing
  const mockTracks = [
    { title: "Song 1", author: "Artist 1", length: 180000 },
    { title: "Song 2", author: "Artist 2", length: 240000 },
  ];
  const totalMs = mockTracks.reduce((acc, t) => acc + t.length, 0);
  assert.equal(totalMs, 420000);
  assert.equal(formatDuration(totalMs), "7:00");
});

// ─────────────────────────────────────────────────────────────────
// R2. Pet Rarity, 1 Pet Rule & Real-World Items Tests
// ─────────────────────────────────────────────────────────────────
test("R2: Pet Rarity & Real-World Species Mapping", () => {
  const {
    getPetRarityInfo,
    rollPetForaging,
  } = require("../src/survival/helpers/petRarity");

  // Common pet test
  const commonPet = { petType: "kucing_kampung", petName: "Si Belang", petLevel: 5 };
  const infoCommon = getPetRarityInfo(commonPet);
  assert.equal(infoCommon.tier.rarity, "Common");
  assert.equal(infoCommon.species.name, "Kucing Kampung");
  assert.equal(infoCommon.badge, "I");

  // Mythic pet test
  const mythicPet = { petType: "gajah_sumatera_putih", petName: "Ganesha", petLevel: 10 };
  const infoMythic = getPetRarityInfo(mythicPet);
  assert.equal(infoMythic.tier.rarity, "Mythic");
  assert.equal(infoMythic.badge, "VI");

  // Foraging roll test
  const foraged = rollPetForaging(commonPet);
  assert.ok(foraged.itemId);
  assert.ok(foraged.qty >= 1);
  assert.ok(foraged.bonusCoins > 0);
  assert.ok(foraged.story.includes(foraged.item.narrative));

  // Catalog item verification
  const { getItemFromCatalog } = require("../src/survival/data/items_catalog");
  const obsidian = getItemFromCatalog("obsidian_stone");
  assert.ok(obsidian, "obsidian_stone must exist in items_catalog");
  assert.equal(obsidian.name, "Batu Obsidian Halus");
  assert.equal(obsidian.rarity, "Common");

  const feather = getItemFromCatalog("peacock_feather");
  assert.ok(feather, "peacock_feather must exist in items_catalog");
  assert.equal(feather.rarity, "Rare");

  const nest = getItemFromCatalog("swallow_nest");
  assert.ok(nest, "swallow_nest must exist in items_catalog");
  assert.equal(nest.rarity, "Legendary");

  const shield = getItemFromCatalog("streak_shield");
  assert.ok(shield, "streak_shield must exist in items_catalog");
  assert.equal(shield.name, "Jimat Pelindung Streak");
});

// ─────────────────────────────────────────────────────────────────
// R3. Fun & Social Affinity Tests
// ─────────────────────────────────────────────────────────────────
test("R3: Fun Social Affinity - Deterministic Score and Canvas Rendering", async () => {
  const {
    calculateAffinityScore,
    getAffinityTier,
    renderAffinityCard,
  } = require("../src/canvas/affinityCanvas");

  const score1 = calculateAffinityScore("user_123", "user_456");
  const score2 = calculateAffinityScore("user_456", "user_123");
  assert.equal(score1, score2, "Affinity score between two users must be symmetrical");
  assert.ok(score1 >= 0 && score1 <= 100);

  const tier = getAffinityTier(score1);
  assert.ok(tier.title);
  assert.ok(tier.color);
  assert.ok(tier.quote);

  // Render Canvas buffer
  const buffer = await renderAffinityCard({
    user1: { username: "alice", displayName: "Alice", avatarUrl: "" },
    user2: { username: "bob", displayName: "Bob", avatarUrl: "" },
    score: 88,
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000, "Rendered affinity card buffer should be valid PNG");
});

// ─────────────────────────────────────────────────────────────────
// R4. Daily Hub & Streak Shield Tests
// ─────────────────────────────────────────────────────────────────
test("R4: Daily Hub - Streak Shield Logic & Item Conservation", () => {
  const { getItemFromCatalog } = require("../src/survival/data/items_catalog");
  const shield = getItemFromCatalog("streak_shield");
  assert.equal(shield.category, "special");
  assert.equal(shield.usableType, "streak_protection");
  assert.ok(!shield.description.includes("\u2014"), "Description must not contain em-dash");
});

// ─────────────────────────────────────────────────────────────────
// R5. AFK System & Mention Digest Tests
// ─────────────────────────────────────────────────────────────────
test("R5: AFK Mention Digest - Data Structure and Components V2 Integrity", () => {
  const { buildContainerV2 } = require("../src/utils/NauraContainerBuilder");

  const mockMentions = [
    {
      author: "Charlie",
      content: "Halo, bisa bantu cek laporan bug?",
      time: Date.now() - 300000,
      link: "https://discord.com/channels/1/2/3",
    },
  ];

  const list = mockMentions.map((m, idx) => {
    const timeStr = `<t:${Math.floor(m.time / 1000)}:R>`;
    const snippet = m.content ? `> *"${m.content}"*\n` : "";
    return `**${idx + 1}.** **${m.author}** (${timeStr})\n${snippet}🔗 [Buka Pesan Asli](${m.link})`;
  }).join("\n\n");

  const payload = buildContainerV2({
    accentColorHex: "#10B981",
    authorName: "Status AFK Dinonaktifkan",
    title: "👋 Selamat Datang Kembali!",
    description: `Selamat datang kembali!\n\n🔔 **RANGKUMAN MENTION (1 Panggilan):**\n\n${list}`,
    footerText: "Naura Auto-Responder System",
  });

  assert.ok(payload);
  assert.ok(payload.components);
  assert.ok(payload.flags);
  assert.ok(!JSON.stringify(payload).includes("\u2014"), "No em-dash in AFK payload");
});
