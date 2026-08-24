"use strict";

const { Worker } = require("node:worker_threads");
const path = require("path");
const { logger } = require("../managers/logger");

class CanvasWorkerPool {
  constructor(size = 2) {
    this.size = Math.max(1, size);
    this.workers = [];
    this.freeWorkers = [];
    this.pendingTasks = new Map(); // id -> { resolve, reject, timer }
    this.taskQueue = [];
    this.taskIdCounter = 0;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    const workerScript = path.join(__dirname, "canvasWorker.js");

    for (let i = 0; i < this.size; i++) {
      this._createWorker(workerScript, i);
    }
  }

  _createWorker(scriptPath, index) {
    try {
      const worker = new Worker(scriptPath);

      worker.on("message", ({ id, success, result, error }) => {
        const pending = this.pendingTasks.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingTasks.delete(id);
          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error || "Worker error"));
          }
        }
        this._returnWorker(worker);
      });

      worker.on("error", (err) => {
        logger.error(`[CanvasWorkerPool] Worker #${index} error:`, err);
        this._replaceWorker(worker, scriptPath, index);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          logger.warn(`[CanvasWorkerPool] Worker #${index} exited with code ${code}`);
          this._replaceWorker(worker, scriptPath, index);
        }
      });

      this.workers.push(worker);
      this.freeWorkers.push(worker);
    } catch (e) {
      logger.error(`[CanvasWorkerPool] Gagal menginisialisasi Worker #${index}:`, e);
    }
  }

  _replaceWorker(oldWorker, scriptPath, index) {
    const idx = this.workers.indexOf(oldWorker);
    if (idx !== -1) this.workers.splice(idx, 1);
    const freeIdx = this.freeWorkers.indexOf(oldWorker);
    if (freeIdx !== -1) this.freeWorkers.splice(freeIdx, 1);

    try {
      oldWorker.terminate().catch(() => {});
    } catch (e) {}

    this._createWorker(scriptPath, index);
  }

  _returnWorker(worker) {
    if (this.taskQueue.length > 0) {
      const next = this.taskQueue.shift();
      this._dispatch(worker, next.id, next.task, next.payload);
    } else {
      this.freeWorkers.push(worker);
    }
  }

  _dispatch(worker, id, task, payload) {
    worker.postMessage({ id, task, payload });
  }

  /**
   * Jalankan render task di background worker thread
   * @param {string} task
   * @param {any} payload
   * @param {number} timeoutMs
   * @returns {Promise<any>}
   */
  async runTask(task, payload, timeoutMs = 12000) {
    if (!this.isInitialized) {
      this.init();
    }

    const id = ++this.taskIdCounter;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingTasks.has(id)) {
          this.pendingTasks.delete(id);
          reject(new Error(`[CanvasWorkerPool] Task ${task} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingTasks.set(id, { resolve, reject, timer });

      if (this.freeWorkers.length > 0) {
        const worker = this.freeWorkers.pop();
        this._dispatch(worker, id, task, payload);
      } else {
        this.taskQueue.push({ id, task, payload });
      }
    });
  }

  async shutdown() {
    for (const worker of this.workers) {
      try {
        await worker.terminate();
      } catch (e) {}
    }
    this.workers = [];
    this.freeWorkers = [];
  }
}

const canvasWorkerPool = new CanvasWorkerPool(2);

module.exports = canvasWorkerPool;
