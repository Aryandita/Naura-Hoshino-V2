// Lokasi: src/adapters/aiBoundaryAdapter.js
// Implementasi Law 3: Keep external systems behind a boundary & Law 2: Name things by meaning
// Mengisolasi respons provider AI (Gemini, Groq, Ollama, Verba) ke dalam domain model yang seragam.

"use strict";

const { ValidationError } = require("../errors/DomainError");

/**
 * Menormalisasi respons mentah dari berbagai AI provider ke domain model AI
 * @param {string} provider Nama provider ('gemini' | 'groq' | 'ollama' | 'verba')
 * @param {any} rawResponse Objek balasan dari SDK eksternal
 * @returns {{
 *   provider: string,
 *   content: string,
 *   reasoning: string|null,
 *   toolCalls: Array<{ name: string, args: Record<string, any> }>,
 *   finishReason: string,
 *   tokenUsage: { promptTokens: number, completionTokens: number, totalTokens: number }
 * }}
 */
function normalizeAiResponse(provider, rawResponse) {
  if (!rawResponse || typeof rawResponse !== "object") {
    throw new ValidationError("Payload AI eksternal tidak valid.", { provider, rawResponse });
  }

  let content = "";
  let reasoning = null;
  const toolCalls = [];
  let finishReason = "STOP";
  let promptTokens = 0;
  let completionTokens = 0;

  const normalizedProvider = String(provider || "unknown").toLowerCase();

  switch (normalizedProvider) {
    case "gemini": {
      // Gemini API (@google/genai atau @google/generative-ai)
      const candidate = rawResponse.candidates?.[0];
      if (candidate) {
        finishReason = candidate.finishReason || "STOP";
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (typeof part.text === "string") {
            content += part.text;
          }
          if (part.functionCall) {
            toolCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            });
          }
        }
      }
      if (rawResponse.usageMetadata) {
        promptTokens = rawResponse.usageMetadata.promptTokenCount || 0;
        completionTokens = rawResponse.usageMetadata.candidatesTokenCount || 0;
      }
      break;
    }

    case "groq":
    case "openai": {
      // OpenAI / Groq SDK format
      const choice = rawResponse.choices?.[0];
      if (choice) {
        finishReason = choice.finish_reason || "STOP";
        if (typeof choice.message?.content === "string") {
          content = choice.message.content;
        }
        if (typeof choice.message?.reasoning_content === "string") {
          reasoning = choice.message.reasoning_content;
        }
        if (Array.isArray(choice.message?.tool_calls)) {
          for (const call of choice.message.tool_calls) {
            let parsedArgs = {};
            try {
              parsedArgs = typeof call.function?.arguments === "string" ? JSON.parse(call.function.arguments) : (call.function?.arguments || {});
            } catch {
              parsedArgs = {};
            }
            toolCalls.push({
              name: call.function?.name || "unknown_tool",
              args: parsedArgs,
            });
          }
        }
      }
      if (rawResponse.usage) {
        promptTokens = rawResponse.usage.prompt_tokens || 0;
        completionTokens = rawResponse.usage.completion_tokens || 0;
      }
      break;
    }

    default: {
      // Fallback generik
      if (typeof rawResponse.text === "string") {
        content = rawResponse.text;
      } else if (typeof rawResponse.content === "string") {
        content = rawResponse.content;
      } else if (typeof rawResponse.message === "string") {
        content = rawResponse.message;
      }
      break;
    }
  }

  return Object.freeze({
    provider: normalizedProvider,
    content: content.trim(),
    reasoning,
    toolCalls: Object.freeze(toolCalls),
    finishReason,
    tokenUsage: Object.freeze({
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    }),
  });
}

module.exports = {
  normalizeAiResponse,
};
