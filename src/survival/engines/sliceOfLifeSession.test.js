"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createSliceOfLifeSession } = require("./sliceOfLifeSession");

function setup() {
  let options, prefix, data, moved = 0, response;
  const store = {
    async read() { return { ok: true, progress: { scene: "start", completed: false } }; },
    async transition(_id, scene, index) { moved++; return { ok: true, progress: { scene: scene === "start" && index === 0 ? "naura" : "start", completed: false } }; },
  };
  const renderer = { async renderScene(d, opts) { data = d; prefix = opts.customIdPrefix; return { components: [] }; } };
  const interaction = { guildId: "g", member: { displayName: "**Nama**" }, user: { id: "owner" }, async editReply(p) { response = p; return { id: "message" }; } };
  const session = createSliceOfLifeSession({ store, renderer, createCollector(_m, _u, opts) { options = opts; }, buildError(message) { return { message }; } });
  return { session, interaction, get options() { return options; }, get prefix() { return prefix; }, get data() { return data; }, get moved() { return moved; }, get response() { return response; } };
}

test("memulai dari adegan tersimpan dengan nama pengguna dan mention aman", async () => {
  const x = setup();
  await x.session.start(x.interaction);
  assert.equal(x.data.speakerName, "\\*\\*Nama\\*\\*");
  assert.deepEqual(x.response.allowedMentions, { parse: [] });
});

test("menolak pemilik lain dan custom ID yang bukan milik sesi", async () => {
  const x = setup(); await x.session.start(x.interaction);
  const replies = [];
  const button = { user: { id: "other" }, customId: `${x.prefix}_0`, async reply(v) { replies.push(v); } };
  await x.options.onCollect(button, { stop() {} });
  button.user.id = "owner"; button.customId = "sol_bad_0";
  await x.options.onCollect(button, { stop() {} });
  assert.equal(x.moved, 0); assert.equal(replies.length, 2);
});

test("memproses pilihan valid lalu menavigasi ke adegan berikut", async () => {
  const x = setup(); await x.session.start(x.interaction);
  let stopped = false;
  const button = { user: { id: "owner" }, customId: `${x.prefix}_0`, async deferUpdate() {}, async editReply() { return { id: "message" }; } };
  await x.options.onCollect(button, { stop(reason) { stopped = reason === "navigated"; } });
  assert.equal(x.moved, 1); assert.equal(stopped, true); assert.equal(x.data.speakerName, "Naura");
});