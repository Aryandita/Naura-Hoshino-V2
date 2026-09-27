"use strict";

const vm = require("node:vm");
const { performance } = require("node:perf_hooks");
const { logger } = require("../managers/logger");

const MAX_EXECUTION_TIME_MS = 1500;
const MAX_LOG_LINES = 40;
const MAX_OUTPUT_CHARS = 3500;

// Pola kata kunci berbahaya yang dilarang keras di dalam script
const FORBIDDEN_PATTERNS = [
  /\bprocess\b/i,
  /\brequire\b/i,
  /\bchild_process\b/i,
  /\bfs\b/i,
  /\bnet\b/i,
  /\bhttp\b/i,
  /\bhttps\b/i,
  /\bimport\b/i,
  /\bconstructor\s*\.\s*constructor\b/i,
  /\bFunction\b/i,
  /\beval\b/i,
  /\bWebSocket\b/i,
  /\bfetch\b/i,
  /\bXMLHttpRequest\b/i,
];

function sanitizeOutput(val) {
  if (val === undefined) return "undefined";
  if (val === null) return "null";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}

/**
 * Menjalankan kode JavaScript dalam lingkungan sandbox terisolasi.
 * @param {string} rawCode - Kode yang akan dieksekusi
 * @returns {Promise<{success: boolean, logs: string[], result: string, executionTimeMs: number, error?: string}>}
 */
async function executeSandboxedCode(rawCode) {
  if (!rawCode || typeof rawCode !== "string") {
    return {
      success: false,
      logs: [],
      result: "null",
      executionTimeMs: 0,
      error: "Kode yang dimasukkan kosong atau tidak valid.",
    };
  }

  const trimmedCode = rawCode.trim();

  // Validasi awal: cegah penggunaan token atau kata kunci terlarang
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(trimmedCode)) {
      return {
        success: false,
        logs: [],
        result: "null",
        executionTimeMs: 0,
        error: `Akses ditolak: Kode mengandung ekspresi yang diblokir demi keamanan (${pattern.toString()}).`,
      };
    }
  }

  const capturedLogs = [];
  const appendLog = (...args) => {
    if (capturedLogs.length >= MAX_LOG_LINES) return;
    const line = args.map(sanitizeOutput).join(" ");
    capturedLogs.push(line.substring(0, 300));
  };

  // Konteks sandbox dengan intrinsic bersih
  const sandboxContext = {
    console: {
      log: appendLog,
      info: appendLog,
      warn: appendLog,
      error: appendLog,
    },
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,
  };

  const context = vm.createContext(sandboxContext);
  const wrappedCode = `"use strict";\n(() => {\n${trimmedCode}\n})()`;

  const startTime = performance.now();
  let rawResult;

  try {
    const script = new vm.Script(wrappedCode);
    rawResult = script.runInContext(context, {
      timeout: MAX_EXECUTION_TIME_MS,
      displayErrors: true,
      breakOnSigint: true,
    });
  } catch (execErr) {
    const executionTimeMs = Math.round(performance.now() - startTime);
    let errorMessage = execErr.message || String(execErr);

    if (execErr.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
      errorMessage = `Batas waktu eksekusi (${MAX_EXECUTION_TIME_MS}ms) terlampaui. Kemungkinan terdapat infinite loop atau kalkulasi terlalu berat.`;
    }

    return {
      success: false,
      logs: capturedLogs,
      result: "null",
      executionTimeMs,
      error: errorMessage,
    };
  }

  const executionTimeMs = Math.round(performance.now() - startTime);
  let stringResult = sanitizeOutput(rawResult);

  if (stringResult.length > MAX_OUTPUT_CHARS) {
    stringResult = `${stringResult.substring(0, MAX_OUTPUT_CHARS)}... (output dipotong)`;
  }

  logger.info(`[SandboxService] Eksekusi kode selesai dalam ${executionTimeMs}ms.`);

  return {
    success: true,
    logs: capturedLogs,
    result: stringResult,
    executionTimeMs,
  };
}

module.exports = {
  executeSandboxedCode,
  FORBIDDEN_PATTERNS,
  MAX_EXECUTION_TIME_MS,
};
