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
