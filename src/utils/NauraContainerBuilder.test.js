const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  buildContainerV2,
  buildLoadingContainerV2,
  buildErrorContainerV2,
  buildSuccessContainerV2,
  sanitizeComponentCustomIds,
} = require("./NauraContainerBuilder");
const ui = require("../config/ui");

describe("NauraContainerBuilder & UI Localization V2", () => {
  it("ui.getFooter mengembalikan teks lokalisasi sesuai bahasa", () => {
    const footerId = ui.getFooter("core", "id");
    const footerEn = ui.getFooter("core", "en");
    const footerNaura = ui.getFooter("naura", "id");

    assert.ok(footerId.includes("Diciptakan oleh Aryandita"));
    assert.ok(footerEn.includes("Created by Aryandita"));
    assert.ok(footerNaura.includes("Naura Hoshino Companion"));
  });

  it("buildContainerV2 merender footer dinamis berdasarkan lang", () => {
    const payloadId = buildContainerV2({
      lang: "id",
      title: "Judul Tes",
      description: "Deskripsi",
    });

    const payloadEn = buildContainerV2({
      lang: "en",
      title: "Test Title",
      description: "Description",
    });

    const compId = payloadId.components[0].components;
    const compEn = payloadEn.components[0].components;

    const footerCompId = compId[compId.length - 1];
    const footerCompEn = compEn[compEn.length - 1];

    assert.ok(footerCompId.content.includes("Diciptakan oleh Aryandita"));
    assert.ok(footerCompEn.content.includes("Created by Aryandita"));
  });

  it("buildContainerV2 otomatis mendeteksi lang dari interaction", () => {
    const mockInteraction = {
      locale: "en-US",
      user: { id: "12345" },
    };

    const payload = buildContainerV2({
      interaction: mockInteraction,
      title: "Context Test",
      description: "Auto detected context",
    });

    const comp = payload.components[0].components;
    const footerComp = comp[comp.length - 1];
    assert.ok(footerComp.content.includes("Created by Aryandita"));
  });

  it("buildLoadingContainerV2 menggunakan author dan teks terjemahan", () => {
    const payloadEn = buildLoadingContainerV2({
      lang: "en",
    });

    const str = JSON.stringify(payloadEn);
    assert.ok(
      str.includes("Processing") ||
        str.includes("Your request is being processed") ||
        str.includes("Naura is working"),
    );
  });

  it("buildErrorContainerV2 menggunakan author dan pesan terjemahan", () => {
    const payloadEn = buildErrorContainerV2({
      lang: "en",
    });

    const str = JSON.stringify(payloadEn);
    assert.ok(str.includes("Something went wrong"));
  });

  it("buildSuccessContainerV2 menggunakan title dan pesan terjemahan", () => {
    const payloadEn = buildSuccessContainerV2({
      lang: "en",
    });

    const str = JSON.stringify(payloadEn);
    assert.ok(str.includes("Done"));
  });

  it("buildContainerV2 menyertakan tombol sapu ketika allowCleanup: true", () => {
    const payload = buildContainerV2({
      title: "Cleanable Message",
      description: "Testing cleanup button",
      allowCleanup: true,
      expiresInSeconds: 60,
    });

    const str = JSON.stringify(payload);
    assert.ok(str.includes("msg_cleanup"));
    assert.ok(str.includes("Bersihkan (+3 SC)"));
    assert.ok(str.includes("Pesan ini otomatis terhapus"));
  });

  it("buildContainerV2 mengabaikan iconURL attachment:// jika file tidak disertakan di array files", () => {
    const payload = buildContainerV2({
      title: "Test Unreferenced Attachment",
      description: "Description",
      iconURL: "attachment://missing_portrait.png",
      files: [],
    });

    const header = payload.components[0].components[0];
    assert.strictEqual(header.accessory, undefined);
  });

  it("buildContainerV2 mempertahankan iconURL attachment:// jika file terlampir di array files", () => {
    const payload = buildContainerV2({
      title: "Test Referenced Attachment",
      description: "Description",
      iconURL: "attachment://valid_portrait.png",
      files: [{ name: "valid_portrait.png" }],
    });

    const header = payload.components[0].components[0];
    assert.ok(header.accessory);
    assert.strictEqual(
      header.accessory.media.url,
      "attachment://valid_portrait.png",
    );
  });

  it("buildContainerV2 mendeduplikasi custom_id yang sama pada baris tombol", () => {
    const duplicateRow1 = {
      type: 1,
      components: [
        { type: 2, style: 1, custom_id: "btn_test_1", label: "Tombol 1" },
        { type: 2, style: 2, custom_id: "btn_test_2", label: "Tombol 2" },
      ],
    };
    const duplicateRow2 = {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          custom_id: "btn_test_1",
          label: "Tombol 1 Duplikat",
        },
        { type: 2, style: 3, custom_id: "btn_test_3", label: "Tombol 3" },
      ],
    };

    const payload = buildContainerV2({
      title: "Test Deduplication",
      description: "Testing duplicate custom_id",
      buttonsRow: [duplicateRow1, duplicateRow2],
    });

    const rows = payload.components[0].components.filter((c) => c.type === 1);
    const allCustomIds = rows.flatMap((r) =>
      r.components.map((c) => c.custom_id),
    );
    assert.deepStrictEqual(allCustomIds, [
      "btn_test_1",
      "btn_test_2",
      "btn_test_3",
    ]);
  });

  it("sanitizeComponentCustomIds menyaring komponen dengan custom_id duplikat di seluruh pohon", () => {
    const rawComponents = [
      {
        type: 17,
        components: [
          {
            type: 1,
            components: [{ type: 2, custom_id: "btn_shared_1", label: "A" }],
          },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, custom_id: "btn_shared_1", label: "A Duplikat" },
          { type: 2, custom_id: "btn_unique_2", label: "B" },
        ],
      },
    ];

    const sanitized = sanitizeComponentCustomIds(rawComponents);
    assert.strictEqual(sanitized.length, 2);
    assert.strictEqual(
      sanitized[0].components[0].components[0].custom_id,
      "btn_shared_1",
    );
    assert.strictEqual(sanitized[1].components.length, 1);
    assert.strictEqual(sanitized[1].components[0].custom_id, "btn_unique_2");
  });
});

describe("Container Color Resolution & 3-Pillar Foundation (Feature F03)", () => {
  it("resolves explicit pillar 'naura' to 0xFFC0CB (Sakura Pink)", () => {
    const payload = buildContainerV2({
      pillar: "naura",
      title: "Naura Pillar Test",
    });
    assert.strictEqual(payload.components[0].accent_color, 0xffc0cb);
  });

  it("resolves explicit pillar 'survival' to 0x86EFAC (Emerald Leaf)", () => {
    const payload = buildContainerV2({
      pillar: "survival",
      title: "Survival Pillar Test",
    });
    assert.strictEqual(payload.components[0].accent_color, 0x86efac);
  });

  it("resolves explicit pillar 'adisha' alias to 0x86EFAC (Emerald Leaf)", () => {
    const payload = buildContainerV2({
      pillar: "adisha",
      title: "Adisha Pillar Test",
    });
    assert.strictEqual(payload.components[0].accent_color, 0x86efac);
  });

  it("resolves explicit pillar 'dashboard' to 0x22D3EE (Signal Cyan)", () => {
    const payload = buildContainerV2({
      pillar: "dashboard",
      title: "Dashboard Pillar Test",
    });
    assert.strictEqual(payload.components[0].accent_color, 0x22d3ee);
  });

  it("handles case-insensitivity for pillar parameter", () => {
    const payloadUpper = buildContainerV2({ pillar: "SURVIVAL" });
    const payloadMixed = buildContainerV2({ pillar: "  Dashboard  " });
    assert.strictEqual(payloadUpper.components[0].accent_color, 0x86efac);
    assert.strictEqual(payloadMixed.components[0].accent_color, 0x22d3ee);
  });

  it("infers pillar color from footerCategory 'survival' -> 0x86EFAC", () => {
    const payload = buildContainerV2({ footerCategory: "survival" });
    assert.strictEqual(payload.components[0].accent_color, 0x86efac);
  });

  it("infers pillar color from footerCategory 'adisha' -> 0x86EFAC", () => {
    const payload = buildContainerV2({ footerCategory: "adisha" });
    assert.strictEqual(payload.components[0].accent_color, 0x86efac);
  });

  it("infers pillar color from footerCategory 'admin' -> 0x22D3EE", () => {
    const payload = buildContainerV2({ footerCategory: "admin" });
    assert.strictEqual(payload.components[0].accent_color, 0x22d3ee);
  });

  it("infers pillar color from footerCategory 'system' -> 0x22D3EE", () => {
    const payload = buildContainerV2({ footerCategory: "system" });
    assert.strictEqual(payload.components[0].accent_color, 0x22d3ee);
  });

  it("infers pillar color from footerCategory 'dashboard' -> 0x22D3EE", () => {
    const payload = buildContainerV2({ footerCategory: "dashboard" });
    assert.strictEqual(payload.components[0].accent_color, 0x22d3ee);
  });

  it("infers default color 0xFFC0CB for footerCategory 'core' or 'naura'", () => {
    const payloadCore = buildContainerV2({ footerCategory: "core" });
    const payloadNaura = buildContainerV2({ footerCategory: "naura" });
    assert.strictEqual(payloadCore.components[0].accent_color, 0xffc0cb);
    assert.strictEqual(payloadNaura.components[0].accent_color, 0xffc0cb);
  });

  it("preserves explicit accentColorHex over pillar parameter", () => {
    const payload = buildContainerV2({
      accentColorHex: "#34D399",
      pillar: "dashboard",
    });
    assert.strictEqual(payload.components[0].accent_color, 0x34d399);
  });

  it("preserves explicit color (number) over pillar parameter", () => {
    const payload = buildContainerV2({
      color: 0xff0000,
      pillar: "survival",
    });
    assert.strictEqual(payload.components[0].accent_color, 0xff0000);
  });

  it("preserves explicit color (hex string) over footerCategory", () => {
    const payload = buildContainerV2({
      color: "#FBBF24",
      footerCategory: "survival",
    });
    assert.strictEqual(payload.components[0].accent_color, 0xfbbf24);
  });

  it("preserves explicit pillar over footerCategory", () => {
    const payload = buildContainerV2({
      pillar: "survival",
      footerCategory: "admin",
    });
    assert.strictEqual(payload.components[0].accent_color, 0x86efac);
  });

  it("falls back to footerCategory when unknown pillar string is provided", () => {
    const payload = buildContainerV2({
      pillar: "unknown_pillar",
      footerCategory: "admin",
    });
    assert.strictEqual(payload.components[0].accent_color, 0x22d3ee);
  });

  it("supports dual signature buildContainerV2(client, options)", () => {
    const mockClient = { user: { id: "bot_123" } };
    const payload = buildContainerV2(mockClient, {
      pillar: "survival",
      title: "Client + Options Test",
    });
    assert.strictEqual(payload.components[0].accent_color, 0x86efac);
  });

  it("maintains 100% backward compatibility when no color or pillar is specified", () => {
    const payload = buildContainerV2({
      title: "Legacy Call",
      description: "No pillar or color passed",
    });
    assert.strictEqual(payload.components[0].accent_color, 0xffc0cb);
  });
});
