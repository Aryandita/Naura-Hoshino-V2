"use strict";

const { parentPort } = require("node:worker_threads");

if (parentPort) {
  parentPort.on("message", async ({ id, task, payload }) => {
    try {
      let result = null;

      switch (task) {
        case "renderProfile": {
          const profileCanvas = require("./profileCanvas");
          result = await profileCanvas.generateProfileCard(payload);
          break;
        }
        case "renderBattle": {
          const battleCanvas = require("./battleCanvas");
          result = await battleCanvas.renderBattle(payload);
          break;
        }
        case "renderNowPlaying": {
          const nowplayingCanvas = require("./nowplayingCanvas");
          result = await nowplayingCanvas.renderNowPlayingCard(payload);
          break;
        }
        case "renderCard": {
          const cardCanvas = require("./cardCanvas");
          result = await cardCanvas.renderCard(payload);
          break;
        }
        case "renderBoss": {
          const bossCanvas = require("./bossCanvas");
          result = await bossCanvas.renderBossCard(payload);
          break;
        }
        case "renderCafe": {
          const cafeCanvas = require("./cafeCanvas");
          result = await cafeCanvas.renderCafeCard(payload);
          break;
        }
        case "renderPetHabitat": {
          const petHabitatCanvas = require("./petHabitatCanvas");
          result = await petHabitatCanvas.renderPetHabitat(payload);
          break;
        }
        case "renderTerritoryMap": {
          const territoryCanvas = require("./territoryCanvas");
          result = await territoryCanvas.renderTerritoryMap(payload);
          break;
        }
        case "renderGuildHall": {
          const guildHallCanvas = require("./guildHallCanvas");
          result = await guildHallCanvas.renderGuildHall(payload);
          break;
        }
        case "renderColiseumMatch": {
          const coliseumCanvas = require("./coliseumCanvas");
          result = await coliseumCanvas.renderColiseumMatch(payload);
          break;
        }
        case "renderVivarium": {
          const vivariumCanvas = require("./vivariumCanvas");
          result = await vivariumCanvas.renderVivarium(payload);
          break;
        }
        case "renderStockMarket": {
          const stockCanvas = require("./stockCanvas");
          result = await stockCanvas.renderStockMarket(payload);
          break;
        }
        default:
          throw new Error(`Unknown canvas worker task: ${task}`);
      }

      parentPort.postMessage({ id, success: true, result });
    } catch (err) {
      parentPort.postMessage({
        id,
        success: false,
        error: err ? err.message || String(err) : "Unknown worker error",
      });
    }
  });
}
