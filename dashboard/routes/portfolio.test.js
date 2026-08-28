"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const portfolioRoutes = require("./portfolio");
const UserPortfolio = require("../../src/models/UserPortfolio");

test("Portfolio Model & Constants validation", () => {
  assert.ok(UserPortfolio.VALID_THEMES.includes("default"));
  assert.ok(UserPortfolio.VALID_THEMES.includes("sakura"));
  assert.ok(UserPortfolio.VALID_THEMES.includes("cyber"));
  assert.ok(UserPortfolio.VALID_THEMES.includes("midnight"));

  assert.ok(UserPortfolio.VALID_BG_TYPES.includes("particles"));
  assert.ok(UserPortfolio.VALID_BG_TYPES.includes("gradient"));
  assert.ok(UserPortfolio.VALID_BG_TYPES.includes("image"));

  assert.ok(UserPortfolio.VALID_SECTIONS.includes("survival"));
  assert.ok(UserPortfolio.VALID_SECTIONS.includes("music"));
  assert.ok(UserPortfolio.VALID_SECTIONS.includes("cards"));
  assert.ok(UserPortfolio.VALID_SECTIONS.includes("economy"));
  assert.ok(UserPortfolio.VALID_SECTIONS.includes("achievements"));
});

test("Portfolio Routes initialization and endpoint registration", () => {
  const mockClient = {
    users: {
      cache: new Map(),
      fetch: async () => null,
    },
  };

  const router = portfolioRoutes(mockClient);
  assert.ok(router, "Router portfolio harus berhasil dibuat");

  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const paths = routes.map((r) => r.path);
  assert.ok(
    paths.includes("/api/portfolio/me"),
    "Endpoint /api/portfolio/me harus ada",
  );
  assert.ok(
    paths.includes("/api/portfolio/me/toggle"),
    "Endpoint /api/portfolio/me/toggle harus ada",
  );
  assert.ok(
    paths.includes("/api/portfolio/:userId"),
    "Endpoint /api/portfolio/:userId harus ada",
  );
  assert.ok(paths.includes("/u/:userId"), "Endpoint /u/:userId harus ada");
});
