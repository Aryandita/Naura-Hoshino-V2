"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const bountyVaultEngine = require("./bountyVaultEngine");
const cacheManager = require("../managers/cacheManager");

test("BountyVaultEngine - Zero-Knowledge Encryption & Decryption", async () => {
  const secret = "TokenRahasiaServer2026";
  const passphrase = "KunciRahasiaKuat123!";

  const stored = await bountyVaultEngine.storeSecret({
    userId: "user_007",
    secretText: secret,
    passphrase,
  });

  assert.equal(stored.success, true);
  assert.ok(stored.vaultId);

  // Dekripsi dengan passphrase benar
  const decrypted = await bountyVaultEngine.retrieveSecret(
    stored.vaultId,
    passphrase,
  );
  assert.equal(decrypted.success, true);
  assert.equal(decrypted.plaintext, secret);

  // Dekripsi dengan passphrase salah
  const failed = await bountyVaultEngine.retrieveSecret(
    stored.vaultId,
    "PassphraseSalah!",
  );
  assert.equal(failed.success, false);
  assert.match(failed.error, /Passphrase salah/);
});

test("BountyVaultEngine - Community Bounty Lifecycle (Create, Claim, Approve)", async () => {
  const originalDebit = cacheManager.debitUserSurvival;
  const originalIncrement = cacheManager.incrementUserSurvival;

  cacheManager.debitUserSurvival = async () => true;
  cacheManager.incrementUserSurvival = async () => true;

  try {
    // 1. Create Bounty
    const createRes = await bountyVaultEngine.createBounty({
      guildId: "guild_bounty_1",
      creatorId: "creator_user",
      title: "Bantu Bersihkan Ruang Obrolan",
      description: "Laporkan 5 pesan spam di kanal utama",
      rewardNsf: 500,
    });

    assert.equal(createRes.success, true);
    assert.ok(createRes.bounty);
    const bId = createRes.bounty.bountyId;

    // 2. List Bounties
    const list = await bountyVaultEngine.listBounties("guild_bounty_1", "open");
    assert.ok(list.length > 0);
    assert.equal(list[0].bountyId, bId);

    // 3. Claim Bounty
    const claimRes = await bountyVaultEngine.claimBounty(
      "guild_bounty_1",
      bId,
      "worker_user",
      "Saya telah melaporkan 5 pesan spam",
    );
    assert.equal(claimRes.success, true);
    assert.equal(claimRes.bounty.status, "submitted");

    // 4. Approve Bounty
    const approveRes = await bountyVaultEngine.approveBounty(
      "guild_bounty_1",
      bId,
      "creator_user",
    );
    assert.equal(approveRes.success, true);
    assert.equal(approveRes.rewardNsf, 500);
  } finally {
    cacheManager.debitUserSurvival = originalDebit;
    cacheManager.incrementUserSurvival = originalIncrement;
  }
});
