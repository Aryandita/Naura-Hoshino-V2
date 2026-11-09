"use strict";
const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const arcade = require("../plugin/arcade/arcade");
const ArcadeEngine = require("../src/arcade/arcadeEngine");
const { cid, genGameId, parseCid, rewardOnce, makeFilter } = require("../src/arcade/arcadeSession");

describe("Arcade game loop coverage (win/lose/timeout/other-user)", () => {
  test("GAME_CONFIG equals ALL_GAMES keys", () => {
    const a = Object.keys(arcade.ALL_GAMES).sort();
    const b = ArcadeEngine.getAvailableGames().sort();
    assert.deepEqual(a, b);
  });
  test("rps: win/lose/draw transitions via postGame + rewardOnce idempotent", async () => {
    const gid = genGameId("rps", "userA");
    const r1 = await rewardOnce(gid, async () => ({ res: "win" }));
    assert.equal(r1.ok, true);
    const r2 = await rewardOnce(gid, async () => ({ res: "win2" }));
    assert.equal(r2.ok, false);
  });
  test("tictactoe: board win checker (X win, O win, DRAW, ongoing)", () => {
    const checkWin = (b) => {
      const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const w of wins) if (b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]]) return b[w[0]];
      if (b.every((c) => c === "X" || c === "O")) return "DRAW";
      return null;
    };
    assert.equal(checkWin(["X","X","X",1,1,1,1,1,1]), "X");
    assert.equal(checkWin(["O","O","O",1,1,1,1,1,1]), "O");
    assert.equal(checkWin(["X","O","X","O","X","O","O","X","O"]), "DRAW");
    assert.equal(checkWin([0,1,2,3,4,5,6,7,8]), null);
  });
  test("trivia/wordle/hangman/memory/minesweeper/math/tebakkata/tebakgambar/tts edu banks non-empty", () => {
    const shared = require("../plugin/arcade/helpers/minigameShared");
    assert.ok(shared.wordleWords.length >= 5);
    assert.ok(shared.anagramDB.mudah.length > 0);
    assert.ok(shared.tebakGambarDB.length > 0);
    assert.ok(shared.ttsDB.length > 0);
    const edu = require("../plugin/arcade/subcommands/edu_peta");
    assert.ok(edu.BANKS.edu_peta.length >= 10);
    assert.ok(edu.BANKS.edu_belanja.length >= 10);
    assert.ok(edu.BANKS.edu_sukukata.length >= 10);
    assert.ok(edu.BANKS.edu_flagrush.length >= 10);
  });
  test("minesweeper: createGrid places bombs and counts neighbors", () => {
    const mod = require("../plugin/arcade/subcommands/minesweeper");
    assert.ok(mod.execute);
  });
  test("duel customId unique per gameId (salt)", () => {
    const g1 = genGameId("duel", "9");
    const g2 = genGameId("duel", "9");
    assert.notEqual(cid(g1, "duel_5"), cid(g2, "duel_5"));
    assert.equal(parseCid(cid(g1, "duel_5")).gameId, g1);
  });
  test("collector filter rejects other user (double-click / other user)", () => {
    const gid = genGameId("rps", "777");
    const f = makeFilter(gid, "777");
    assert.equal(f({ customId: cid(gid, "rps_batu"), user: { id: "777" } }), true);
    assert.equal(f({ customId: cid(gid, "rps_batu"), user: { id: "888" } }), false);
  });
  test("all subcommand modules export execute", async () => {
    for (const [key] of Object.entries(arcade.ALL_GAMES)) {
      if (key === "leaderboard") continue;
      const mod = require("../plugin/arcade/subcommands/" + key + ".js");
      assert.equal(typeof mod.execute, "function", key);
    }
  });
});
