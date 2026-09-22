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
    this.maxQueueLength = 25;
    this.userTaskCounts = new Map(); // userId -> number
    this.maxUserTasks = 2;
    this.workerTaskCounts = new Map(); // worker -> count
    this.maxWorkerTasks = 500;
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

      worker.on("message", ({ id, success, result, error, memoryWarning }) => {
        const pending = this.pendingTasks.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          if (typeof pending.cleanupUser === "function") {
            pending.cleanupUser();
          }
          this.pendingTasks.delete(id);
          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error || "Worker error"));
          }
        }
        const count = (this.workerTaskCounts.get(worker) || 0) + 1;
        this.workerTaskCounts.set(worker, count);
        if (count >= this.maxWorkerTasks || memoryWarning) {
          const reason = memoryWarning ? "peringatan penggunaan memori tinggi (> 1.5GB)" : `setelah ${count} tugas rendering`;
          logger.info(
            `[CanvasWorkerPool] Worker #${index} didaur ulang ${reason} untuk kestabilan memori.`,
          );
          this.workerTaskCounts.delete(worker);
          this._replaceWorker(worker, scriptPath, index);
          return;
        }
        this._returnWorker(worker);
      });

      worker.on("error", (err) => {
        logger.error(`[CanvasWorkerPool] Worker #${index} error:`, err);
        this._replaceWorker(worker, scriptPath, index);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          logger.warn(
            `[CanvasWorkerPool] Worker #${index} exited with code ${code}`,
          );
          this._replaceWorker(worker, scriptPath, index);
        }
      });

      this.workers.push(worker);
      this.freeWorkers.push(worker);
    } catch (e) {
      logger.error(
        `[CanvasWorkerPool] Gagal menginisialisasi Worker #${index}:`,
        e,
      );
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

    // 1. Bounded Queue Guard
    if (this.taskQueue.length >= this.maxQueueLength) {
      throw new Error(
        `[CanvasWorkerPool] Antrean render grafis penuh (${this.taskQueue.length}/${this.maxQueueLength}). Silakan coba beberapa saat lagi.`,
      );
    }

    // 2. Per-User Concurrency Guard
    const userId = payload?.userId || payload?.user?.id || null;
    if (userId) {
      const activeCount = this.userTaskCounts.get(userId) || 0;
      if (activeCount >= this.maxUserTasks) {
        throw new Error(
          `[CanvasWorkerPool] Anda memiliki terlalu banyak tugas render yang sedang berjalan (maksimal ${this.maxUserTasks}). Tunggu hingga tugas sebelumnya selesai.`,
        );
      }
      this.userTaskCounts.set(userId, activeCount + 1);
    }

    const cleanupUser = () => {
      if (userId) {
        const count = this.userTaskCounts.get(userId) || 1;
        if (count <= 1) {
          this.userTaskCounts.delete(userId);
        } else {
          this.userTaskCounts.set(userId, count - 1);
        }
      }
    };

    const id = ++this.taskIdCounter;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingTasks.has(id)) {
          cleanupUser();
          this.pendingTasks.delete(id);
          reject(
            new Error(
              `[CanvasWorkerPool] Task ${task} timed out after ${timeoutMs}ms`,
            ),
          );
        }
      }, timeoutMs);

      this.pendingTasks.set(id, { resolve, reject, timer, cleanupUser });

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
