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
        case "renderGreenhouse": {
          const greenhouseCanvas = require("./greenhouseCanvas");
          result = await greenhouseCanvas.renderGreenhouseCard(payload);
          break;
        }
        case "renderItemCard": {
          const itemCardCanvas = require("./itemCardCanvas");
          result = await itemCardCanvas.renderItemCard(payload);
          break;
        }
        case "renderBirthdayCard": {
          const birthdayCanvas = require("./birthdayCanvas");
          result = await birthdayCanvas.renderBirthdayCard(payload);
          break;
        }
        case "renderMusicAura": {
          const musicAuraCanvas = require("./musicAuraCanvas");
          result = await musicAuraCanvas.renderMusicAura(payload);
          break;
        }
        case "renderInventory": {
          const inventoryCanvas = require("./inventoryCanvas");
          result = await inventoryCanvas.generateInventoryBackpackImage(
            payload.user,
            payload.inventory,
            payload.profile,
            payload.options || {},
          );
          break;
        }
        case "renderStoryScene": {
          const storySceneCanvas = require("./storySceneCanvas");
          result = await storySceneCanvas.renderStoryScene(payload);
          break;
        }
        case "renderDynamicBanner": {
          const dynamicBannerEngine = require("./dynamicBannerEngine");
          result = await dynamicBannerEngine.generateDynamicMotionBanner(payload);
          break;
        }
        case "renderRoom": {
          const roomCanvas = require("./roomCanvas");
          result = await roomCanvas.renderRoomCanvas(
            payload.roomData,
            payload.user,
            payload.pet,
            payload.options || {},
          );
          break;
        }
        case "renderChronicle": {
          const chronicleCanvas = require("./chronicleCanvas");
          result = await chronicleCanvas.drawChronicleNewspaper(payload);
          break;
        }
        case "renderAstralOmikuji": {
          const astralCanvas = require("./astralCanvas");
          result = await astralCanvas.renderOmikujiCard(
            payload.omikuji,
            payload.user,
          );
          break;
        }
        case "renderAstralWeather": {
          const astralCanvas = require("./astralCanvas");
          result = await astralCanvas.renderAstralWeatherBanner(
            payload.weather,
          );
          break;
        }
        case "renderDuel": {
          const duelCanvas = require("./duelCanvas");
          result = await duelCanvas.drawDuel(
            payload.p1,
            payload.p2,
            payload.roundLog,
            payload.round,
          );
          break;
        }
        case "renderAchievement": {
          const achievementCanvas = require("./achievementCanvas");
          result = await achievementCanvas.generateAchievementImage(
            payload.user,
            payload.title,
            payload.subtitle,
            payload.badgeColor,
          );
          break;
        }
        case "renderWrapped": {
          const wrappedCanvas = require("./wrappedCanvas");
          result = await wrappedCanvas.generateWrappedCard(
            payload.user,
            payload.stats,
          );
          break;
        }
        case "renderCardBattle": {
          const cardBattleCanvas = require("./cardBattleCanvas");
          result = await cardBattleCanvas.drawCardBattleArena(payload);
          break;
        }
        default:
          throw new Error(`Unknown canvas worker task: ${task}`);
      }

      // Memeriksa memory heap limit (1.5GB soft limit)
      const mem = process.memoryUsage();
      const memoryWarning = mem.heapUsed > 1536 * 1024 * 1024; // > 1.5GB

      parentPort.postMessage({ id, success: true, result, memoryWarning });
      result = null;
      if (global.gc) {
        global.gc();
      }
    } catch (err) {
      parentPort.postMessage({
        id,
        success: false,
        error: err ? err.message || String(err) : "Unknown worker error",
      });
    }
  });
}
