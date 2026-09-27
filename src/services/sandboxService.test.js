"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sandboxService = require("./sandboxService");

test("SandboxService - Basic Math & Execution", async () => {
  const code = `
    const a = 10;
    const b = 25;
    console.log("Menghitung hasil:", a + b);
    return a * b;
  `;

  const res = await sandboxService.executeSandboxedCode(code);
  assert.ok(res.success, "Eksekusi harus sukses");
  assert.equal(res.result, "250");
  assert.equal(res.logs.length, 1);
  assert.equal(res.logs[0], "Menghitung hasil: 35");
});

test("SandboxService - Forbidden Globals & Security Check", async () => {
  const exploitAttempts = [
    "return process.env.DISCORD_TOKEN;",
    "const fs = require('fs');",
    "eval('2 + 2')",
    "const cp = require('child_process');",
    "const f = new Function('return 10');",
  ];

  for (const exploit of exploitAttempts) {
    const res = await sandboxService.executeSandboxedCode(exploit);
    assert.equal(res.success, false, `Exploit "${exploit}" harus diblokir`);
    assert.match(res.error, /Akses ditolak/, "Harus memuat pesan akses ditolak");
  }
});

test("SandboxService - Infinite Loop Timeout Protection", async () => {
  const infiniteLoop = `
    let counter = 0;
    while (true) {
      counter++;
    }
  `;

  const res = await sandboxService.executeSandboxedCode(infiniteLoop);
  assert.equal(res.success, false, "Infinite loop harus digagalkan");
  assert.match(res.error, /Batas waktu eksekusi/, "Harus mendeteksi timeout");
  assert.ok(res.executionTimeMs >= 1000, "Waktu eksekusi harus mendekati limit timeout");
});

test("SandboxService - Syntax & Runtime Error Handling", async () => {
  const badSyntax = "const a = ;";
  const resSyntax = await sandboxService.executeSandboxedCode(badSyntax);
  assert.equal(resSyntax.success, false);
  assert.ok(resSyntax.error, "Harus melaporkan syntax error");

  const runtimeError = "const obj = null; return obj.something;";
  const resRuntime = await sandboxService.executeSandboxedCode(runtimeError);
  assert.equal(resRuntime.success, false);
  assert.match(resRuntime.error, /Cannot read properties of null/, "Harus menangkap runtime error");
});
