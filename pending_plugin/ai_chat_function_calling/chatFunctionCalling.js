"use strict";

/**
 * @file chatFunctionCalling.js
 * @description Blueprint Modul Function Calling Obrolan Bebas (Pending Plugin).
 * Dirancang untuk memetakan bahasa alami ke eksekusi slash command bot saat kuota LLM tersedia.
 */

const FUNCTION_DEFINITIONS = [
  {
    name: "play_music",
    description: "Memutar lagu atau playlist di voice channel Discord.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Judul lagu, nama musisi, atau tautan YouTube/Spotify.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "check_balance",
    description: "Memeriksa saldo Naura Coins (NC) atau Naura Star Fragments (NSF) pemain.",
    parameters: {
      type: "OBJECT",
      properties: {
        currency: {
          type: "STRING",
          enum: ["wallet", "bank", "starFragments"],
          description: "Jenis saldo yang ingin diperiksa.",
        },
      },
    },
  },
  {
    name: "weather_report",
    description: "Memeriksa cuaca real-time di server survival Naura Wilds.",
    parameters: {
      type: "OBJECT",
      properties: {
        zone: {
          type: "STRING",
          description: "Nama zona wilayah Naura Wilds.",
        },
      },
    },
  },
];

/**
 * Memproses respons Function Calling dari Gemini/Groq.
 * @param {Object} toolCall
 * @returns {Promise<Object>}
 */
async function dispatchToolCall(toolCall) {
  if (!toolCall || !toolCall.name) {
    return { success: false, error: "Tool call tidak valid." };
  }

  // Placeholder routing yang akan diaktifkan di era kuota berbayar
  return {
    success: true,
    tool: toolCall.name,
    args: toolCall.args || {},
    status: "DORMANT_BLUEPRINT_SIMULATED",
  };
}

module.exports = {
  FUNCTION_DEFINITIONS,
  dispatchToolCall,
};
