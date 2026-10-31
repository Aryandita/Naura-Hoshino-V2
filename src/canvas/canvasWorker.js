"use strict";

const { parentPort } = require("node:worker_threads");
const { SystemError } = require("../errors/DomainError");

if (parentPort) {
  async function safeRender(taskName, fn) {
    try {
      return { ok: true, value: await fn() };
    } catch (err) {
      return {
        ok: false,
        error: err ? err.message || String(err) : "Renderer " + taskName + " gagal",
      };
    }
  }

  parentPort.on("message", async ({ id, task, payload }) => {
    let result = null;
    let failed = false;
    let errorMessage = null;

    try {
      switch (task) {
        case "renderProfile": {
          const profileCanvas = require("./profileCanvas");
          const rendered = await safeRender(
            "renderProfile",
            function () {
              return profileCanvas.generateProfileCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderUnifiedProfile": {
          const unifiedProfileCanvas = require("./unifiedProfileCanvas");
          const rendered = await safeRender(
            "renderUnifiedProfile",
            function () {
              return unifiedProfileCanvas.generateUnifiedProfile(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderMinecraftPlayer": {
          const minecraftCanvas = require("./minecraftCanvas");
          const rendered = await safeRender(
            "renderMinecraftPlayer",
            function () {
              return minecraftCanvas.renderMinecraftPlayer(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderMinecraftPing": {
          const minecraftCanvas = require("./minecraftCanvas");
          const rendered = await safeRender(
            "renderMinecraftPing",
            function () {
              return minecraftCanvas.renderMinecraftPing(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderMinecraftStats": {
          const minecraftCanvas = require("./minecraftCanvas");
          const rendered = await safeRender(
            "renderMinecraftStats",
            function () {
              return minecraftCanvas.renderMinecraftStats(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderBusinessCard": {
          const profileCanvas = require("./profileCanvas");
          const rendered = await safeRender(
            "renderBusinessCard",
            function () {
              return profileCanvas.generateBusinessCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderBattle": {
          const battleCanvas = require("./battleCanvas");
          const rendered = await safeRender(
            "renderBattle",
            function () {
              return battleCanvas.renderBattle(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderNowPlaying": {
          const nowplayingCanvas = require("./nowplayingCanvas");
          const rendered = await safeRender(
            "renderNowPlaying",
            function () {
              return nowplayingCanvas.renderNowPlayingCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderCard": {
          const cardCanvas = require("./cardCanvas");
          const rendered = await safeRender(
            "renderCard",
            function () {
              return cardCanvas.renderCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderBoss": {
          const bossCanvas = require("./bossCanvas");
          const rendered = await safeRender(
            "renderBoss",
            function () {
              return bossCanvas.renderBossCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderCafe": {
          const cafeCanvas = require("./cafeCanvas");
          const rendered = await safeRender(
            "renderCafe",
            function () {
              return cafeCanvas.renderCafeCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderPetHabitat": {
          const petHabitatCanvas = require("./petHabitatCanvas");
          const rendered = await safeRender(
            "renderPetHabitat",
            function () {
              return petHabitatCanvas.renderPetHabitat(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderTerritoryMap": {
          const territoryCanvas = require("./territoryCanvas");
          const rendered = await safeRender(
            "renderTerritoryMap",
            function () {
              return territoryCanvas.renderTerritoryMap(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderGuildHall": {
          const guildHallCanvas = require("./guildHallCanvas");
          const rendered = await safeRender(
            "renderGuildHall",
            function () {
              return guildHallCanvas.renderGuildHall(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderColiseumMatch": {
          const coliseumCanvas = require("./coliseumCanvas");
          const rendered = await safeRender(
            "renderColiseumMatch",
            function () {
              return coliseumCanvas.renderColiseumMatch(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderVivarium": {
          const vivariumCanvas = require("./vivariumCanvas");
          const rendered = await safeRender(
            "renderVivarium",
            function () {
              return vivariumCanvas.renderVivarium(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderStockMarket": {
          const stockCanvas = require("./stockCanvas");
          const rendered = await safeRender(
            "renderStockMarket",
            function () {
              return stockCanvas.renderStockMarket(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderGreenhouse": {
          const greenhouseCanvas = require("./greenhouseCanvas");
          const rendered = await safeRender(
            "renderGreenhouse",
            function () {
              return greenhouseCanvas.renderGreenhouseCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderItemCard": {
          const itemCardCanvas = require("./itemCardCanvas");
          const rendered = await safeRender(
            "renderItemCard",
            function () {
              return itemCardCanvas.renderItemCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderBirthdayCard": {
          const birthdayCanvas = require("./birthdayCanvas");
          const rendered = await safeRender(
            "renderBirthdayCard",
            function () {
              return birthdayCanvas.renderBirthdayCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderMusicAura": {
          const musicAuraCanvas = require("./musicAuraCanvas");
          const rendered = await safeRender(
            "renderMusicAura",
            function () {
              return musicAuraCanvas.renderMusicAura(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderInventory": {
          const inventoryCanvas = require("./inventoryCanvas");
          const rendered = await safeRender(
            "renderInventory",
            function () {
              return inventoryCanvas.generateInventoryBackpackImage(
                payload.user,
                payload.inventory,
                payload.profile,
                payload.options || {},
              );
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderStoryScene": {
          const storySceneCanvas = require("./storySceneCanvas");
          const rendered = await safeRender(
            "renderStoryScene",
            function () {
              return storySceneCanvas.renderStoryScene(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderDynamicBanner": {
          const dynamicBannerEngine = require("./dynamicBannerEngine");
          const rendered = await safeRender(
            "renderDynamicBanner",
            function () {
              return dynamicBannerEngine.generateDynamicMotionBanner(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderRoom": {
          const roomCanvas = require("./roomCanvas");
          const rendered = await safeRender(
            "renderRoom",
            function () {
              return roomCanvas.renderRoomCanvas(
                payload.roomData,
                payload.user,
                payload.pet,
                payload.options || {},
              );
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderChronicle": {
          const chronicleCanvas = require("./chronicleCanvas");
          const rendered = await safeRender(
            "renderChronicle",
            function () {
              return chronicleCanvas.drawChronicleNewspaper(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderAstralOmikuji": {
          const astralCanvas = require("./astralCanvas");
          const rendered = await safeRender(
            "renderAstralOmikuji",
            function () {
              return astralCanvas.renderOmikujiCard(
                payload.omikuji,
                payload.user,
              );
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderAstralWeather": {
          const astralCanvas = require("./astralCanvas");
          const rendered = await safeRender(
            "renderAstralWeather",
            function () {
              return astralCanvas.renderAstralWeatherBanner(payload.weather);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderDuel": {
          const duelCanvas = require("./duelCanvas");
          const rendered = await safeRender(
            "renderDuel",
            function () {
              return duelCanvas.drawDuel(
                payload.p1,
                payload.p2,
                payload.roundLog,
                payload.round,
              );
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderAchievement": {
          const achievementCanvas = require("./achievementCanvas");
          const rendered = await safeRender(
            "renderAchievement",
            function () {
              return achievementCanvas.generateAchievementImage(
                payload.user,
                payload.title,
                payload.subtitle,
                payload.badgeColor,
              );
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderWrapped": {
          const wrappedCanvas = require("./wrappedCanvas");
          const rendered = await safeRender(
            "renderWrapped",
            function () {
              return wrappedCanvas.generateWrappedCard(
                payload.user,
                payload.stats,
              );
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderCardBattle": {
          const cardBattleCanvas = require("./cardBattleCanvas");
          const rendered = await safeRender(
            "renderCardBattle",
            function () {
              return cardBattleCanvas.drawCardBattleArena(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderCarbon":
        case "renderCodeSnippet": {
          const codeCanvas = require("./codeCanvas");
          const rendered = await safeRender(
            task,
            function () {
              return codeCanvas.renderCarbonCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderPollChart": {
          const pollCanvas = require("./pollCanvas");
          const rendered = await safeRender(
            "renderPollChart",
            function () {
              return pollCanvas.renderPollChart(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderAffinity": {
          const affinityCanvas = require("./affinityCanvas");
          const rendered = await safeRender(
            "renderAffinity",
            function () {
              return affinityCanvas.renderAffinityCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderFishCatch": {
          const fishCanvas = require("./fishCanvas");
          const rendered = await safeRender(
            "renderFishCatch",
            function () {
              return fishCanvas.renderFishCatch(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderWeatherCard": {
          const weatherCanvas = require("./weatherCanvas");
          const rendered = await safeRender(
            "renderWeatherCard",
            function () {
              return weatherCanvas.renderWeatherCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderAnimeCard": {
          const animeCanvas = require("./animeCanvas");
          const rendered = await safeRender(
            "renderAnimeCard",
            function () {
              return animeCanvas.renderAnimeCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderMovieCard": {
          const movieCanvas = require("./movieCanvas");
          const rendered = await safeRender(
            "renderMovieCard",
            function () {
              return movieCanvas.renderMovieCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderDailyCard": {
          const dailyCanvas = require("./dailyCanvas");
          const rendered = await safeRender(
            "renderDailyCard",
            function () {
              return dailyCanvas.renderDailyCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderLeaderboard": {
          const leaderboardCanvas = require("./leaderboardCanvas");
          const rendered = await safeRender(
            "renderLeaderboard",
            function () {
              return leaderboardCanvas.renderLeaderboard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderGithubCard": {
          const githubCanvas = require("./githubCanvas");
          const rendered = await safeRender(
            "renderGithubCard",
            function () {
              return githubCanvas.renderGithubCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderServerInfo": {
          const serverinfoCanvas = require("./serverinfoCanvas");
          const rendered = await safeRender(
            "renderServerInfo",
            function () {
              return serverinfoCanvas.renderServerInfo(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderShipCard": {
          const shipCanvas = require("./shipCanvas");
          const rendered = await safeRender(
            "renderShipCard",
            function () {
              return shipCanvas.renderShipCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderTarotCard": {
          const tarotCanvas = require("./tarotCanvas");
          const rendered = await safeRender(
            "renderTarotCard",
            function () {
              return tarotCanvas.renderTarotCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderFortuneCard": {
          const fortuneCanvas = require("./fortuneCanvas");
          const rendered = await safeRender(
            "renderFortuneCard",
            function () {
              return fortuneCanvas.renderFortuneCard(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderRankCard": {
          const { CanvasUtils } = require("./CanvasUtils");
          const rendered = await safeRender(
            "renderRankCard",
            function () {
              return CanvasUtils.generateRankCard(
                payload.targetUser || payload.user,
                payload.level,
                payload.xp,
                payload.targetXp,
                payload.localRank || payload.rankNumber || 1,
                payload.roleBadge || payload.manners || 100,
                payload.isPremium || payload.isVip || false,
                payload.customBg,
                payload.customBorder,
              );
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderMusicProfile": {
          const { generateMusicProfileImage } = require("./canvasHelper");
          const rendered = await safeRender(
            "renderMusicProfile",
            function () {
              return generateMusicProfileImage(
                payload.user,
                payload.stats,
                payload.clientAvatar,
              );
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        case "renderGiveawayBanner": {
          const { generateGiveawayBanner } = require("./dynamicBannerEngine");
          const rendered = await safeRender(
            "renderGiveawayBanner",
            function () {
              return generateGiveawayBanner(payload);
            },
          );
          if (!rendered.ok) {
            failed = true;
            errorMessage = rendered.error;
            break;
          }
          result = rendered.value;
          break;
        }
        default:
          throw new SystemError("Unknown canvas worker task: " + task);
      }
    } catch (err) {
      failed = true;
      errorMessage = err ? err.message || String(err) : "Unknown worker error";
    }

    if (failed) {
      parentPort.postMessage({
        id,
        success: false,
        error: errorMessage || "Unknown worker error",
      });
      result = null;
      if (global.gc) {
        global.gc();
      }
      return;
    }

    parentPort.postMessage({ id, success: true, result });
    result = null;
    if (global.gc) {
      global.gc();
    }
  });
}
