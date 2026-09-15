const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  buildContainerV2,
  buildLoadingContainerV2,
  buildErrorContainerV2,
  buildSuccessContainerV2,
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
    assert.ok(str.includes("Naura is working"));
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
});
